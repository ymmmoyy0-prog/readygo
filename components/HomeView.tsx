"use client";
import { useEffect, useState } from "react";
import type { Preset, Session, Settings } from "@/lib/types";
import { fmtClock, leaveTimeToEpoch } from "@/lib/time";
import ShareModal from "./ShareModal";

export default function HomeView({
  presets,
  settings,
  session,
  onSettings,
  onStart,
  onEdit,
  onResume,
}: {
  presets: Preset[];
  settings: Settings;
  session: Session | null;
  onSettings: (s: Settings) => void;
  onStart: (p: Preset) => void;
  onEdit: (id: string | null) => void;
  onResume: () => void;
}) {
  const [sharing, setSharing] = useState<Preset | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const leaveAt = settings.leaveTime ? leaveTimeToEpoch(settings.leaveTime, now) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-10 pt-5">
      <header className="mb-5">
        <h1 className="text-3xl font-black tracking-tight">
          出門精算師 <span className="text-lime-400">ReadyGo</span>
        </h1>
        <p className="mt-1 text-neutral-400">揀個出門模式，跟住大掣一步一步做。</p>
      </header>

      {session && !session.finishedAt && (
        <button
          onClick={onResume}
          className="mb-4 flex w-full items-center justify-between rounded-2xl border-2 border-lime-400 bg-lime-400/10 p-4 text-left"
        >
          <span>
            <span className="block text-sm text-lime-300">進行中</span>
            <span className="text-lg font-bold">{session.presetName}</span>
          </span>
          <span className="text-lg font-bold text-lime-400">繼續 ▶</span>
        </button>
      )}

      <section className="mb-5 rounded-2xl bg-neutral-900 p-4">
        <label className="mb-2 block font-semibold text-neutral-200" htmlFor="leave">
          目標出門時間（手動模式）
        </label>
        <div className="flex items-center gap-2">
          <input
            id="leave"
            type="time"
            value={settings.leaveTime}
            onChange={(e) => onSettings({ ...settings, leaveTime: e.target.value })}
            className="tnum h-14 flex-1 rounded-xl bg-neutral-800 px-3 text-2xl font-bold text-white"
          />
          {settings.leaveTime && (
            <button
              onClick={() => onSettings({ ...settings, leaveTime: "" })}
              className="h-14 rounded-xl bg-neutral-800 px-4 text-neutral-300"
            >
              清除
            </button>
          )}
        </div>
        <p className="mt-2 text-sm text-neutral-500">設定後會顯示幾點要開始準備，計時時亦會計算緩衝同語音提醒。</p>
      </section>

      <div className="space-y-3">
        {presets.map((p) => {
          const total = p.steps.reduce((a, s) => a + s.minutes, 0);
          const startBy = leaveAt ? leaveAt - total * 60_000 : null;
          const late = startBy !== null && startBy < now;
          return (
            <article key={p.id} className="rounded-2xl bg-neutral-900 p-4">
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">{p.name}</h2>
                <span className="tnum shrink-0 text-lg font-semibold text-lime-300">{total} 分鐘</span>
              </div>
              <p className="mb-3 text-sm leading-relaxed text-neutral-400">
                {p.steps.map((s) => `${s.name} ${s.minutes}m`).join(" → ")}
              </p>
              {startBy !== null && (
                <p className={`mb-3 font-semibold ${late ? "text-red-400" : "text-amber-300"}`}>
                  {late
                    ? `⚠ 已經遲咗 ${Math.ceil((now - startBy) / 60000)} 分鐘開始`
                    : `最遲 ${fmtClock(startBy)} 開始準備`}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => onStart(p)}
                  disabled={p.steps.length === 0}
                  className="h-14 flex-1 rounded-2xl bg-lime-400 text-lg font-bold text-black active:bg-lime-300 disabled:opacity-40"
                >
                  開始 ▶
                </button>
                <button onClick={() => onEdit(p.id)} className="h-14 rounded-2xl bg-neutral-800 px-4 font-semibold">
                  編輯
                </button>
                <button onClick={() => setSharing(p)} className="h-14 rounded-2xl bg-neutral-800 px-4 font-semibold">
                  分享
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <button
        onClick={() => onEdit(null)}
        className="mt-4 h-14 w-full rounded-2xl border-2 border-dashed border-neutral-700 font-semibold text-neutral-300"
      >
        ＋ 新增出門模式
      </button>

      <p className="mt-8 text-center text-xs text-neutral-600">所有資料只儲存喺你呢部裝置，無需登入。</p>

      <ShareModal preset={sharing} onClose={() => setSharing(null)} />
    </main>
  );
}
