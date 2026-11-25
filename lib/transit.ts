import { mtrIndex, mtrLine, trainServes } from "./mtr";

export type Company = "KMB" | "CTB" | "MTR";

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
  /** 乘車分鐘：實時配對成功時自動更新 */
  rideMin: number;
}

export interface TransitSettings {
  doorBufferMin: number;
  primary: RouteCfg | null;
  backup: RouteCfg | null;
}

export const defaultTransit: TransitSettings = { doorBufferMin: 4, primary: null, backup: null };

export const CO_LABEL: Record<Company, string> = { KMB: "九巴", CTB: "城巴", MTR: "港鐵" };

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
}

const BOUND = { O: "outbound", I: "inbound" } as Record<string, string>;

export async function routeStops(r: RouteOption): Promise<StopOption[]> {
  if (r.co === "KMB") {
    const rs = await getJson<{ data: { stop: string; seq: string }[] }>(
      `${KMB}/route-stop/${r.route}/${BOUND[r.dir]}/${r.serviceType}`
    );
    const names = await Promise.all(
      rs.data.map((s) => getJson<{ data: { name_tc: string } }>(`${KMB}/stop/${s.stop}`).then((d) => d.data.name_tc))
    );
    return rs.data.map((s, i) => ({ id: s.stop, name: names[i], seq: Number(s.seq) }));
  }
  const rs = await getJson<{ data: { stop: string; seq: number }[] }>(`${CTB}/route-stop/CTB/${r.route}/${BOUND[r.dir]}`);
  const names = await Promise.all(
    rs.data.map((s) => getJson<{ data: { name_tc: string } }>(`${CTB}/stop/${s.stop}`).then((d) => d.data.name_tc))
  );
  return rs.data.map((s, i) => ({ id: s.stop, name: names[i], seq: Number(s.seq) }));
}

/** 預設乘車分鐘：巴士每站約 1.5 分鐘，港鐵每站約 2.2 分鐘 */
export function defaultRideMin(co: Company, stops: number) {
  return Math.max(2, Math.round(stops * (co === "MTR" ? 2.2 : 1.5)));
}

/* ---------------- 實時班次 ---------------- */

async function busEta(co: "KMB" | "CTB", cfg: RouteCfg, stopId: string, seq: number): Promise<number[]> {
  type Row = { eta: string | null; dir: string; seq: number; service_type?: number };
  const url =
    co === "KMB"
      ? `${KMB}/eta/${stopId}/${cfg.route}/${cfg.serviceType}`
      : `${CTB}/eta/CTB/${stopId}/${cfg.route}`;
  const d = await getJson<{ data: Row[] }>(url);
  return d.data
    // 城巴到站資料的 seq 與路線站序不一致，只按方向篩選
    .filter((r) => r.eta && r.dir === cfg.dir && (co === "CTB" || !r.seq || Number(r.seq) === seq))
    .map((r) => Date.parse(r.eta!))
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
}

async function mtrEta(cfg: RouteCfg, sta: string): Promise<{ t: number; dest: string }[]> {
  const d = await getJson<{ data?: Record<string, Record<string, { time: string; dest: string }[]>> }>(
    `${MTR}?line=${cfg.route}&sta=${sta}`
  );
  const rows = d.data?.[`${cfg.route}-${sta}`]?.[cfg.dir] ?? [];
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
  /** 本次實時配對得出的乘車分鐘（配對成功才有） */
  observedRideMin: number | null;
  fetchedAt: number;
}

export async function fetchDepartures(cfg: RouteCfg, doorBufferMin: number): Promise<TransitResult> {
  let boards: number[] = [];
  let alights: number[] = [];
  if (cfg.co === "MTR") {
    const line = mtrLine(cfg.route);
    const dir = cfg.dir as "UP" | "DOWN";
    const [b, a] = await Promise.all([mtrEta(cfg, cfg.from.id), mtrEta(cfg, cfg.to.id)]);
    boards = b.filter((x) => !line || trainServes(line, x.dest, cfg.to.id, dir)).map((x) => x.t);
    alights = a.map((x) => x.t);
  } else {
    [boards, alights] = await Promise.all([
      busEta(cfg.co, cfg, cfg.from.id, cfg.from.seq),
      busEta(cfg.co, cfg, cfg.to.id, cfg.to.seq),
    ]);
  }

  const stopsBetween = Math.abs(cfg.to.seq - cfg.from.seq);
  const minRide = stopsBetween * (cfg.co === "MTR" ? 60_000 : 30_000);
  const maxRide = cfg.rideMin * 2.5 * 60_000 + 5 * 60_000;
  const used = new Set<number>();
  const rides: number[] = [];

  const departures = boards.map((board) => {
    // 不會互相超車：配對下車站第一班「上車後至少經過最短行車時間」才到站的班次
    const idx = alights.findIndex((a, i) => !used.has(i) && a - board >= minRide && a - board <= maxRide);
    let alight: number;
    let estimated = true;
    if (idx >= 0) {
      used.add(idx);
      alight = alights[idx];
      estimated = false;
      rides.push(alight - board);
    } else {
      alight = board + cfg.rideMin * 60_000;
    }
    return {
      board,
      alight,
      estimated,
      leaveBy: board - (doorBufferMin + cfg.walkToMin) * 60_000,
      arriveAt: alight + cfg.walkFromMin * 60_000,
    };
  });

  const observedRideMin = rides.length ? Math.round(rides.reduce((a, b) => a + b, 0) / rides.length / 60_000) : null;
  return { departures, observedRideMin, fetchedAt: Date.now() };
}

/** 無實時資料時的整段估算（例如計劃明天）：出門緩衝＋步行＋候車 5 分鐘＋乘車＋步行 */
export function estimateDoorToDoorMin(cfg: RouteCfg, doorBufferMin: number) {
  return doorBufferMin + cfg.walkToMin + 5 + cfg.rideMin + cfg.walkFromMin;
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
