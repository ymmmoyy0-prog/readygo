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
      <p className="text-sm font-semibold tracking-wide text-brand">完成</p>
      <h1 className="text-[1.85rem] font-extrabold leading-tight text-ink">今次用咗 {Math.round(actualTotal / 60)} 分鐘</h1>
      <p className="mb-5 mt-1 text-[15px] text-sub">
        {session.presetName}・{fmtClock(session.startedAt)} 開始，{fmtClock(endedAt)} 完成
      </p>

      {leaveDiff !== null && (
        <div
          className={`mb-4 rounded-3xl p-4 text-lg font-bold ${
            leaveDiff <= 0 ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"
          }`}
        >
          {leaveDiff <= 0
            ? `比目標出門時間早 ${Math.floor(-leaveDiff / 60)} 分鐘 ✓`
            : `比目標出門時間遲 ${Math.ceil(leaveDiff / 60)} 分鐘`}
        </div>
      )}

      <section className="card mb-4 p-4">
        <h2 className="mb-3 text-lg font-bold text-ink">預估 vs 實際耗時</h2>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2.5 text-base text-ink">
          <span className="text-[13px] font-semibold text-sub">步驟</span>
          <span className="text-right text-[13px] font-semibold text-sub">預估</span>
          <span className="text-right text-[13px] font-semibold text-sub">實際</span>
          <span className="text-right text-[13px] font-semibold text-sub">差距</span>
          {rows.map((r) => (
            <Row key={r.id} name={r.name} planned={r.origSec} actual={r.actual} diff={r.diff} skip={r.skip} />
          ))}
          <span className="border-t border-line pt-2 font-bold">總計</span>
          <span className="tnum border-t border-line pt-2 text-right font-bold">{fmtDuration(plannedTotal)}</span>
          <span className="tnum border-t border-line pt-2 text-right font-bold">{fmtDuration(actualTotal)}</span>
          <span
            className={`tnum border-t border-line pt-2 text-right font-bold ${
              totalDiff > 0 ? "text-danger" : "text-ok"
            }`}
          >
            {totalDiff > 0 ? "+" : "−"}
            {fmtDuration(Math.abs(totalDiff))}
          </span>
        </div>
      </section>

      {preset && suggestions.length > 0 && !updated && (
        <section className="mb-4 rounded-3xl border border-warn/25 bg-warn-soft p-4">
          <h2 className="mb-2 text-lg font-bold text-warn">你可能低估咗呢啲步驟</h2>
          <ul className="mb-3 space-y-2 leading-relaxed text-ink">
            {suggestions.map((s) => (
              <li key={s.stepId}>
                <span className="font-semibold">{s.name}</span>：預設 {s.plannedMin} 分鐘，最近 {s.samples} 次平均{" "}
                {fmtDuration(s.avgSec)}
                <span className="block text-sm text-sub">
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
            className="h-14 w-full rounded-2xl bg-warn text-lg font-bold text-white"
          >
            一鍵更新為實際平均時間
          </button>
        </section>
      )}
      {updated && (
        <p className="mb-4 rounded-3xl bg-ok-soft p-4 font-semibold text-ok">
          ✓ 已更新「{preset?.name}」嘅步驟時間
        </p>
      )}

      <button onClick={onDone} className="h-16 w-full rounded-2xl bg-brand text-xl font-bold text-white active:bg-brand-strong">
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
      <span className={`truncate ${skip ? "text-faint line-through" : ""}`}>{name}</span>
      <span className="tnum text-right text-sub">{fmtDuration(planned)}</span>
      <span className="tnum text-right">{actual !== null ? fmtDuration(actual) : skip ? "跳過" : "—"}</span>
      <span
        className={`tnum text-right font-semibold ${
          diff === null ? "text-faint" : over ? "text-danger" : diff > 0 ? "text-warn" : "text-ok"
        }`}
      >
        {diff === null ? "" : `${diff > 0 ? "+" : "−"}${fmtDuration(Math.abs(diff))}`}
      </span>
    </>
  );
}
