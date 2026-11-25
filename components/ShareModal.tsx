"use client";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import type { Preset } from "@/lib/types";
import { buildShareUrl } from "@/lib/share";

export default function ShareModal({ preset, onClose }: { preset: Preset | null; onClose: () => void }) {
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
      await navigator.share({ title: `ReadyGo：${preset?.name}`, text: "試吓我嘅出門流程", url });
    } catch {
      /* 用戶取消 */
    }
  };

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Modal open={!!preset} title="分享此出門流程" onClose={onClose}>
      <p className="mb-2 text-neutral-300">
        朋友打開連結後可以匯入「{preset?.name}」到佢自己部手機，之後各自修改，互不影響。
      </p>
      <textarea
        id="share-url"
        readOnly
        value={url}
        rows={3}
        className="mb-3 w-full resize-none rounded-xl bg-neutral-800 p-3 text-sm text-neutral-200"
        onFocus={(e) => e.currentTarget.select()}
      />
      <div className="flex flex-col gap-2">
        <button onClick={copy} className="h-14 rounded-2xl bg-lime-400 text-lg font-bold text-black active:bg-lime-300">
          {copied ? "✓ 已複製連結" : "複製連結"}
        </button>
        {canShare && (
          <button onClick={nativeShare} className="h-12 rounded-2xl bg-neutral-700 font-semibold text-white">
            用其他 App 分享
          </button>
        )}
        <button onClick={onClose} className="h-12 rounded-2xl text-neutral-400">
          關閉
        </button>
      </div>
    </Modal>
  );
}
