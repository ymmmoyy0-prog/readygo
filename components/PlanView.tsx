"use client";
import { useState } from "react";
import type { Plan, Preset } from "@/lib/types";
import { dateTimeToEpoch, fmtClock, todayKey } from "@/lib/time";
import Flap from "./Flap";
import Ruler from "./Ruler";

export default function PlanView({
  presets,
  plan,
  defaultLeave,
  onSave,
  onClear,
  onBack,
}: {
  presets: Preset[];
  plan: Plan | null;
  defaultLeave: string;
  onSave: (p: Plan) => void;
  onClear: () => void;
  onBack: () => void;
}) {
  const now = Date.now();
  const today = todayKey(now);
  const tomorrow = todayKey(now, 1);
  const [date, setDate] = useState(plan?.date ?? (new Date(now).getHours() >= 15 ? tomorrow : today));
  const [presetId, setPresetId] = useState(plan?.presetId ?? presets[0]?.id ?? "");
  const [leaveTime, setLeaveTime] = useState(plan?.leaveTime ?? (defaultLeave || "08:30"));
  const [wake, setWake] = useState(plan?.wakeBufferMin ?? 10);

  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  const total = preset ? preset.steps.reduce((a, s) => a + s.minutes, 0) : 0;
  const leaveAt = dateTimeToEpoch(date, leaveTime);
  const startAt = leaveAt !== null ? leaveAt - total * 60_000 : null;
  const wakeAt = startAt !== null ? startAt - wake * 60_000 : null;

  let t = startAt ?? 0;
  const rows = preset
    ? preset.steps.map((s) => {
        const at = t;
        t += s.minutes * 60_000;
        return { name: s.name, at, minutes: s.minutes };
      })
    : [];

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-paper pb-32">
      <div className="border-b-[3px] border-ink px-5 pb-4 pt-4">
        <button onClick={onBack} className="h-10 text-[15px] font-semibold text-ink">
          ← 返回
        </button>
        <h1 className="mt-1 text-[1.6rem] font-extrabold leading-tight text-ink">預早計劃</h1>
        <p className="mt-1 text-[15px] leading-relaxed text-sub">輸入出門時間，計算應於何時起床及開始準備。</p>
      </div>

      {/* 日期 */}
      <section className="border-b border-ink px-5 py-4">
        <p className="mb-2 text-sm text-sub">日期</p>
        <div className="grid grid-cols-2 border-[1.5px] border-ink">
          {[
            [today, "今天"],
            [tomorrow, "明天"],
          ].map(([k, label], i) => (
            <button
              key={k}
              onClick={() => setDate(k)}
              className={`h-12 font-bold ${i === 1 ? "border-l-[1.5px] border-ink" : ""} ${
                date === k ? "bg-ink text-white" : "text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 模式 */}
      <section className="border-b border-ink px-5 py-4">
        <p className="mb-2 text-sm text-sub">出門模式</p>
        <div className="border-t border-line">
          {presets.map((p) => {
            const sum = p.steps.reduce((a, s) => a + s.minutes, 0);
            const on = p.id === preset?.id;
            return (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                className="flex w-full items-center gap-3 border-b border-line py-3 text-left"
              >
                <span className={`h-5 w-5 shrink-0 border-[1.5px] border-ink ${on ? "bg-ink" : ""}`} />
                <span className="flex-1 text-[17px] font-bold text-ink">{p.name}</span>
                <span className="tnum text-[15px] font-bold text-sub">{sum}′</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 出門時間與起床緩衝 */}
      <section className="grid grid-cols-2 border-b border-ink">
        <div className="px-5 py-4">
          <label htmlFor="plan-leave" className="block text-sm text-sub">
            出門時間
          </label>
          <div className="relative mt-1 inline-block">
            <Flap text={leaveTime || "--:--"} style={{ fontSize: 32 }} />
            <input
              id="plan-leave"
              type="time"
              value={leaveTime}
              onChange={(e) => setLeaveTime(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
        </div>
        <div className="border-l border-ink px-4 py-4">
          <p className="text-sm text-sub">起床緩衝</p>
          <div className="mt-1 flex items-center border-[1.5px] border-ink">
            <button onClick={() => setWake((w) => Math.max(0, w - 5))} className="h-11 w-11 text-xl text-ink" aria-label="減少五分鐘">
              −
            </button>
            <span className="tnum flex-1 text-center text-lg font-extrabold text-ink">{wake} 分</span>
            <button onClick={() => setWake((w) => Math.min(90, w + 5))} className="h-11 w-11 text-xl text-ink" aria-label="增加五分鐘">
              ＋
            </button>
          </div>
        </div>
      </section>

      {/* 結果 */}
      {preset && wakeAt !== null && startAt !== null && leaveAt !== null && (
        <section className="px-5 py-5">
          <div className="grid grid-cols-2 border-[1.5px] border-ink">
            <div className="bg-ink px-4 py-3 text-white">
              <p className="text-sm text-white/70">起床</p>
              <p className="tnum text-[2.2rem] font-extrabold leading-tight">{fmtClock(wakeAt)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-sub">開始準備</p>
              <p className="tnum text-[2.2rem] font-extrabold leading-tight text-ink">{fmtClock(startAt)}</p>
            </div>
          </div>

          <div className="mt-5">
            <Ruler steps={preset.steps} />
          </div>
          <ol className="mt-3 border-t border-ink">
            <li className="flex gap-4 border-b border-line py-2.5">
              <span className="tnum w-14 font-bold text-ink">{fmtClock(wakeAt)}</span>
              <span className="text-ink">起床{wake ? `（緩衝 ${wake} 分鐘）` : ""}</span>
            </li>
            {rows.map((r, i) => (
              <li key={i} className="flex gap-4 border-b border-line py-2.5">
                <span className="tnum w-14 font-bold text-ink">{fmtClock(r.at)}</span>
                <span className="flex-1 text-ink">{r.name}</span>
                <span className="tnum text-sub">{r.minutes}′</span>
              </li>
            ))}
            <li className="flex gap-4 border-b-[1.5px] border-ink py-2.5">
              <span className="tnum w-14 font-extrabold text-danger">{fmtClock(leaveAt)}</span>
              <span className="font-extrabold text-ink">出門</span>
            </li>
          </ol>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t-[1.5px] border-ink bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto flex max-w-lg gap-2">
          {plan && (
            <button onClick={onClear} className="h-14 flex-1 border-[1.5px] border-ink font-bold text-ink">
              取消計劃
            </button>
          )}
          <button
            disabled={!preset || !leaveTime}
            onClick={() => preset && onSave({ presetId: preset.id, leaveTime, wakeBufferMin: wake, date })}
            className="h-14 flex-[2] bg-ink text-lg font-bold text-white disabled:opacity-40"
          >
            儲存計劃
          </button>
        </div>
      </div>
    </main>
  );
}
