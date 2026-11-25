"use client";
import Flap from "./Flap";

/** 翻牌時間，點擊後開啟系統時間選擇器 */
export default function TimeField({
  id,
  value,
  onChange,
  size = 44,
  placeholder = "設定時間",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  size?: number;
  placeholder?: string;
}) {
  return (
    <span className="relative inline-block">
      {value ? (
        <Flap text={value} style={{ fontSize: size }} />
      ) : (
        <span
          className="inline-flex items-center border-[1.5px] border-dashed border-ink px-3 font-bold text-ink"
          style={{ height: size * 1.22 }}
        >
          {placeholder}
        </span>
      )}
      <input
        id={id}
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  );
}
