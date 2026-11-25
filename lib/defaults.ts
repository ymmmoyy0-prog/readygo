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
    key: "q20",
    name: "快手出門（20 分鐘）",
    blurb: "梳洗換衫就走",
    steps: [
      ["刷牙洗臉", 5, true],
      ["整理儀容", 4, false],
      ["換衫", 7, true],
      ["執袋・檢查鎖匙銀包", 4, true],
    ],
  },
  {
    key: "q30",
    name: "日常出門（30 分鐘）",
    blurb: "返工返學嘅日常",
    steps: [
      ["刷牙洗臉", 5, true],
      ["護膚整理", 5, false],
      ["整理頭髮", 5, false],
      ["換衫", 8, true],
      ["執袋・檢查鎖匙銀包", 4, true],
      ["熄燈關窗", 3, true],
    ],
  },
  {
    key: "q60",
    name: "從容出門（60 分鐘）",
    blurb: "沖涼食早餐慢慢嚟",
    steps: [
      ["沖涼", 15, false],
      ["刷牙洗臉", 5, true],
      ["食早餐", 15, false],
      ["整理儀容", 10, false],
      ["換衫", 8, true],
      ["執袋・檢查鎖匙銀包", 7, true],
    ],
  },
];

/** 私人化妝模板：唔喺新手引導顯示，只透過分享連結匯入（見 README） */
export const MAKEUP_TEMPLATES: Template[] = [
  {
    key: "light",
    name: "日常淡妝出門",
    blurb: "返工返學日常",
    steps: [
      ["刷牙洗臉", 5, true],
      ["護膚防曬", 5, false],
      ["底妝遮瑕", 10, true],
      ["眉毛唇膏", 7, false],
      ["換衫執袋", 8, true],
    ],
  },
  {
    key: "full",
    name: "完整全妝出門",
    blurb: "約會、飲宴、重要場合",
    steps: [
      ["刷牙洗臉", 5, true],
      ["護膚妝前", 7, false],
      ["底妝修容", 15, true],
      ["眼妝睫毛", 18, false],
      ["換衫執袋", 10, true],
    ],
  },
  {
    key: "bare",
    name: "素顏極速出門",
    blurb: "趕時間嘅日子",
    steps: [
      ["洗臉護膚", 5, true],
      ["換衫執袋", 10, true],
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
