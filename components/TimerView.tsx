"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session, Settings, StepRecord } from "@/lib/types";
import {
  advance,
  applyCompression,
  goBack,
  nextActiveIndex,
  planCompression,
  prevActiveIndex,
  stepElapsed,
  togglePause,
  totalRemaining,
} from "@/lib/session";
import { fmtClock, fmtDuration } from "@/lib/time";
import { speak, stopSpeech } from "@/lib/speech";
import { useWakeLock } from "@/lib/wakeLock";
import Modal from "./Modal";

export default function TimerView({
  session,
  settings,
  onSettings,
  onSession,
  onRecord,
  onUnrecord,
  onFinish,
  onExit,
}: {
  session: Session;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onSession: (s: Session) => void;
  onRecord: (r: StepRecord) => void;
  onUnrecord: (sessionId: string, stepId: string) => void;
  onFinish: () => void;
  onExit: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [panicOpen, setPanicOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [panicMin, setPanicMin] = useState("");
  const announced = useRef<Set<string>>(new Set());
  const wake = useWakeLock(!session.finishedAt);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const s = session;
  const cur = s.steps[s.index];
  const nextIdx = nextActiveIndex(s.steps, s.index);
  const next = nextIdx >= 0 ? s.steps[nextIdx] : null;
  const elapsed = stepElapsed(s, now);
  const stepRemain = cur.plannedSec - elapsed;
  const overtime = stepRemain < 0;
  const totalRemain = totalRemaining(s, now);
  const leaveLeft = s.targetLeave !== null ? (s.targetLeave - now) / 1000 : null;
  const buffer = leaveLeft !== null ? leaveLeft - totalRemain : null;
  const paused = s.pausedAt !== null;
  const activeCount = s.steps.filter((x) => !x.skip).length;
  const activePos = s.steps.slice(0, s.index + 1).filter((x) => !x.skip).length;

  /* ---------- 語音報時 ---------- */
  useEffect(() => {
    if (settings.muted || paused || s.finishedAt) return;
    const once = (key: string, text: string) => {
      const k = `${s.id}:${key}`;
      if (announced.current.has(k)) return;
      announced.current.add(k);
      speak(text);
    };
    if (cur.plannedSec >= 120 && stepRemain <= 60 && stepRemain > 55) {
      once(`${s.index}:1min`, `${cur.name}仲有一分鐘`);
    }
    if (stepRemain <= 0 && stepRemain > -5) {
      once(
        `${s.index}:up`,
        next ? `${cur.name}時間到，該進行${next.name}` : `${cur.name}時間到，準備出門`
      );
    }
    if (leaveLeft !== null) {
      if (leaveLeft <= 600 && leaveLeft > 590) once("leave10", "注意，距離最晚出門時間仲有十分鐘");
      if (leaveLeft <= 300 && leaveLeft > 290) once("leave5", "注意，距離最晚出門時間只剩五分鐘");
      if (leaveLeft <= 0 && leaveLeft > -10) once("leave0", "已經到最晚出門時間，要即刻出門");
    }
  }, [now, settings.muted, paused, s, cur, next, stepRemain, leaveLeft]);

  useEffect(() => {
    if (settings.muted) stopSpeech();
  }, [settings.muted]);

  /* ---------- 操作 ---------- */
  const handleNext = () => {
    const t = Date.now();
    const r = advance(s, t);
    onRecord({ sessionId: s.id, presetId: s.presetId, at: t, ...r.record });
    onSession(r.session);
    if (r.finished) {
      if (!settings.muted) speak("全部完成，可以出門，一路順風");
      onFinish();
    } else if (!settings.muted) {
      const n = r.session.steps[r.session.index];
      stopSpeech();
      speak(`下一步，${n.name}，${Math.round(n.plannedSec / 60)}分鐘`);
    }
  };

  const handleBack = () => {
    const r = goBack(s, Date.now());
    if (!r) return;
    onUnrecord(s.id, r.removedStepId);
    onSession(r.session);
  };

  const openPanic = () => {
    const def = leaveLeft !== null ? Math.max(0, Math.floor(leaveLeft / 60)) : Math.max(1, Math.floor(totalRemain / 120));
    setPanicMin(String(def));
    setPanicOpen(true);
  };

  const plan = useMemo(() => {
    if (!panicOpen) return null;
    const m = Number(panicMin);
    if (!Number.isFinite(m) || m < 0) return null;
    return planCompression(s, m * 60, now);
    // 只在打開或修改分鐘時重算，避免每 250ms 跳動
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panicOpen, panicMin]);

  const applyPanic = () => {
    if (!plan) return;
    const t = Date.now();
    let updated = applyCompression(s, plan);
    if (s.targetLeave === null || leaveLeft === null || Math.abs(leaveLeft / 60 - Number(panicMin)) > 1) {
      updated = { ...updated, targetLeave: t + Number(panicMin) * 60_000 };
    }
    onSession(updated);
    setPanicOpen(false);
    if (!settings.muted) speak("已經壓縮剩餘步驟，加油");
  };

  const bigLabel = next ? "完成此步驟" : "全部完成，出門！";

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-[#0a0a0b]">
      {/* 頂部列 */}
      <div className="flex shrink-0 items-center gap-2 px-3 pt-2">
        <button
          onClick={() => setExitOpen(true)}
          className="h-11 w-11 rounded-xl bg-neutral-900 text-lg text-neutral-400"
          aria-label="結束流程"
        >
          ✕
        </button>
        <div className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-neutral-400">
          {s.presetName}
          {s.compressed && <span className="ml-1 text-orange-400">（已壓縮）</span>}
        </div>
        <span
          className={`h-11 rounded-xl px-2 text-xs leading-[2.75rem] ${
            wake === "on" ? "text-amber-300" : "text-neutral-600"
          }`}
          title="螢幕常亮"
        >
          {wake === "on" ? "☀ 常亮" : wake === "unsupported" ? "☀ 不支援" : "☀ 關"}
        </span>
        <button
          onClick={() => onSettings({ ...settings, muted: !settings.muted })}
          className={`h-11 rounded-xl px-3 text-lg font-bold ${
            settings.muted ? "bg-neutral-800 text-neutral-500" : "bg-sky-500/20 text-sky-300"
          }`}
          aria-label={settings.muted ? "開啟語音" : "靜音"}
        >
          {settings.muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* 資訊區 */}
      <div className="flex min-h-0 flex-1 flex-col justify-center px-4">
        <div className="text-center text-lg font-semibold text-neutral-400">
          步驟 {activePos}/{activeCount}
        </div>
        <div className="truncate text-center text-4xl font-black text-white">{cur.name}</div>
        <div
          className={`tnum text-center font-black leading-none ${
            overtime ? "overtime-pulse text-red-500" : "text-white"
          } ${paused ? "opacity-40" : ""}`}
          style={{ fontSize: "min(24vw, 13dvh)" }}
          aria-live="off"
        >
          {fmtDuration(stepRemain, true)}
        </div>
        <div className={`text-center text-base font-semibold ${overtime ? "text-red-400" : "text-neutral-500"}`}>
          {paused ? "⏸ 已暫停" : overtime ? "此步驟已超時" : "此步驟剩餘"}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-neutral-900 p-2 text-center">
            <div className="text-xs text-neutral-500">總剩餘準備</div>
            <div className="tnum text-3xl font-bold">{fmtDuration(totalRemain)}</div>
          </div>
          <div
            className={`rounded-2xl p-2 text-center ${
              buffer === null
                ? "bg-neutral-900"
                : buffer >= 0
                  ? "bg-emerald-500/15"
                  : "bg-red-500/20"
            }`}
          >
            {buffer === null || s.targetLeave === null ? (
              <>
                <div className="text-xs text-neutral-500">預計完成</div>
                <div className="tnum text-3xl font-bold">{fmtClock(now + totalRemain * 1000)}</div>
              </>
            ) : (
              <>
                <div className="text-xs text-neutral-400">{fmtClock(s.targetLeave)} 出門・緩衝</div>
                <div className={`tnum text-3xl font-bold ${buffer >= 0 ? "text-emerald-300" : "text-red-400"}`}>
                  {buffer >= 0 ? `+${Math.floor(buffer / 60)} 分` : `遲 ${Math.ceil(-buffer / 60)} 分`}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 text-sm">
          {s.steps.map((st, i) => (
            <span
              key={st.id}
              className={`shrink-0 rounded-full px-2 py-1 ${
                i === s.index
                  ? "bg-lime-400 font-bold text-black"
                  : st.skip
                    ? "bg-neutral-900 text-neutral-600 line-through"
                    : i < s.index
                      ? "bg-neutral-900 text-neutral-500"
                      : "bg-neutral-800 text-neutral-200"
              }`}
            >
              {st.skip ? `${st.name}・建議跳過` : `${st.name} ${Math.round(st.plannedSec / 60)}m`}
            </span>
          ))}
        </div>
      </div>

      {/* 小按鈕 */}
      <div className="grid shrink-0 grid-cols-3 gap-2 px-3 pb-2">
        <button
          onClick={handleBack}
          disabled={prevActiveIndex(s.steps, s.index) === -1}
          className="h-14 rounded-2xl bg-neutral-800 font-semibold text-neutral-200 disabled:opacity-30"
        >
          ⏮ 上一步
        </button>
        <button
          onClick={() => onSession(togglePause(s, Date.now()))}
          className="h-14 rounded-2xl bg-neutral-800 font-semibold text-neutral-200"
        >
          {paused ? "▶ 繼續" : "⏸ 暫停"}
        </button>
        <button onClick={openPanic} className="h-14 rounded-2xl bg-orange-600 font-bold text-white active:bg-orange-500">
          🔥 來不及了
        </button>
      </div>

      {/* 超大完成按鈕：佔畫面 ≥35% */}
      <button
        onClick={handleNext}
        className={`mx-3 mb-[max(0.75rem,env(safe-area-inset-bottom))] flex shrink-0 flex-col items-center justify-center rounded-[2rem] text-black shadow-lg active:scale-[0.99] ${
          overtime ? "bg-yellow-300 active:bg-yellow-200" : "bg-lime-400 active:bg-lime-300"
        }`}
        style={{ height: "38dvh", minHeight: "35dvh" }}
      >
        <span className="text-5xl font-black">{bigLabel}</span>
        <span className="mt-2 text-xl font-bold opacity-80">
          {next ? `下一步：${next.name} ▶` : "按一下結束計時"}
        </span>
      </button>

      {/* 緊急壓縮 */}
      <Modal open={panicOpen} title="來不及了：一鍵壓縮" onClose={() => setPanicOpen(false)}>
        <label className="mb-1 block text-neutral-300" htmlFor="panic-min">
          距離目標出門仲有幾多分鐘？
        </label>
        <div className="mb-3 flex items-center gap-2">
          <input
            id="panic-min"
            type="number"
            inputMode="numeric"
            min={0}
            value={panicMin}
            onChange={(e) => setPanicMin(e.target.value)}
            className="tnum h-14 w-28 rounded-xl bg-neutral-800 px-3 text-center text-2xl font-bold"
          />
          <span className="text-neutral-400">分鐘（剩餘步驟需要 {Math.ceil(totalRemain / 60)} 分鐘）</span>
        </div>
        {plan && (
          <>
            <p
              className={`mb-3 font-semibold ${
                plan.mode === "enough"
                  ? "text-emerald-300"
                  : plan.mode === "impossible"
                    ? "text-red-400"
                    : "text-orange-300"
              }`}
            >
              {plan.message}
            </p>
            <ul className="mb-4 space-y-1">
              {plan.steps.map((st, i) =>
                i < s.index ? null : (
                  <li key={st.id} className="flex justify-between rounded-lg bg-neutral-800 px-3 py-2">
                    <span className={st.skip ? "text-neutral-500 line-through" : ""}>
                      {st.name}
                      {st.skip && <span className="ml-1 text-xs text-orange-300 no-underline">建議跳過</span>}
                    </span>
                    <span className="tnum text-neutral-300">
                      {st.skip
                        ? "0:00"
                        : i === s.index
                          ? `剩 ${fmtDuration(Math.max(0, st.plannedSec - elapsed))}`
                          : `${fmtDuration(s.steps[i].plannedSec)} → ${fmtDuration(st.plannedSec)}`}
                    </span>
                  </li>
                )
              )}
            </ul>
          </>
        )}
        <div className="flex gap-2">
          <button onClick={() => setPanicOpen(false)} className="h-14 flex-1 rounded-2xl bg-neutral-700 font-semibold">
            取消
          </button>
          <button
            onClick={applyPanic}
            disabled={!plan || plan.mode === "enough"}
            className="h-14 flex-[2] rounded-2xl bg-orange-500 text-lg font-bold text-black disabled:opacity-40"
          >
            套用壓縮
          </button>
        </div>
      </Modal>

      <Modal open={exitOpen} title="結束今次流程？" onClose={() => setExitOpen(false)}>
        <p className="mb-4 text-neutral-300">已完成步驟嘅耗時紀錄會保留，用嚟學習你嘅實際速度。</p>
        <div className="flex gap-2">
          <button onClick={() => setExitOpen(false)} className="h-14 flex-1 rounded-2xl bg-neutral-700 font-semibold">
            繼續計時
          </button>
          <button
            onClick={() => {
              stopSpeech();
              onExit();
            }}
            className="h-14 flex-1 rounded-2xl bg-red-600 font-bold"
          >
            結束
          </button>
        </div>
      </Modal>
    </main>
  );
}
