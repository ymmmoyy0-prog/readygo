import { mtrIndex, mtrLine, trainServes } from "./mtr";
import type { MtrLeg } from "./mtrRoute";

export type Company = "KMB" | "CTB" | "MTR" | "CAR";

export interface RouteCfg {
  co: Company;
  /** 巴士路線號碼，或港鐵綫代號 */
  route: string;
  /** 巴士：O／I；港鐵：UP／DOWN */
  dir: string;
  /** 九巴特別班次編號，其他為 "1" */
  serviceType: string;
  /** 方向描述，例如「往尖沙咀碼頭」 */
  destName: string;
  from: { id: string; name: string; seq: number };
  to: { id: string; name: string; seq: number };
  walkToMin: number;
  walkFromMin: number;
  /** 乘車分鐘（駕駛時為車程）：實時追蹤成功時自動更新 */
  rideMin: number;
  /** 用戶手動修改過乘車分鐘，不再自動更新 */
  rideManual?: boolean;
  /** 港鐵分段行程（可跨綫） */
  legs?: MtrLeg[];
  /** 巴士：上車站至下車站之間所有站（城巴逐站追蹤用） */
  path?: string[];
}

export interface TransitSettings {
  doorBufferMin: number;
  primary: RouteCfg | null;
  backup: RouteCfg | null;
}

export const defaultTransit: TransitSettings = { doorBufferMin: 4, primary: null, backup: null };

export const CO_LABEL: Record<Company, string> = { KMB: "九巴", CTB: "城巴", MTR: "港鐵", CAR: "駕駛" };

const KMB = "https://data.etabus.gov.hk/v1/transport/kmb";
const CTB = "https://rt.data.gov.hk/v2/transport/citybus";
const MTR = "https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 429) throw new Error("查詢過於頻繁，請稍後再試");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/* ---------------- 路線及站點（設定用） ---------------- */

export interface RouteOption {
  co: Company;
  route: string;
  dir: string;
  serviceType: string;
  orig: string;
  dest: string;
}

let kmbRoutes: RouteOption[] | null = null;
let ctbRoutes: RouteOption[] | null = null;

export async function searchRoutes(co: "KMB" | "CTB", q: string): Promise<RouteOption[]> {
  const key = q.trim().toUpperCase();
  if (!key) return [];
  if (co === "KMB") {
    if (!kmbRoutes) {
      const d = await getJson<{ data: { route: string; bound: string; service_type: string; orig_tc: string; dest_tc: string }[] }>(
        `${KMB}/route/`
      );
      kmbRoutes = d.data.map((r) => ({
        co: "KMB",
        route: r.route,
        dir: r.bound,
        serviceType: r.service_type,
        orig: r.orig_tc,
        dest: r.dest_tc,
      }));
    }
    return kmbRoutes.filter((r) => r.route === key).sort((a, b) => Number(a.serviceType) - Number(b.serviceType));
  }
  if (!ctbRoutes) {
    const d = await getJson<{ data: { route: string; orig_tc: string; dest_tc: string }[] }>(`${CTB}/route/CTB`);
    ctbRoutes = d.data.flatMap((r) => [
      { co: "CTB" as const, route: r.route, dir: "O", serviceType: "1", orig: r.orig_tc, dest: r.dest_tc },
      { co: "CTB" as const, route: r.route, dir: "I", serviceType: "1", orig: r.dest_tc, dest: r.orig_tc },
    ]);
  }
  return ctbRoutes.filter((r) => r.route === key);
}

export interface StopOption {
  id: string;
  name: string;
  seq: number;
  lat?: number;
  lng?: number;
}

const BOUND = { O: "outbound", I: "inbound" } as Record<string, string>;

export async function routeStops(r: RouteOption): Promise<StopOption[]> {
  if (r.co === "KMB") {
    const rs = await getJson<{ data: { stop: string; seq: string }[] }>(
      `${KMB}/route-stop/${r.route}/${BOUND[r.dir]}/${r.serviceType}`
    );
    const info = await Promise.all(rs.data.map((s) => getJson<{ data: StopInfo }>(`${KMB}/stop/${s.stop}`).then((d) => d.data)));
    return rs.data.map((s, i) => toStop(s.stop, Number(s.seq), info[i]));
  }
  const rs = await getJson<{ data: { stop: string; seq: number }[] }>(`${CTB}/route-stop/CTB/${r.route}/${BOUND[r.dir]}`);
  const info = await Promise.all(rs.data.map((s) => getJson<{ data: StopInfo }>(`${CTB}/stop/${s.stop}`).then((d) => d.data)));
  return rs.data.map((s, i) => toStop(s.stop, Number(s.seq), info[i]));
}

