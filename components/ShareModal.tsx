"use client";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import type { Preset } from "@/lib/types";
import { buildShareUrl } from "@/lib/share";

export default function ShareModal({
  preset,
  onClose,
}: {
  preset: Preset | Preset[] | null;
  onClose: () => void;
}) {
  const many = Array.isArray(preset) && preset.length > 1;
  const label = Array.isArray(preset) ? (many ? `全部 ${preset.length} 個模式` : preset[0]?.name) : preset?.name;
  const url = preset ? buildShareUrl(preset) : "";
  const [copied, setCopied] = useState(false);

  useEffect(() => setCopied(false), [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      const el = document.getElementById("share-url") as HTMLTextAreaElement | null;
      el?.select();
      setCopied(document.execCommand?.("copy") ?? false);
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: `ReadyGo：${label}`, text: "我的出門流程", url });
    } catch {
      /* 用戶取消 */
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Modal open={!!preset} title={many ? "分享／備份全部模式" : "分享此出門流程"} onClose={onClose}>
      <p className="mb-3 leading-relaxed text-sub">
        對方開啟連結後，可將「<span className="font-semibold text-ink">{label}</span>
        」匯入其裝置，之後各自修改，互不影響。
        {many && " 亦可作為備份：更換手機時，在新手機開啟此連結即可還原。"}
      </p>
      <textarea
        id="share-url"
        readOnly
        value={url}
        rows={3}
        className="mb-4 w-full resize-none border border-ink bg-paper p-3 text-sm text-sub"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="flex flex-col gap-2">
        <button onClick={copy} className="h-14 bg-ink text-lg font-bold text-white">
          {copied ? "✓ 已複製連結" : "複製連結"}
        </button>
        {canShare && (
          <button onClick={nativeShare} className="h-12 border-[1.5px] border-ink font-bold text-ink">
            透過其他應用程式分享
          </button>
        )}
        <button onClick={onClose} className="h-12 text-sub">
          關閉
        </button>
      </div>
    </Modal>
  );
}
