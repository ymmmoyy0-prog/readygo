"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session, Settings, StepRecord } from "@/lib/types";
import {
  advance,
  applyCompression,
  autoAdvance,
  extendPrevious,
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
import Flap from "./Flap";
import { SpeakerIcon, SunIcon } from "./Icons";
import { markTip, tipSeen } from "@/lib/storage";
import Ruler from "./Ruler";
import TransitBadge from "./TransitBadge";
import type { LiveTransit } from "@/lib/target";
import { listDepartures } from "@/lib/target";

const EXTEND_WINDOW_MS = 30_000;

export default function TimerView({
  session,
  settings,
  onSettings,
  onSession,
  onRecord,
  onUnrecord,
  onFinish,
  onExit,
  live,
  liveLeave,
}: {
  live: LiveTransit;
  /** 到達模式下按實時班次更新的最晚出門時間 */
  liveLeave: number | null;
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
  const [tips, setTips] = useState({ panic: true, extend: true });
  useEffect(() => setTips({ panic: tipSeen("panic"), extend: tipSeen("extend") }), []);
  const wake = useWakeLock(!session.finishedAt);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const s = session;

  /* ---------- 到時自動進入下一步 ---------- */
  useEffect(() => {
    const r = autoAdvance(s, now);
    if (!r) return;
    r.records.forEach((rec) => onRecord({ sessionId: s.id, presetId: s.presetId, ...rec }));
    onSession(r.session);
    if (!settings.muted) {
      const done = r.records[r.records.length - 1];
      const n = r.session.steps[r.session.index];
      stopSpeech();
      speak(`${done.stepName}時間已到，現在進行${n.name}`);
    }
  }, [now, s, settings.muted, onRecord, onSession]);

  const cur = s.steps[s.index];
  const nextIdx = nextActiveIndex(s.steps, s.index);
  const next = nextIdx >= 0 ? s.steps[nextIdx] : null;
  const elapsed = stepElapsed(s, now);
  const stepRemain = cur.plannedSec - elapsed;
  const overtime = stepRemain < 0;
  const totalRemain = totalRemaining(s, now);
  const leaveTarget = liveLeave ?? s.targetLeave;
  const leaveLeft = leaveTarget !== null ? (leaveTarget - now) / 1000 : null;
  const buffer = leaveLeft !== null ? leaveLeft - totalRemain : null;
  const paused = s.pausedAt !== null;
  const activeCount = s.steps.filter((x) => !x.skip).length;
  const activePos = s.steps.slice(0, s.index + 1).filter((x) => !x.skip).length;
  const plannedTotal = s.steps.reduce((a, x) => a + (x.skip ? 0 : x.plannedSec), 0);
  const doneSec = s.steps.reduce((a, x, i) => a + (i < s.index && !x.skip ? x.plannedSec : 0), 0);
  const progress = plannedTotal ? (doneSec + Math.min(elapsed, cur.plannedSec)) / plannedTotal : 0;
  const autoStep =
    s.autoFrom && now - s.autoFrom.at < EXTEND_WINDOW_MS && prevActiveIndex(s.steps, s.index) === s.autoFrom.index
      ? s.steps[s.autoFrom.index]
      : null;

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
      once(`${s.index}:1min`, `${cur.name}尚餘一分鐘`);
    }
    if (!next && stepRemain <= 0 && stepRemain > -5) once(`${s.index}:up`, `${cur.name}時間已到，請準備出門`);
    if (leaveLeft !== null) {
      if (leaveLeft <= 600 && leaveLeft > 590) once("leave10", "注意，距離最晚出門時間尚餘十分鐘");
      if (leaveLeft <= 300 && leaveLeft > 290) once("leave5", "注意，距離最晚出門時間只餘五分鐘");
      if (leaveLeft <= 0 && leaveLeft > -10) once("leave0", "已到最晚出門時間，請立即出門");
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
      if (!settings.muted) speak("全部完成，可以出門");
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

  const handleExtend = () => {
    const r = extendPrevious(s, Date.now(), 120);
    if (!r) return;
    onUnrecord(s.id, r.removedStepId);
    onSession(r.session);
    if (!settings.muted) {
      stopSpeech();
      speak(`${r.session.steps[r.session.index].name}延長兩分鐘`);
    }
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
    // 只在開啟或修改分鐘時重新計算，避免每 250ms 跳動
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
    if (!settings.muted) speak("已壓縮餘下步驟");
  };

  const nextDep = listDepartures(settings, live, totalRemain, now).find((d) => d.catchable) ?? null;
  const ruleSteps = s.steps.map((st) => ({ name: st.name, minutes: st.plannedSec / 60, skip: st.skip }));

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-paper">
      {/* 頂部列 */}
      <div className="flex shrink-0 items-center gap-2 border-b-[3px] border-ink px-3 py-1.5">
        <button onClick={() => setExitOpen(true)} className="h-10 w-10 text-lg font-bold text-ink" aria-label="結束流程">
          ✕
        </button>
        <div className="min-w-0 flex-1 truncate text-center text-[15px] font-bold text-ink">
          {s.presetName}
          {s.compressed && <span className="ml-1 text-danger">・已壓縮</span>}
        </div>
        <span className={`flex items-center gap-0.5 text-[12px] font-semibold ${wake === "on" ? "text-ink" : "text-faint"}`}>
          <SunIcon size={17} />
          常亮
        </span>
        <button
          onClick={() => onSettings({ ...settings, muted: !settings.muted })}
          className={`flex h-10 items-center gap-0.5 px-1 text-[12px] font-semibold ${settings.muted ? "text-faint" : "text-ink"}`}
          aria-label={settings.muted ? "開啟語音" : "關閉語音"}
        >
          <SpeakerIcon size={19} off={settings.muted} />
          語音{settings.muted ? "關" : "開"}
        </button>
      </div>
      <p className="shrink-0 border-b border-line bg-brand-soft px-5 py-1.5 text-[13px] text-sub">
        時間到自動進入下一步；提早完成按下方黑色按鈕
      </p>

      {/* 資訊區 */}
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[1.6dvh] overflow-hidden px-5">
        <div>
          <div className="text-[14px] text-sub">
            第 {activePos} 站／共 {activeCount} 站
            {paused && <b className="ml-2 text-ink">・已暫停</b>}
            {overtime && !paused && <b className="ml-2 text-danger">・已超時</b>}
          </div>
          <div className="truncate font-extrabold leading-tight text-ink" style={{ fontSize: "min(8.5vw, 4.6dvh)" }}>
            {cur.name}
          </div>
        </div>

        <div className={paused ? "opacity-35" : overtime ? "overtime-pulse" : ""}>
          <Flap text={fmtDuration(stepRemain, true)} danger={overtime} style={{ fontSize: "min(18vw, 9.5dvh)" }} />
        </div>

        {autoStep && (
          <div className="flex items-center gap-2 border border-ink bg-warn-soft py-1 pl-3 pr-1">
            <span className="min-w-0 flex-1 truncate text-[15px] text-ink">「{autoStep.name}」已自動完成</span>
            <button
              onClick={() => {
                markTip("extend");
                handleExtend();
              }}
              className="relative h-11 shrink-0 bg-ink px-3 text-[15px] font-bold text-white"
            >
              {!tips.extend && <TipDot />}
              未完成，延長 2 分鐘
            </button>
          </div>
        )}

        <div className="flex gap-5 border-y border-ink py-2.5 text-[17px] text-ink">
          <span>
            尚餘 <b className="tnum">{fmtDuration(totalRemain)}</b>
          </span>
          {buffer !== null ? (
            <span>
              緩衝{" "}
              <b className={buffer >= 0 ? "text-ok" : "text-danger"}>
                {buffer >= 0 ? `+${Math.floor(buffer / 60)} 分` : `遲 ${Math.ceil(-buffer / 60)} 分`}
              </b>
            </span>
          ) : (
            <span>
              預計 <b className="tnum">{fmtClock(now + totalRemain * 1000)}</b> 完成
            </span>
          )}
        </div>

        {!autoStep && <Ruler steps={ruleSteps} progress={progress} />}

        {nextDep ? (
          <div className="flex min-w-0 items-center gap-2 text-[15px] text-ink">
            <TransitBadge route={nextDep.route} />
            <span className="tnum truncate">
              {fmtClock(nextDep.dep.board)} 到站・<span className="text-sub">{fmtClock(nextDep.dep.leaveBy)} 前出門</span>
            </span>
          </div>
        ) : leaveTarget !== null ? (
          <div className="text-[15px] text-sub">{fmtClock(leaveTarget)} 出門</div>
        ) : null}
      </div>

      {/* 小按鈕 */}
      <div className="mx-3 mb-2 grid shrink-0 grid-cols-3 border-[1.5px] border-ink">
        <button
          onClick={handleBack}
          disabled={prevActiveIndex(s.steps, s.index) === -1}
          className="py-3 text-base font-bold text-ink disabled:text-faint"
        >
          上一步
        </button>
        <button
          onClick={() => onSession(togglePause(s, Date.now()))}
          className="border-x-[1.5px] border-ink py-3 text-base font-bold text-ink"
        >
          {paused ? "繼續" : "暫停"}
        </button>
        <button
          onClick={() => {
            markTip("panic");
            setTips((t) => ({ ...t, panic: true }));
            openPanic();
          }}
          className="relative bg-danger py-3 text-base font-bold text-white"
        >
          {!tips.panic && <TipDot light />}
          時間不足
        </button>
      </div>

      {/* 完成按鈕：佔畫面約 36% */}
      <button
        onClick={handleNext}
        className={`relative flex shrink-0 flex-col justify-center px-6 pb-[env(safe-area-inset-bottom)] text-left active:opacity-90 ${
          overtime ? "bg-danger text-white" : "bg-ink text-white"
        }`}
        style={{ height: "36dvh", minHeight: "35dvh" }}
      >
        <span className="absolute inset-x-0 top-0 h-1.5 bg-danger" />
        <span className="text-[2.6rem] font-extrabold leading-tight">{next ? "提早完成此步" : "全部完成，出門"}</span>
        <span className="mt-2 text-lg text-white/80">
          {next ? `下一站　${next.name}　${Math.round(next.plannedSec / 60)} 分鐘 →` : "按此結束計時"}
        </span>
      </button>

      {/* 時間不足 */}
      <Modal open={panicOpen} title="時間不足：一鍵壓縮" onClose={() => setPanicOpen(false)}>
        <label className="mb-2 block font-semibold text-ink" htmlFor="panic-min">
          距離出門尚有多少分鐘？
        </label>
        <div className="mb-3 flex items-center gap-3">
          <input
            id="panic-min"
            type="number"
            inputMode="numeric"
            min={0}
            value={panicMin}
            onChange={(e) => setPanicMin(e.target.value)}
            className="tnum h-14 w-24 border-[1.5px] border-ink bg-paper px-3 text-center text-2xl font-bold text-ink"
          />
          <span className="text-[15px] leading-snug text-sub">分鐘（餘下步驟需時 {Math.ceil(totalRemain / 60)} 分鐘）</span>
        </div>
        {plan && (
          <>
            <p className={`mb-3 font-semibold ${plan.mode === "enough" ? "text-ok" : "text-danger"}`}>{plan.message}</p>
            <ul className="mb-5 border-t border-ink">
              {plan.steps.map((st, i) =>
                i < s.index ? null : (
                  <li key={st.id} className="flex justify-between gap-3 border-b border-line py-2.5">
                    <span className={st.skip ? "text-faint" : "text-ink"}>
                      <span className={st.skip ? "line-through" : ""}>{st.name}</span>
                      {st.skip && <span className="ml-2 bg-danger px-1.5 py-0.5 text-xs font-bold text-white">建議跳過</span>}
                    </span>
                    <span className="tnum shrink-0 text-sub">
                      {st.skip
                        ? "0:00"
                        : i === s.index
                          ? `餘 ${fmtDuration(Math.max(0, st.plannedSec - elapsed))}`
                          : `${fmtDuration(s.steps[i].plannedSec)} → ${fmtDuration(st.plannedSec)}`}
                    </span>
                  </li>
                )
              )}
            </ul>
          </>
        )}
        <div className="flex gap-2">
          <button onClick={() => setPanicOpen(false)} className="h-14 flex-1 border-[1.5px] border-ink font-bold text-ink">
            取消
          </button>
          <button
            onClick={applyPanic}
            disabled={!plan || plan.mode === "enough"}
            className="h-14 flex-[2] bg-danger text-lg font-bold text-white disabled:opacity-40"
          >
            套用壓縮
          </button>
        </div>
      </Modal>

      <Modal open={exitOpen} title="結束今次流程？" onClose={() => setExitOpen(false)}>
        <p className="mb-5 leading-relaxed text-sub">已完成步驟的耗時紀錄會保留，用作學習你的實際速度。</p>
        <div className="flex gap-2">
          <button onClick={() => setExitOpen(false)} className="h-14 flex-1 border-[1.5px] border-ink font-bold text-ink">
            繼續計時
          </button>
          <button
            onClick={() => {
              stopSpeech();
              onExit();
            }}
            className="h-14 flex-1 bg-danger font-bold text-white"
          >
            結束
          </button>
        </div>
      </Modal>
    </main>
  );
}

/** 首次使用提示：閃動紅點，按過一次後消失 */
function TipDot({ light = false }: { light?: boolean }) {
  const c = light ? "#ffffff" : "#d52b1e";
  return (
    <svg className="pointer-events-none absolute -right-1.5 -top-1.5" width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <circle cx="9" cy="9" r="6" fill="none" stroke={c} strokeWidth="2">
        <animate attributeName="r" values="4;8.5" dur="1.2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <circle cx="9" cy="9" r="4.5" fill={light ? "#111" : "#d52b1e"} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}
