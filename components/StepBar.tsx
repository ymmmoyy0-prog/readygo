const TINTS = ["#2e6b5c", "#5b9283", "#8fb7ab", "#bcd5cd"];

/** 按時長比例顯示步驟的分段條 */
export default function StepBar({
  steps,
  activeIndex,
  className = "",
}: {
  steps: { name: string; minutes: number; skip?: boolean }[];
  activeIndex?: number;
  className?: string;
}) {
  const total = steps.reduce((a, s) => a + (s.skip ? 0 : s.minutes), 0) || 1;
  return (
    <div className={`flex h-2.5 w-full gap-[3px] overflow-hidden rounded-full ${className}`} aria-hidden>
      {steps.map((s, i) =>
        s.skip ? null : (
          <span
            key={i}
            className="h-full rounded-full"
            style={{
              width: `${(s.minutes / total) * 100}%`,
              background:
                activeIndex === undefined
                  ? TINTS[i % TINTS.length]
                  : i < activeIndex
                    ? "#cfd8d4"
                    : i === activeIndex
                      ? "#2e6b5c"
                      : "#bcd5cd",
            }}
          />
        )
      )}
    </div>
  );
}
