"use client";
import { useMemo, useState } from "react";
import type { Preset, Session, StepRecord } from "@/lib/types";
import { applySuggestions, getSuggestions } from "@/lib/stats";
import { fmtClock, fmtDuration } from "@/lib/time";

export default function SummaryView({
  session,
  preset,
  history,
  onUpdatePreset,
  onDone,
}: {
  session: Session;
  preset: Preset | null;
  history: StepRecord[];
  onUpdatePreset: (p: Preset) => void;
  onDone: () => void;
}) {
  const [updated, setUpdated] = useState(false);
  const suggestions = useMemo(() => (preset ? getSuggestions(preset, history) : []), [preset, history]);

  const rows = session.steps.map((st) => {
    const actual = session.actuals[st.id];
    return { ...st, actual: actual ?? null, diff: actual != null ? actual - st.origSec : null };
  });
  const plannedTotal = session.steps.reduce((a, s) => a + s.origSec, 0);
  const actualTotal = rows.reduce((a, r) => a + (r.actual ?? 0), 0);
  const totalDiff = actualTotal - plannedTotal;
  const endedAt = session.finishedAt ?? Date.now();
  const leaveDiff = session.targetLeave !== null ? (endedAt - session.targetLeave) / 1000 : null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-6">
      <h1 className="text-3xl font-black">完成！🎉</h1>
      <p className="mb-4 text-neutral-400">
        {session.presetName}・{fmtClock(session.startedAt)} 開始，{fmtClock(endedAt)} 完成
      </p>

      {leaveDiff !== null && (
        <div
          className={`mb-4 rounded-2xl p-4 text-xl font-bold ${
            leaveDiff <= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/20 text-red-300"
          }`}
        >
          {leaveDiff <= 0
            ? `比目標出門時間早 ${Math.floor(-leaveDiff / 60)} 分鐘 ✓`
            : `比目標出門時間遲 ${Math.ceil(leaveDiff / 60)} 分鐘`}
        </div>
      )}

      <section className="mb-4 rounded-2xl bg-neutral-900 p-4">
        <h2 className="mb-3 text-lg font-bold">預估 vs 實際耗時</h2>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2 text-base">
          <span className="text-sm text-neutral-500">步驟</span>
          <span className="text-right text-sm text-neutral-500">預估</span>
          <span className="text-right text-sm text-neutral-500">實際</span>
          <span className="text-right text-sm text-neutral-500">差距</span>
          {rows.map((r) => (
            <Row key={r.id} name={r.name} planned={r.origSec} actual={r.actual} diff={r.diff} skip={r.skip} />
          ))}
          <span className="border-t border-neutral-700 pt-2 font-bold">總計</span>
          <span className="tnum border-t border-neutral-700 pt-2 text-right font-bold">{fmtDuration(plannedTotal)}</span>
          <span className="tnum border-t border-neutral-700 pt-2 text-right font-bold">{fmtDuration(actualTotal)}</span>
          <span
            className={`tnum border-t border-neutral-700 pt-2 text-right font-bold ${
              totalDiff > 0 ? "text-red-400" : "text-emerald-300"
            }`}
          >
            {totalDiff > 0 ? "+" : "−"}
            {fmtDuration(Math.abs(totalDiff))}
          </span>
        </div>
      </section>

      {preset && suggestions.length > 0 && !updated && (
        <section className="mb-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4">
          <h2 className="mb-2 text-lg font-bold text-amber-300">你可能低估咗呢啲步驟</h2>
          <ul className="mb-3 space-y-2 text-neutral-200">
            {suggestions.map((s) => (
              <li key={s.stepId}>
                <span className="font-semibold">{s.name}</span>：預設 {s.plannedMin} 分鐘，最近 {s.samples} 次平均{" "}
                {fmtDuration(s.avgSec)}
                <span className="block text-sm text-neutral-400">
                  {s.reason}，建議改為 {s.suggestedMin} 分鐘
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              onUpdatePreset(applySuggestions(preset, suggestions));
              setUpdated(true);
            }}
            className="h-14 w-full rounded-2xl bg-amber-400 text-lg font-bold text-black"
          >
            一鍵更新為實際平均時間
          </button>
        </section>
      )}
      {updated && (
        <p className="mb-4 rounded-2xl bg-emerald-500/15 p-4 font-semibold text-emerald-300">
          ✓ 已更新「{preset?.name}」嘅步驟時間
        </p>
      )}

      <button onClick={onDone} className="h-16 w-full rounded-2xl bg-lime-400 text-xl font-bold text-black">
        返回主頁
      </button>
    </main>
  );
}

function Row({
  name,
  planned,
  actual,
  diff,
  skip,
}: {
  name: string;
  planned: number;
  actual: number | null;
  diff: number | null;
  skip: boolean;
}) {
  const over = diff !== null && diff > planned * 0.2;
  return (
    <>
      <span className={`truncate ${skip ? "text-neutral-500 line-through" : ""}`}>{name}</span>
      <span className="tnum text-right text-neutral-400">{fmtDuration(planned)}</span>
      <span className="tnum text-right">{actual !== null ? fmtDuration(actual) : skip ? "跳過" : "—"}</span>
      <span
        className={`tnum text-right font-semibold ${
          diff === null ? "text-neutral-600" : over ? "text-red-400" : diff > 0 ? "text-amber-300" : "text-emerald-300"
        }`}
      >
        {diff === null ? "" : `${diff > 0 ? "+" : "−"}${fmtDuration(Math.abs(diff))}`}
      </span>
    </>
  );
}
