"use client";
import { useEffect } from "react";

/**
 * 全站按下回饋：在手指／滑鼠按下的位置泛起一圈光，Android 另加極短震動。
 * 以事件委派處理，所有 <button> 自動生效。
 */
export default function PressFeedback() {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onDown = (e: PointerEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest("button");
      if (!btn || btn.disabled) return;
      if (!reduce.matches) {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty("--px", `${e.clientX - r.left}px`);
        btn.style.setProperty("--py", `${e.clientY - r.top}px`);
        btn.classList.remove("press-fx");
        void btn.offsetWidth; // 重新觸發動畫
        btn.classList.add("press-fx");
      }
      if (e.pointerType === "touch") navigator.vibrate?.(8);
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName === "press-flash") (e.target as HTMLElement).classList.remove("press-fx");
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("animationend", onEnd);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("animationend", onEnd);
    };
  }, []);
  return null;
}
