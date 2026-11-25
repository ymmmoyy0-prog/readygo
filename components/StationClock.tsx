"use client";
import { useEffect, useState } from "react";

/** 月台時鐘：顯示現在時間，紅色秒針 */
export default function StationClock({ size = 92 }: { size?: number }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const h = now ? (now.getHours() % 12) * 30 + now.getMinutes() * 0.5 : 0;
  const m = now ? now.getMinutes() * 6 : 0;
  const s = now ? now.getSeconds() * 6 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 92 92" aria-hidden>
      <circle cx="46" cy="46" r="43" fill="#fff" stroke="#111" strokeWidth="3" />
      {Array.from({ length: 12 }).map((_, i) => (
        <line
          key={i}
          x1="46"
          y1={i % 3 === 0 ? 7 : 9}
          x2="46"
          y2={i % 3 === 0 ? 17 : 14}
          stroke="#111"
          strokeWidth={i % 3 === 0 ? 4 : 2}
          transform={`rotate(${i * 30} 46 46)`}
        />
      ))}
      <line x1="46" y1="50" x2="46" y2="25" stroke="#111" strokeWidth="5" transform={`rotate(${h} 46 46)`} />
      <line x1="46" y1="50" x2="46" y2="13" stroke="#111" strokeWidth="3.5" transform={`rotate(${m} 46 46)`} />
      <line x1="46" y1="56" x2="46" y2="12" stroke="#d52b1e" strokeWidth="1.8" transform={`rotate(${s} 46 46)`} />
      <circle cx="46" cy="46" r="3" fill="#d52b1e" />
    </svg>
  );
}

/** 步驟進度環：外圈按本步已用比例填滿 */
export function StepRing({ fraction, size = 64, danger = false }: { fraction: number; size?: number; danger?: boolean }) {
  const c = 2 * Math.PI * 28;
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <circle cx="32" cy="32" r="28" fill="none" stroke="#e6e6e6" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke={danger ? "#d52b1e" : "#111"}
        strokeWidth="6"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - f)}
        transform="rotate(-90 32 32)"
      />
      <line x1="32" y1="32" x2="32" y2="9" stroke="#d52b1e" strokeWidth="2.5" transform={`rotate(${f * 360} 32 32)`} />
      <circle cx="32" cy="32" r="3" fill="#d52b1e" />
    </svg>
  );
}

/** 標誌：方框時鐘 */
export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden>
      <rect x="1.5" y="1.5" width="33" height="33" fill="none" stroke="#111" strokeWidth="3" />
      <path d="M18 7v11h8" fill="none" stroke="#111" strokeWidth="3" />
      <circle cx="26" cy="18" r="3" fill="#d52b1e" />
    </svg>
  );
}
