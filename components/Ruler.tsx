/** 刻度尺：每格代表一個步驟，長度按時長比例；紅線表示已走過的進度 */
export default function Ruler({
  steps,
  progress,
  labels = false,
  className = "",
}: {
  steps: { name: string; minutes: number; skip?: boolean }[];
  /** 0 至 1 的整體進度，未開始時省略 */
  progress?: number;
  labels?: boolean;
  className?: string;
}) {
  const active = steps.filter((s) => !s.skip && s.minutes > 0);
  const total = active.reduce((a, s) => a + s.minutes, 0) || 1;
  const W = 1000;
  let x = 0;
  const ticks = active.map((s) => {
    const at = x;
    x += (s.minutes / total) * W;
    return { at, name: s.name };
  });
  const h = labels ? 46 : 18;
  return (
    <svg
      viewBox={`-4 0 ${W + 8} ${h}`}
      preserveAspectRatio="none"
      className={`block w-full ${className}`}
      style={{ height: labels ? 46 : 18 }}
      aria-hidden
    >
      <rect x={0} y={8} width={W} height={2} fill="#111" />
      {progress !== undefined && <rect x={0} y={6} width={Math.min(1, Math.max(0, progress)) * W} height={6} fill="#d52b1e" />}
      {ticks.map((t, i) => (
        <rect key={i} x={t.at} y={1} width={3} height={16} fill="#111" />
      ))}
      <rect x={W - 3} y={1} width={3} height={16} fill="#111" />
    </svg>
  );
}

/** 刻度下方的站名（以 HTML 排版，避免 SVG 拉伸令文字變形） */
export function RulerLabels({ steps }: { steps: { name: string; minutes: number; skip?: boolean }[] }) {
  const active = steps.filter((s) => !s.skip && s.minutes > 0);
  const total = active.reduce((a, s) => a + s.minutes, 0) || 1;
  let x = 0;
  return (
    <div className="relative mt-1 h-5 text-[11px] text-sub">
      {active.map((s, i) => {
        const left = (x / total) * 100;
        x += s.minutes;
        return (
          <span key={i} className="absolute truncate" style={{ left: `${left}%`, maxWidth: `${(s.minutes / total) * 100}%` }}>
            {s.name}
          </span>
        );
      })}
    </div>
  );
}
