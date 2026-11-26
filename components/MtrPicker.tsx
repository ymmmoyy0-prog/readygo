"use client";
import { useState } from "react";
import { MTR_LINES, mtrLine } from "@/lib/mtr";
import { stationName } from "@/lib/mtrRoute";

/** 港鐵車站選擇：先按路綫，再按車站 */
export default function MtrPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
}) {
  const initialLine = value ? MTR_LINES.find((l) => l.stations.some(([c]) => c === value))?.code ?? "" : "";
  const [line, setLine] = useState(initialLine);
  const [open, setOpen] = useState(!value);
  const l = mtrLine(line);

  if (value && !open) {
    return (
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-between border-b border-line px-5 py-3 text-left">
        <span>
          <span className="block text-[13px] text-sub">{label}</span>
          <span className="text-[17px] font-extrabold text-ink">{stationName(value)}</span>
        </span>
        <span className="text-[14px] text-sub underline underline-offset-4">更改</span>
      </button>
    );
  }

  return (
    <div className="border-b border-line px-5 py-3">
      <span className="block text-[13px] text-sub">{label}</span>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MTR_LINES.map((x) => (
          <button
            key={x.code}
            onClick={() => setLine(x.code)}
            className={`border-[1.5px] px-2 py-1.5 text-[13px] font-bold ${line === x.code ? "text-white" : "text-ink"}`}
            style={{ borderColor: x.color, background: line === x.code ? x.color : "transparent" }}
          >
            {x.name}
          </button>
        ))}
      </div>
      {l && (
        <div className="mt-2 grid grid-cols-4 gap-1">
          {l.stations.map(([c, n]) => (
            <button
              key={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`border py-2 text-[13px] ${value === c ? "border-ink bg-ink font-bold text-white" : "border-line text-ink"}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
