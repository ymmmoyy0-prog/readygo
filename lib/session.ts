import type { Preset, RunStep, Session } from "./types";
import { uid } from "./id";

export function createSession(preset: Preset, targetLeave: number | null, now = Date.now()): Session {
  return {
    id: uid(),
    presetId: preset.id,
    presetName: preset.name,
    steps: preset.steps.map((s) => ({
      id: s.id,
      name: s.name,
      plannedSec: s.minutes * 60,
      origSec: s.minutes * 60,
      core: s.core,
      skip: false,
    })),
    index: 0,
    startedAt: now,
    stepStartedAt: now,
    pausedAt: null,
    pausedMs: 0,
    targetLeave,
    actuals: {},
    compressed: false,
    finishedAt: null,
  };
}

/** 當前步驟已用秒數（扣除暫停） */
export function stepElapsed(s: Session, now: number): number {
  const end = s.pausedAt ?? now;
  return Math.max(0, (end - s.stepStartedAt - s.pausedMs) / 1000);
}

export function nextActiveIndex(steps: RunStep[], from: number): number {
  for (let i = from + 1; i < steps.length; i++) if (!steps[i].skip) return i;
  return -1;
}

export function prevActiveIndex(steps: RunStep[], from: number): number {
  for (let i = from - 1; i >= 0; i--) if (!steps[i].skip) return i;
  return -1;
}

/** 總剩餘準備秒數：當前步驟剩餘（超時當 0）＋ 之後未跳過步驟 */
export function totalRemaining(s: Session, now: number): number {
  const cur = s.steps[s.index];
  let total = Math.max(0, cur.plannedSec - stepElapsed(s, now));
  for (let i = s.index + 1; i < s.steps.length; i++) if (!s.steps[i].skip) total += s.steps[i].plannedSec;
  return total;
}

export interface AdvanceResult {
  session: Session;
  record: { stepId: string; stepName: string; plannedSec: number; actualSec: number };
  finished: boolean;
}

export function advance(s: Session, now: number): AdvanceResult {
  const cur = s.steps[s.index];
  const actual = Math.round(stepElapsed(s, now));
  const next = nextActiveIndex(s.steps, s.index);
  const finished = next === -1;
  return {
    finished,
    record: { stepId: cur.id, stepName: cur.name, plannedSec: cur.origSec, actualSec: actual },
    session: {
      ...s,
      actuals: { ...s.actuals, [cur.id]: actual },
      index: finished ? s.index : next,
      stepStartedAt: now,
      pausedAt: null,
      pausedMs: 0,
      finishedAt: finished ? now : null,
      autoFrom: null,
    },
  };
}

/** 返回上一步：上一步的已用時間加上誤按後經過的時間一併歸還 */
export function goBack(s: Session, now: number): { session: Session; removedStepId: string } | null {
  const prev = prevActiveIndex(s.steps, s.index);
  if (prev === -1) return null;
  const prevStep = s.steps[prev];
  const carried = (s.actuals[prevStep.id] ?? 0) + stepElapsed(s, now);
  const actuals = { ...s.actuals };
  delete actuals[prevStep.id];
  return {
    removedStepId: prevStep.id,
    session: {
      ...s,
      actuals,
      index: prev,
      stepStartedAt: now - carried * 1000,
      pausedAt: null,
      pausedMs: 0,
      autoFrom: null,
    },
  };
}

export interface AutoResult {
  session: Session;
  records: { stepId: string; stepName: string; plannedSec: number; actualSec: number; at: number }[];
}

/**
 * 自動進入下一步：倒數歸零的步驟視為按預定時長完成。
 * App 在背景期間可能已過多個步驟，因此逐步推算。最後一步不會自動完成，改為顯示超時。
 */
export function autoAdvance(s: Session, now: number): AutoResult | null {
  if (s.pausedAt !== null || s.finishedAt) return null;
  let cur = s;
  const records: AutoResult["records"] = [];
  for (;;) {
    const step = cur.steps[cur.index];
    const next = nextActiveIndex(cur.steps, cur.index);
    if (next === -1) break;
    const endAt = cur.stepStartedAt + cur.pausedMs + step.plannedSec * 1000;
    if (endAt > now) break;
    const actual = Math.round(step.plannedSec);
    records.push({ stepId: step.id, stepName: step.name, plannedSec: step.origSec, actualSec: actual, at: endAt });
    cur = {
      ...cur,
      actuals: { ...cur.actuals, [step.id]: actual },
      index: next,
      stepStartedAt: endAt,
      pausedMs: 0,
      pausedAt: null,
      autoFrom: { index: cur.index, at: endAt },
    };
  }
  return records.length ? { session: cur, records } : null;
}