type StopInfo = { name_tc: string; lat: string; long: string };
const toStop = (id: string, seq: number, d: StopInfo): StopOption => ({
  id,
  seq,
  name: d.name_tc,
  lat: Number(d.lat),
  lng: Number(d.long),
});

function haversine(a: StopOption, b: StopOption) {
  if (a.lat === undefined || b.lat === undefined || a.lng === undefined || b.lng === undefined) return 0;
  const r = Math.PI / 180;
  const dLa = (b.lat - a.lat) * r;
  const dLo = (b.lng - a.lng) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}

/** 巴士初始乘車估算：站距總和 × 1.25（路面繞行）÷ 時速 18 公里，另每站停靠 0.3 分鐘；之後以實時追蹤更新 */
export function estimateBusRide(stops: StopOption[], fromIdx: number, toIdx: number) {
  let m = 0;
  for (let i = fromIdx + 1; i <= toIdx; i++) m += haversine(stops[i - 1], stops[i]);
  const n = toIdx - fromIdx;
  if (!m) return defaultRideMin("KMB", n);
  return Math.max(2, Math.round(((m * 1.25) / 1000 / 18) * 60 + n * 0.3));
}

/** 預設乘車分鐘：巴士每站約 1.5 分鐘，港鐵每站約 2.2 分鐘 */
export function defaultRideMin(co: Company, stops: number) {
  return Math.max(2, Math.round(stops * (co === "MTR" ? 2.2 : 1.5)));
}

/* ---------------- 實時班次 ---------------- */

type EtaRow = { eta: string | null; dir: string; seq: number; service_type?: number; rmk_tc?: string };

/**
 * 逐站追蹤同一班車：由上車站的到站時間開始，每一站取「不早於上一站」而最接近的到站時間。
 * 相鄰兩站之間只需一兩分鐘，而班次通常相隔較遠，所以比直接配對上下車站準確。
 */
function chain(start: number, perStop: number[][]): number | null {
  let t = start;
  let skipped = 0;
  let tracked = 0;
  for (let i = 0; i < perStop.length; i++) {
    const list = perStop[i];
    const last = i === perStop.length - 1;
    // 部分站沒有到站資料：略過，但放寬下一站的容許差距
    if (!list.length) {
      if (last) return null;
      skipped++;
      continue;
    }
    const next = list.filter((x) => x >= t - 30_000).sort((a, b) => a - b)[0];
    if (next === undefined || next - t > (8 + 3 * skipped) * 60_000) return null;
    t = next;
    skipped = 0;
    tracked++;
  }
  return tracked ? t : null;
}

const parseTimes = (rows: EtaRow[]) =>
  rows.map((r) => Date.parse(r.eta!)).filter((t) => Number.isFinite(t)).sort((a, b) => a - b);

async function busTimes(cfg: RouteCfg): Promise<{ boards: number[]; perStop: number[][] }> {
  if (cfg.co === "KMB") {
    const d = await getJson<{ data: EtaRow[] }>(`${KMB}/route-eta/${cfg.route}/${cfg.serviceType}`);
    const rows = d.data.filter((r) => r.eta && r.dir === cfg.dir);
    const at = (seq: number) => parseTimes(rows.filter((r) => Number(r.seq) === seq));
    const perStop: number[][] = [];
    for (let q = cfg.from.seq + 1; q <= cfg.to.seq; q++) perStop.push(at(q));
    return { boards: at(cfg.from.seq), perStop };
  }
  // 城巴沒有整條路線的到站資料，須逐站查詢（最多 30 站）
  const path = (cfg.path?.length ? cfg.path : [cfg.from.id, cfg.to.id]).slice(0, 30);
  const lists = await Promise.all(
    path.map((id) =>
      getJson<{ data: EtaRow[] }>(`${CTB}/eta/CTB/${id}/${cfg.route}`)
        .then((d) => parseTimes(d.data.filter((r) => r.eta && r.dir === cfg.dir)))
        .catch(() => [] as number[])
    )
  );
  return { boards: lists[0] ?? [], perStop: lists.slice(1) };
}

