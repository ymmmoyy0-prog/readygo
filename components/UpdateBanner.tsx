"use client";
import { useEffect, useState } from "react";
import { RefreshIcon } from "./Icons";

const CURRENT = process.env.NEXT_PUBLIC_BUILD_ID ?? "";

/** App 回到前台時檢查伺服器版本；有新版本時顯示一鍵重新載入 */
export default function UpdateBanner() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 60_000) return;
      last = Date.now();
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
        const { id } = (await res.json()) as { id: string };
        if (id && CURRENT && id !== CURRENT) setAvailable(true);
        navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
      } catch {
        /* 離線時略過 */
      }
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  if (!available) return null;
  return (
    <button
      onClick={() => window.location.reload()}
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-ink px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-[15px] font-bold text-white"
    >
      <RefreshIcon size={18} />
      有新版本・按此重新載入
    </button>
  );
}
