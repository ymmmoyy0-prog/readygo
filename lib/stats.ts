import type { Preset, StepRecord } from "./types";

export interface Suggestion {
  stepId: string;
  name: string;
  plannedMin: number;
  avgSec: number;
  samples: number;
  suggestedMin: number;
  reason: string;
}

const WINDOW = 5;
const OVER = 1.2;

/**
 * 每個步驟取最近 5 次紀錄：
 * 最近連續 2 次都超時 20% 以上，或平均超出預設 20% 以上 → 建議更新
 */
export function getSuggestions(preset: Preset, history: StepRecord[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const step of preset.steps) {
    const planned = step.minutes * 60;
    const recs = history
      .filter((r) => r.presetId === preset.id && r.stepId === step.id)
      .sort((a, b) => a.at - b.at)
      .slice(-WINDOW);
    if (recs.length < 2) continue;
    const avg = recs.reduce((a, r) => a + r.actualSec, 0) / recs.length;
    const lastTwo = recs.slice(-2);
    const consecutive = lastTwo.every((r) => r.actualSec > planned * OVER);
    const avgOver = avg > planned * OVER;
    if (!consecutive && !avgOver) continue;
    const suggestedMin = Math.max(step.minutes + 1, Math.ceil(avg / 60));
    out.push({
      stepId: step.id,
      name: step.name,
      plannedMin: step.minutes,
      avgSec: avg,
      samples: recs.length,
      suggestedMin,
      reason: consecutive ? "最近連續 2 次超時 20% 以上" : `最近 ${recs.length} 次平均超時 20% 以上`,
    });
  }
  return out;
}

export function applySuggestions(preset: Preset, sugg: Suggestion[]): Preset {
  const map = new Map(sugg.map((s) => [s.stepId, s.suggestedMin]));
  return {
    ...preset,
    updatedAt: Date.now(),
    steps: preset.steps.map((s) => (map.has(s.id) ? { ...s, minutes: map.get(s.id)! } : s)),
  };
}
