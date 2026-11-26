import type { Preset, Step } from "./types";
import { uid } from "./id";

type Raw = [name: string, minutes: number, core: boolean];

export interface Template {
  key: string;
  name: string;
  blurb: string;
  steps: Raw[];
}

/** 新手快速模板：只需揀「出門前幾耐」，用字中性，唔假設用戶會化妝 */
export const QUICK_TEMPLATES: Template[] = [
  {
    key: "q15",
    name: "快速出門",
    blurb: "梳洗更衣後即出發",
    steps: [
      ["刷牙洗臉", 4, true],
      ["整理儀容", 3, false],
      ["更衣", 5, true],
      ["收拾隨身物品", 3, true],
    ],
  },
  {
    key: "q30",
    name: "日常出門",
    blurb: "上班上學的日常準備",
    steps: [
      ["刷牙洗臉", 5, true],
      ["護膚整理", 5, false],
      ["整理頭髮", 5, false],
      ["更衣", 8, true],
      ["收拾隨身物品", 4, true],
      ["關燈關窗", 3, true],
    ],
  },
  {
    key: "q60",
    name: "從容出門",
    blurb: "沐浴、早餐，從容準備",
    steps: [
      ["沐浴", 15, false],
      ["刷牙洗臉", 5, true],
      ["早餐", 15, false],
      ["整理儀容", 10, false],
      ["更衣", 8, true],
      ["收拾隨身物品", 7, true],
    ],
  },
];

/** 私人化妝模板：唔喺新手引導顯示，只透過分享連結匯入（見 README） */
export const MAKEUP_TEMPLATES: Template[] = [
  {
    key: "light",
    name: "日常淡妝出門",
    blurb: "上班上學日常",
    steps: [
      ["刷牙洗臉", 5, true],
      ["護膚防曬", 5, false],
      ["底妝遮瑕", 10, true],
      ["眉毛唇膏", 7, false],
      ["更衣及收拾手袋", 8, true],
    ],
  },
  {
    key: "full",
    name: "完整全妝出門",
    blurb: "約會、宴會等重要場合",
    steps: [
      ["刷牙洗臉", 5, true],
      ["護膚妝前", 7, false],
      ["底妝修容", 15, true],
      ["眼妝睫毛", 18, false],
      ["更衣及收拾手袋", 10, true],
    ],
  },
  {
    key: "bare",
    name: "素顏極速出門",
    blurb: "趕時間的日子",
    steps: [
      ["洗臉護膚", 5, true],
      ["更衣及收拾手袋", 10, true],
    ],
  },
];

export function fromTemplate(t: Template): Preset {
  return {
    id: uid(),
    name: t.name,
    updatedAt: Date.now(),
    steps: t.steps.map(([n, m, c]) => ({ id: uid(), name: n, minutes: m, core: c })),
  };
}

export function blankPreset(): Preset {
  return {
    id: uid(),
    name: "",
    updatedAt: Date.now(),
    steps: [
      { id: uid(), name: "", minutes: 5, core: true },
      { id: uid(), name: "", minutes: 5, core: true },
    ],
  };
}

export function defaultPresets(): Preset[] {
  return QUICK_TEMPLATES.map(fromTemplate);
}

/** 以最接近嘅快速模板為基礎，按比例縮放到自訂總分鐘數 */
export function presetForTotal(total: number): Preset {
  const base = [...QUICK_TEMPLATES].sort(
    (a, b) => Math.abs(templateTotal(a) - total) - Math.abs(templateTotal(b) - total)
  )[0];
  const p = fromTemplate(base);
  return { ...p, name: `出門前 ${total} 分鐘`, steps: scaleSteps(p.steps, total) };
}

export const templateTotal = (t: Template) => t.steps.reduce((a, s) => a + s[1], 0);

/** 按比例把步驟縮放到指定總分鐘數（每步最少 1 分鐘，總和準確） */
export function scaleSteps(steps: Step[], total: number): Step[] {
  const cur = steps.reduce((a, s) => a + s.minutes, 0);
  if (cur <= 0 || steps.length === 0) return steps;
  const target = Math.max(total, steps.length);
  const out = steps.map((s) => ({ ...s, minutes: Math.max(1, Math.round((s.minutes * target) / cur)) }));
  let diff = target - out.reduce((a, s) => a + s.minutes, 0);
  const order = [...out.keys()].sort((a, b) => out[b].minutes - out[a].minutes);
  let i = 0;
  while (diff !== 0 && i < 1000) {
    const idx = order[i % order.length];
    if (diff > 0) {
      out[idx].minutes += 1;
      diff -= 1;
    } else if (out[idx].minutes > 1) {
      out[idx].minutes -= 1;
      diff += 1;
    }
    i++;
  }
  return out;
}

/** 舊版「快速出門」（20 分鐘，未經修改）更新為 15 分鐘 */
export function migrateQuick15(list: Preset[]): { list: Preset[]; changed: boolean } {
  const oldNames = ["刷牙洗臉", "整理儀容", "更衣", "收拾隨身物品"];
  const oldMins = [5, 4, 7, 4];
  const newMins = [4, 3, 5, 3];
  let changed = false;
  const out = list.map((p) => {
    const same =
      (p.name === "快速出門" || p.name.startsWith("快手出門")) &&
      p.steps.length === 4 &&
      p.steps.every((s, i) => s.name === oldNames[i] && s.minutes === oldMins[i]);
    if (!same) return p;
    changed = true;
    return { ...p, name: "快速出門", updatedAt: Date.now(), steps: p.steps.map((s, i) => ({ ...s, minutes: newMins[i] })) };
  });
  return { list: out, changed };
}
