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
    },
  };
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
      message: "時間仲夠，唔使壓縮。",
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
      ? `就算壓到最短都要約 ${Math.ceil(resultTotal / 60)} 分鐘，建議通知對方會遲到。`
      : mode === "skip"
        ? `時間極度緊迫：${skipped} 個非核心步驟建議跳過，其餘按比例壓縮至 ${Math.round(scale * 100)}%。`
        : `所有剩餘步驟按比例壓縮至 ${Math.round(scale * 100)}%。`;

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
