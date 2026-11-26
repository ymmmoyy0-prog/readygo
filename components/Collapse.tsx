"use client";
import { useEffect, useState, type ReactNode } from "react";

/** 平滑展開／收起：高度及透明度過渡，收起完成後才卸載內容 */
export default function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  return (
    <div
      className="grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? "1fr" : "0fr", opacity: open ? 1 : 0 }}
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget && !open) setMounted(false);
      }}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">{mounted && children}</div>
    </div>
  );
}
