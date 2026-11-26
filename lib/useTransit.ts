"use client";
import { useEffect, useRef, useState } from "react";
import type { TransitSettings } from "./transit";
import { fetchDepartures } from "./transit";
import type { LiveTransit } from "./target";

const REFRESH_MS = 30_000;

/** 每 30 秒更新首選及備案路線的實時班次；App 在背景時暫停 */
export function useTransit(
  t: TransitSettings,
  onObservedRide?: (which: "primary" | "backup", min: number) => void
): LiveTransit & { error: string | null; loading: boolean; updatedAt: number | null; refresh: () => Promise<void> } {
  const [state, setState] = useState<LiveTransit>({ primary: null, backup: null });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const cb = useRef(onObservedRide);
  const runRef = useRef<() => Promise<void>>(async () => {});
  cb.current = onObservedRide;
  const key = JSON.stringify([t.primary, t.backup, t.doorBufferMin].map((x) => (x && typeof x === "object" ? { ...x, rideMin: 0 } : x)));

  useEffect(() => {
    if (!t.primary && !t.backup) {
      setState({ primary: null, backup: null });
      return;
    }
    let stop = false;
    const run = async () => {
      if (document.visibilityState !== "visible") return;
      if (stop) return;
      setLoading(true);
      // 首選與備案分開查詢：其中一條失敗時保留該路線上次的資料
      const [pr, br] = await Promise.allSettled([
        t.primary ? fetchDepartures(t.primary, t.doorBufferMin) : Promise.resolve(null),
        t.backup ? fetchDepartures(t.backup, t.doorBufferMin) : Promise.resolve(null),
      ]);
      if (stop) return;
      const p = pr.status === "fulfilled" ? pr.value : undefined;
      const b = br.status === "fulfilled" ? br.value : undefined;
      setState((prev) => ({ primary: p === undefined ? prev.primary : p, backup: b === undefined ? prev.backup : b }));
      const failed = [pr.status === "rejected" && "首選", br.status === "rejected" && "備案"].filter(Boolean);
      setError(failed.length ? `${failed.join("及")}路線暫時未能更新班次` : null);
      if (p || b) setUpdatedAt(Date.now());
      if (p?.observedRideMin && t.primary && p.observedRideMin !== t.primary.rideMin) cb.current?.("primary", p.observedRideMin);
      if (b?.observedRideMin && t.backup && b.observedRideMin !== t.backup.rideMin) cb.current?.("backup", b.observedRideMin);
      setLoading(false);
    };
    runRef.current = run;
    run();
    const timer = setInterval(run, REFRESH_MS);
    const onVis = () => document.visibilityState === "visible" && run();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ...state, error, loading, updatedAt, refresh: () => runRef.current() };
}
