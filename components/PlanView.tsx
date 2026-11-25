"use client";
import { useState } from "react";
import type { Plan, Preset, Settings, TimeMode } from "@/lib/types";
import { dateTimeToEpoch, fmtClock, todayKey } from "@/lib/time";
import { doorToDoorMin } from "@/lib/target";
import TimeField from "./TimeField";
import TransitBadge from "./TransitBadge";

export default function PlanView({
  presets,
  settings,
  onSave,
  onClear,
  onBack,
}: {
  presets: Preset[];
  settings: Settings;
  onSave: (p: Plan) => void;
  onClear: () => void;
  onBack: () => void;
}) {
  const plan = settings.plan;
  const now = Date.now();
  const today = todayKey(now);
  const tomorrow = todayKey(now, 1);
  const [date, setDate] = useState(plan?.date ?? (new Date(now).getHours() >= 15 ? tomorrow : today));
  const [presetId, setPresetId] = useState(plan?.presetId ?? presets[0]?.id ?? "");
  const [mode, setMode] = useState<TimeMode>(plan?.mode ?? settings.timeMode);
  const [time, setTime] = useState(plan?.time ?? ((mode === "arrive" ? settings.arriveTime : settings.leaveTime) || "08:30"));
  const [wake, setWake] = useState(plan?.wakeBufferMin ?? 10);

  const preset = presets.find((p) => p.id === presetId) ?? presets[0];
  const total = preset ? preset.steps.reduce((a, s) => a + s.minutes, 0) : 0;
  const at = dateTimeToEpoch(date, time);
  const travel = doorToDoorMin(settings);
  const leaveAt = at === null ? null : mode === "arrive" ? at - travel * 60_000 : at;
  const startAt = leaveAt !== null ? leaveAt - total * 60_000 : null;
  const alarmAt = startAt !== null ? startAt - wake * 60_000 : null;
  const route = settings.transit.primary;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-paper pb-28">
      <div className="flex items-center justify-between border-b-[3px] border-ink px-4 py-3">
        <button onClick={onBack} className="h-10 font-semibold text-ink">
          ← 返回
        </button>
        <b className="text-ink">計劃</b>
        <span className="w-12" />
      </div>

      <div className="grid grid-cols-2 border-b border-ink">
        {[
          [today, "今天"],
          [tomorrow, "明天"],
        ].map(([k, label], i) => (
          <button
            key={k}
            onClick={() => setDate(k)}
            className={`h-12 font-bold ${i ? "border-l border-ink" : ""} ${date === k ? "bg-ink text-white" : "text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block border-b border-line px-5 py-3">
        <span className="block text-[13px] text-sub">出門模式</span>
        <select
          value={preset?.id}
          onChange={(e) => setPresetId(e.target.value)}
          className="mt-1 w-full appearance-none bg-transparent text-lg font-extrabold text-ink"
        >
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}（{p.steps.reduce((a, s) => a + s.minutes, 0)} 分鐘）
            </option>
          ))}
        </select>
      </label>

      <div className="border-b border-line px-5 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[13px] text-sub">{mode === "arrive" ? "到達時間" : "出門時間"}</span>
          <button
            onClick={() => setMode(mode === "arrive" ? "leave" : "arrive")}
            className="text-[13px] font-semibold text-ink underline underline-offset-4"
          >
            改用{mode === "arrive" ? "出門時間" : "到達時間"}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <TimeField id="plan-time" value={time} onChange={setTime} size={32} />
          {mode === "arrive" && (
            <span className="flex min-w-0 items-center gap-1.5 text-[14px] text-sub">
              {route && <TransitBadge route={route} />}
              <span className="shrink-0">路程約 {travel} 分</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-ink px-5 py-3">
        <span>
          <span className="block text-[13px] text-sub">起床緩衝</span>
          <span className="tnum text-lg font-extrabold text-ink">{wake} 分鐘</span>
        </span>
        <span className="flex border-[1.5px] border-ink">
          <button onClick={() => setWake((w) => Math.max(0, w - 5))} className="h-10 w-11 text-xl text-ink" aria-label="減少五分鐘">
            −
          </button>
          <button
            onClick={() => setWake((w) => Math.min(90, w + 5))}
            className="h-10 w-11 border-l-[1.5px] border-ink text-xl text-ink"
            aria-label="增加五分鐘"
          >
            ＋
          </button>
        </span>
      </div>

      {alarmAt !== null && startAt !== null && leaveAt !== null && (
        <section className="px-5 py-5">
          <div className="bg-ink px-5 py-4 text-white">
            <p className="text-sm text-white/70">建議鬧鐘</p>
            <p className="tnum text-[3.4rem] font-extrabold leading-tight">{fmtClock(alarmAt)}</p>
          </div>
          <div className="grid grid-cols-2 border-[1.5px] border-t-0 border-ink">
            <div className="px-4 py-3">
              <p className="text-[13px] text-sub">開始準備</p>
              <p className="tnum text-[1.6rem] font-extrabold text-ink">{fmtClock(startAt)}</p>
            </div>
            <div className="border-l-[1.5px] border-ink px-4 py-3">
              <p className="text-[13px] text-sub">出門</p>
              <p className="tnum text-[1.6rem] font-extrabold text-ink">{fmtClock(leaveAt)}</p>
            </div>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-sub">
            請自行將鬧鐘設定為 {fmtClock(alarmAt)}。
            {mode === "arrive" && "路程按平日估算，出門前會以實時班次更新。"}
          </p>
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
            disabled={!preset || !time}
            onClick={() => preset && onSave({ presetId: preset.id, mode, time, wakeBufferMin: wake, date })}
            className="h-14 flex-[2] bg-ink text-lg font-bold text-white disabled:opacity-40"
          >
            儲存計劃
          </button>
        </div>
      </div>
    </main>
  );
}
