import { MTR_LINES, mtrIndex, mtrLine } from "./mtr";

/** 每段行車分鐘（估算）：未列出的站距使用該綫預設值 */
const DEFAULT_HOP: Record<string, number> = {
  TWL: 2, ISL: 2, KTL: 2, TKL: 2.5, EAL: 3, TML: 2.5, TCL: 3, AEL: 4, SIL: 2.5, DRL: 4,
};
const HOP: Record<string, number> = {
  "TKL:NOP-QUB": 2, "TKL:QUB-YAT": 4, "TKL:TKO-LHP": 3,
  "SIL:ADM-OCP": 4,
  "EAL:ADM-EXC": 3, "EAL:EXC-HUH": 4, "EAL:HUH-MKK": 3, "EAL:MKK-KOT": 3, "EAL:KOT-TAW": 4, "EAL:TAW-SHT": 2,
  "EAL:SHT-FOT": 3, "EAL:FOT-RAC": 2, "EAL:RAC-UNI": 2, "EAL:UNI-TAP": 5, "EAL:TAP-TWO": 2, "EAL:TWO-FAN": 5,
  "EAL:FAN-SHS": 2, "EAL:SHS-LOW": 4, "EAL:SHS-LMC": 6,
  "TML:TAW-HIK": 3, "TML:HIK-DIH": 3, "TML:NAC-MEF": 3, "TML:MEF-TWW": 4, "TML:TWW-KSR": 7, "TML:KSR-YUL": 3,
  "TCL:HOK-KOW": 3, "TCL:KOW-OLY": 2, "TCL:OLY-NAC": 2, "TCL:NAC-LAK": 4, "TCL:LAK-TSY": 3, "TCL:TSY-SUN": 4, "TCL:SUN-TUC": 4,
  "AEL:HOK-KOW": 3, "AEL:KOW-TSY": 6, "AEL:TSY-AIR": 13, "AEL:AIR-AWE": 2,
};
/** 同站轉綫（連候車） */
const TRANSFER_MIN = 4;
/** 站外通道轉乘 */
const WALK_LINKS: [string, string, number][] = [
  ["CEN", "HOK", 8],
  ["TST", "ETS", 7],
];
/** 支綫：實際相鄰關係與車站清單次序不同 */
const EXTRA_ADJ: Record<string, [string, string][]> = {
  TKL: [["TKO", "LHP"]],
  EAL: [["SHS", "LMC"]],
};
const SKIP_ADJ: Record<string, [string, string][]> = {
  TKL: [["POA", "LHP"]],
  EAL: [["LOW", "LMC"]],
};

export interface MtrLeg {
  line: string;
  from: string;
  to: string;
  dir: "UP" | "DOWN";
  stops: number;
  minutes: number;
}

export interface MtrJourney {
  legs: MtrLeg[];
  /** 乘車總分鐘（包括轉綫） */
  minutes: number;
}

const hopKey = (line: string, a: string, b: string) => HOP[`${line}:${a}-${b}`] ?? HOP[`${line}:${b}-${a}`];

type Edge = { to: string; w: number; line?: string };

let graph: Map<string, Edge[]> | null = null;

function build() {
  const g = new Map<string, Edge[]>();
  const add = (a: string, b: string, w: number, line?: string) => {
    (g.get(a) ?? g.set(a, []).get(a)!).push({ to: b, w, line });
    (g.get(b) ?? g.set(b, []).get(b)!).push({ to: a, w, line });
  };
  const byStation = new Map<string, string[]>();
  for (const l of MTR_LINES) {
    const skip = new Set((SKIP_ADJ[l.code] ?? []).map(([a, b]) => `${a}-${b}`));
    const pairs: [string, string][] = [];
    for (let i = 1; i < l.stations.length; i++) {
      const a = l.stations[i - 1][0];
      const b = l.stations[i][0];
      if (!skip.has(`${a}-${b}`)) pairs.push([a, b]);
    }
    pairs.push(...(EXTRA_ADJ[l.code] ?? []));
    for (const [a, b] of pairs) add(`${l.code}:${a}`, `${l.code}:${b}`, hopKey(l.code, a, b) ?? DEFAULT_HOP[l.code], l.code);
    for (const [c] of l.stations) (byStation.get(c) ?? byStation.set(c, []).get(c)!).push(l.code);
  }
  for (const [sta, lines] of byStation) {
    for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) add(`${lines[i]}:${sta}`, `${lines[j]}:${sta}`, TRANSFER_MIN);
  }
  for (const [a, b, w] of WALK_LINKS) {
    for (const la of byStation.get(a) ?? []) for (const lb of byStation.get(b) ?? []) add(`${la}:${a}`, `${lb}:${b}`, w);
  }
  return g;
}

/** 所有車站（去重），按綫分組供選擇 */
export function allStations(): { code: string; name: string; lines: string[] }[] {
  const m = new Map<string, { code: string; name: string; lines: string[] }>();
  for (const l of MTR_LINES) for (const [c, n] of l.stations) {
    const e = m.get(c) ?? { code: c, name: n, lines: [] };
    e.lines.push(l.code);
    m.set(c, e);
  }
  return [...m.values()];
}

export const stationName = (code: string) => allStations().find((s) => s.code === code)?.name ?? code;

/** 最短行程（Dijkstra），可跨綫 */
export function planMtr(from: string, to: string): MtrJourney | null {
  if (from === to) return null;
  graph ??= build();
  // 機場快綫票價較高：只在往返機場／博覽館時使用
  const allowAel = ["AIR", "AWE"].includes(from) || ["AIR", "AWE"].includes(to);
  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const starts = [...graph.keys()].filter((k) => k.endsWith(`:${from}`));
  const queue: [string, number][] = starts.map((s) => [s, 0]);
  starts.forEach((s) => dist.set(s, 0));
  while (queue.length) {
    queue.sort((a, b) => a[1] - b[1]);
    const [u, d] = queue.shift()!;
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (const e of graph.get(u) ?? []) {
      if (!allowAel && e.to.startsWith("AEL:")) continue;
      const nd = d + e.w;
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, u);
        queue.push([e.to, nd]);
      }
    }
  }
  const ends = [...dist.keys()].filter((k) => k.endsWith(`:${to}`)).sort((a, b) => dist.get(a)! - dist.get(b)!);
  if (!ends.length) return null;
  const path: string[] = [];
  for (let n: string | undefined = ends[0]; n; n = prev.get(n)) path.unshift(n);

  // 合併為各段乘車
  const legs: MtrLeg[] = [];
  let extra = 0;
  for (let i = 1; i < path.length; i++) {
    const [la, sa] = path[i - 1].split(":");
    const [lb, sb] = path[i].split(":");
    if (la !== lb) continue; // 轉綫或通道
    const w = graph.get(path[i - 1])!.find((e) => e.to === path[i])!.w;
    const l = mtrLine(la)!;
    const hopDir = mtrIndex(l, sb) > mtrIndex(l, sa) ? "UP" : "DOWN";
    const last = legs[legs.length - 1];
    // 同綫但方向改變（例如康城經將軍澳往坑口）須在分岔站轉車
    if (last && last.line === la && last.to === sa && last.dir !== hopDir) extra += TRANSFER_MIN;
    if (last && last.line === la && last.to === sa && last.dir === hopDir) {
      last.to = sb;
      last.stops += 1;
      last.minutes += w;
    } else {
      legs.push({ line: la, from: sa, to: sb, dir: hopDir, stops: 1, minutes: w });
    }
  }
  return { legs, minutes: Math.round(dist.get(ends[0])! + extra) };
}