async function mtrEta(line: string, dir: string, sta: string): Promise<{ t: number; dest: string }[]> {
  const d = await getJson<{ data?: Record<string, Record<string, { time: string; dest: string }[]>> }>(
    `${MTR}?line=${line}&sta=${sta}`
  );
  const rows = d.data?.[`${line}-${sta}`]?.[dir] ?? [];
  // 港鐵時間為香港本地時間（UTC+8），不帶時區
  return rows.map((r) => ({ t: Date.parse(r.time.replace(" ", "T") + "+08:00"), dest: r.dest })).filter((r) => Number.isFinite(r.t));
}

export interface Departure {
  /** 上車站到站時間 */
  board: number;
  /** 下車站到站時間 */
  alight: number;
  /** 下車時間是否由乘車分鐘估算 */
  estimated: boolean;
  /** 最晚出門 */
  leaveBy: number;
  /** 到達目的地 */
  arriveAt: number;
}

export interface TransitResult {
  departures: Departure[];
  /** 本次實時追蹤得出的乘車分鐘（中位數） */
  observedRideMin: number | null;
  fetchedAt: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

export async function fetchDepartures(cfg: RouteCfg, doorBufferMin: number): Promise<TransitResult> {
  if (cfg.co === "CAR") return { departures: [], observedRideMin: null, fetchedAt: Date.now() };
  const pairs: { board: number; alight: number | null }[] = [];

  if (cfg.co === "MTR") {
    const leg = cfg.legs?.[0] ?? { line: cfg.route, from: cfg.from.id, to: cfg.to.id, dir: cfg.dir as "UP" | "DOWN" };
    const line = mtrLine(leg.line);
    const direct = (cfg.legs?.length ?? 1) === 1;
    const [b, a] = await Promise.all([
      mtrEta(leg.line, leg.dir, leg.from),
      direct ? mtrEta(leg.line, leg.dir, leg.to) : Promise.resolve([]),
    ]);
    const boards = b.filter((x) => !line || trainServes(line, x.dest, leg.to, leg.dir)).map((x) => x.t);
    const alights = a.map((x) => x.t).sort((x, y) => x - y);
    const stops = line ? Math.abs(mtrIndex(line, leg.to) - mtrIndex(line, leg.from)) : 1;
    const used = new Set<number>();
    for (const board of boards) {
      // 直達：配對下車站同方向、行車時間合理的列車；跨綫則以分段估算
      const idx = alights.findIndex((t, i) => !used.has(i) && t - board >= stops * 60_000 && t - board <= cfg.rideMin * 2 * 60_000 + 5 * 60_000);
      if (idx >= 0) used.add(idx);
      pairs.push({ board, alight: idx >= 0 ? alights[idx] : null });
    }
  } else {
    const { boards, perStop } = await busTimes(cfg);
    for (const board of boards) pairs.push({ board, alight: perStop.length ? chain(board, perStop) : null });
  }

  const rides = pairs.filter((p) => p.alight !== null).map((p) => p.alight! - p.board);
  const departures = pairs.map(({ board, alight }) => {
    const a = alight ?? board + cfg.rideMin * 60_000;
    return {
      board,
      alight: a,
      estimated: alight === null,
      leaveBy: board - (doorBufferMin + cfg.walkToMin) * 60_000,
      arriveAt: a + cfg.walkFromMin * 60_000,
    };
  });
  return {
    departures,
    observedRideMin: rides.length ? Math.max(1, Math.round(median(rides) / 60_000)) : null,
    fetchedAt: Date.now(),
  };
}

/** 無實時資料時的整段估算（例如計劃明天）：出門緩衝＋步行＋候車 5 分鐘＋乘車＋步行 */
export function estimateDoorToDoorMin(cfg: RouteCfg, doorBufferMin: number) {
  const wait = cfg.co === "CAR" ? 0 : cfg.co === "MTR" ? 3 : 5;
  return doorBufferMin + cfg.walkToMin + wait + cfg.rideMin + cfg.walkFromMin;
}

export function mtrStops(lineCode: string): StopOption[] {
  const line = mtrLine(lineCode);
  return line ? line.stations.map(([c, n], i) => ({ id: c, name: n, seq: i })) : [];
}

export function mtrDirection(lineCode: string, from: string, to: string): "UP" | "DOWN" {
  const line = mtrLine(lineCode);
  if (!line) return "UP";
  return mtrIndex(line, to) > mtrIndex(line, from) ? "UP" : "DOWN";
}
