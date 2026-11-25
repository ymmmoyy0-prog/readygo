import type { Preset } from "./types";
import { uid } from "./id";

type Raw = [name: string, minutes: number, core: boolean];

function make(name: string, steps: Raw[]): Preset {
  return {
    id: uid(),
    name,
    updatedAt: Date.now(),
    steps: steps.map(([n, m, c]) => ({ id: uid(), name: n, minutes: m, core: c })),
  };
}

export function defaultPresets(): Preset[] {
  return [
    make("日常淡妝出門", [
      ["刷牙洗臉", 5, true],
      ["護膚防曬", 5, false],
      ["底妝遮瑕", 10, true],
      ["眉毛唇膏", 7, false],
      ["換衫執袋", 8, true],
    ]),
    make("完整全妝出門", [
      ["刷牙洗臉", 5, true],
      ["護膚妝前", 7, false],
      ["底妝修容", 15, true],
      ["眼妝睫毛", 18, false],
      ["換衫執袋", 10, true],
    ]),
    make("素顏極速出門", [
      ["洗臉護膚", 5, true],
      ["換衫執袋", 10, true],
    ]),
  ];
}
