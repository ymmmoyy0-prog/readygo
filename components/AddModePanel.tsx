"use client";
import { useState } from "react";
import type { Preset } from "@/lib/types";
import { QUICK_TEMPLATES, fromTemplate, presetForTotal, templateTotal } from "@/lib/defaults";

/** 新增出門模式：模板、自訂分鐘、由零開始 */
export default function AddModePanel({ onAdd, onBlank }: { onAdd: (p: Preset) => void; onBlank: () => void }) {
  const [custom, setCustom] = useState("45");
  const customMin = Math.round(Number(custom));
  return (
    <div className="border-[1.5px] border-ink p-3">
      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_TEMPLATES.map((t) => (
          <button key={t.key} onClick={() => onAdd(fromTemplate(t))} className="border-[1.5px] border-ink py-2.5 text-center active:bg-brand-soft">
            <span className="tnum block text-[1.6rem] font-extrabold leading-tight text-ink">{templateTotal(t)}</span>
            <span className="text-[12px] text-sub">分鐘</span>
          </button>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        <div className="flex items-center border-[1.5px] border-ink">
          <input
            type="number"
            inputMode="numeric"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            aria-label="自訂分鐘"
            className="tnum h-11 w-14 bg-transparent text-center text-lg font-extrabold text-ink"
          />
          <button
            onClick={() => customMin >= 5 && customMin <= 180 && onAdd(presetForTotal(customMin))}
            className="h-11 flex-1 bg-ink text-[14px] font-bold text-white"
          >
            自訂
          </button>
        </div>
        <button onClick={onBlank} className="h-11 border-[1.5px] border-dashed border-ink text-[14px] font-bold text-ink">
          由零開始
        </button>
      </div>
    </div>
  );
}
