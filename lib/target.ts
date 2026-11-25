import type { Settings, TimeMode } from "./types";
import { estimateDoorToDoorMin, type Departure, type RouteCfg, type TransitResult } from "./transit";
import { leaveTimeToEpoch } from "./time";

export interface LiveTransit {
  primary: TransitResult | null;
  backup: TransitResult | null;
}

export interface Target {
  /** 最晚出門時間 */
  leaveAt: number | null;
  /** 到達時間（到達模式） */
  arriveAt: number | null;
  source: "manual" | "live" | "estimate" | "none";
  /** 決定出門時間的班次 */
  dep: Departure | null;
  route: RouteCfg | null;
}

/** 門到門分鐘：有路線用路線估算，否則用手動路程 */
export function doorToDoorMin(s: Settings): number {
  const r = s.transit.primary;
  return r ? estimateDoorToDoorMin(r, s.transit.doorBufferMin) : s.manualTravelMin;
}

/**
 * 由到達時間推算出門時間（只用首選路線；備案路線只在班次清單中作參考）。
 * 實時班次覆蓋到達時間（即有班次在到達時間之後才到）時，取最遲而又能準時到達的一班；否則按平日路程估算。
 */
export function leaveForArrival(arrive: number, s: Settings, live: LiveTransit | null): Omit<Target, "arriveAt"> {
  const route = s.transit.primary;
  const deps = route && live?.primary ? live.primary.departures : [];
  const covers = deps.some((d) => d.arriveAt > arrive);
  const ok = deps.filter((d) => d.arriveAt <= arrive).sort((a, b) => b.leaveBy - a.leaveBy);
  if (route && covers && ok.length) return { leaveAt: ok[0].leaveBy, source: "live", dep: ok[0], route };
  return { leaveAt: arrive - doorToDoorMin(s) * 60_000, source: "estimate", dep: null, route };
}

export function computeTarget(s: Settings, live: LiveTransit | null, now = Date.now(), mode: TimeMode = s.timeMode, time?: string): Target {
  const t = time ?? (mode === "leave" ? s.leaveTime : s.arriveTime);
  const at = t ? leaveTimeToEpoch(t, now) : null;
  if (at === null) return { leaveAt: null, arriveAt: null, source: "none", dep: null, route: null };
  if (mode === "leave") return { leaveAt: at, arriveAt: null, source: "manual", dep: null, route: null };
  return { ...leaveForArrival(at, s, live), arriveAt: at };
}

export interface Catchable {
  dep: Departure;
  route: RouteCfg;
  isBackup: boolean;
  catchable: boolean;
}

/** 班次清單：出門前仍需 prepSec 秒準備，趕不上的標記為 false */
export function listDepartures(s: Settings, live: LiveTransit | null, prepSec: number, now = Date.now()): Catchable[] {
  const out: Catchable[] = [];
  const earliestLeave = now + prepSec * 1000;
  const add = (res: TransitResult | null, route: RouteCfg | null, isBackup: boolean) => {
    if (!res || !route) return;
    res.departures.forEach((dep) => out.push({ dep, route, isBackup, catchable: dep.leaveBy >= earliestLeave }));
  };
  add(live?.primary ?? null, s.transit.primary, false);
  add(live?.backup ?? null, s.transit.backup, true);
  return out.sort((a, b) => a.dep.board - b.dep.board);
}
