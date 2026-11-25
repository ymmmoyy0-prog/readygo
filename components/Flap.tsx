/** 翻牌式數字：每個數字一格，冒號不設底格 */
export default function Flap({
  text,
  className = "",
  danger = false,
  style,
}: {
  text: string;
  className?: string;
  danger?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`flap ${danger ? "danger" : ""} ${className}`} style={style} aria-label={text}>
      {text.split("").map((ch, i) =>
        ch === ":" ? (
          <span key={i} className="sep">
            :
          </span>
        ) : (
          <span key={i} className="tile">
            {ch}
          </span>
        )
      )}
    </span>
  );
}
