"use client";
import { useEffect, useState } from "react";

/** 啟用時保持螢幕常亮；切回前台時自動重新申請 */
export function useWakeLock(active: boolean): "on" | "off" | "unsupported" {
  const [state, setState] = useState<"on" | "off" | "unsupported">("off");

  useEffect(() => {
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      setState("unsupported");
      return;
    }
    if (!active) {
      setState("off");
      return;
    }
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        setState("on");
        sentinel.addEventListener("release", () => {
          if (!cancelled) setState("off");
        });
      } catch {
        setState("off");
      }
    };

    const onVis = () => {
      if (document.visibilityState === "visible" && (!sentinel || sentinel.released)) request();
    };

    request();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      sentinel?.release().catch(() => {});
    };
  }, [active]);

  return state;
}
