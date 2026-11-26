import type { ReactNode } from "react";

/** 數值改變時彈一下（以 key 重新掛載觸發動畫） */
export default function Bump({ value, children }: { value: string | number; children?: ReactNode }) {
  return (
    <span key={String(value)} className="bump">
      {children ?? value}
    </span>
  );
}