/** 未完成而被自動跳過：返回該步驟，並在已用時間上再加 addSec 秒 */
export function extendPrevious(s: Session, now: number, addSec = 120): { session: Session; removedStepId: string } | null {
  const r = goBack(s, now);
  if (!r) return null;
  const idx = r.session.index;
  const used = stepElapsed(r.session, now);
  const steps = r.session.steps.map((st, i) => (i === idx ? { ...st, plannedSec: Math.ceil(used) + addSec } : st));
  return { removedStepId: r.removedStepId, session: { ...r.session, steps, autoFrom: null } };
}

export function togglePause(s: Session, now: number): Session {
  if (s.pausedAt === null) return { ...s, pausedAt: now };
  return { ...s, pausedMs: s.pausedMs + (now - s.pausedAt), pausedAt: null };
}

/* ---------------- 緊急壓縮 ---------------- */

export interface CompressPlan {
  availableSec: number;
  neededSec: number;
  mode: "enough" | "scale" | "skip" | "impossible";
  steps: RunStep[];
  /** 套用後當前步驟的 plannedSec */
  currentPlannedSec: number;
  message: string;
}

const MIN_STEP_SEC = 60;

/**
 * 根據可用秒數壓縮尚未完成的步驟：
 * 1. 足夠時間：不變
 * 2. 比例 ≥ 60%：全部按比例縮短
 * 3. 否則：非核心步驟標記「建議跳過」，核心步驟按比例縮短
 */
export function planCompression(s: Session, availableSec: number, now: number): CompressPlan {
  const elapsed = stepElapsed(s, now);
  const cur = s.steps[s.index];
  const curRemain = Math.max(0, cur.plannedSec - elapsed);
  const pending = s.steps
    .map((st, i) => ({ st, i }))
    .filter(({ st, i }) => i > s.index && !st.skip);

  const neededSec = curRemain + pending.reduce((a, p) => a + p.st.plannedSec, 0);
  const steps = s.steps.map((st) => ({ ...st }));
  const avail = Math.max(0, availableSec);

  if (avail >= neededSec) {
    return {
      availableSec: avail,
      neededSec,
      mode: "enough",
      steps,
      currentPlannedSec: cur.plannedSec,
      message: "時間充裕，無須壓縮。",
    };
  }

  const ratio = neededSec > 0 ? avail / neededSec : 0;
  // 待處理項目（包括當前步驟餘下部分）
  type Item = { idx: number; remain: number; core: boolean };
  const items: Item[] = [
    { idx: s.index, remain: curRemain, core: true }, // 當前步驟已經開始，不建議跳過
    ...pending.map((p) => ({ idx: p.i, remain: p.st.plannedSec, core: p.st.core })),
  ];

  let mode: CompressPlan["mode"] = "scale";
  let keep = items;
  if (ratio < 0.6) {
    mode = "skip";
    keep = items.filter((it) => it.core);
    for (const it of items) if (!it.core) steps[it.idx].skip = true;
  }

  const keepTotal = keep.reduce((a, it) => a + it.remain, 0);
  const scale = keepTotal > 0 ? Math.min(1, avail / keepTotal) : 0;
  let resultTotal = 0;
  for (const it of keep) {
    const floor = it.idx === s.index ? Math.min(it.remain, 30) : MIN_STEP_SEC;
    const newRemain = Math.max(floor, Math.round((it.remain * scale) / 10) * 10);
    resultTotal += newRemain;
    if (it.idx === s.index) steps[it.idx].plannedSec = Math.round(elapsed + newRemain);
    else steps[it.idx].plannedSec = newRemain;
  }

  if (resultTotal > avail + 30) mode = "impossible";
  const skipped = items.filter((it) => steps[it.idx].skip).length;
  const message =
    mode === "impossible"
      ? `即使壓縮至最短，仍需約 ${Math.ceil(resultTotal / 60)} 分鐘，建議預先通知對方將會遲到。`
      : mode === "skip"
        ? `時間極度緊迫：建議跳過 ${skipped} 個可略過的步驟，其餘按比例壓縮至 ${Math.round(scale * 100)}%。`
        : `所有餘下步驟按比例壓縮至 ${Math.round(scale * 100)}%。`;

  return {
    availableSec: avail,
    neededSec,
    mode,
    steps,
    currentPlannedSec: steps[s.index].plannedSec,
    message,
  };
}

export function applyCompression(s: Session, plan: CompressPlan): Session {
  return { ...s, steps: plan.steps, compressed: plan.mode !== "enough" ? true : s.compressed };
}
