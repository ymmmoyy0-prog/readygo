"use client";
import { useEffect, useState } from "react";
import type { Preset, Session, Settings } from "@/lib/types";
import { fmtClock, leaveTimeToEpoch } from "@/lib/time";
import ShareModal from "./ShareModal";
import StepBar from "./StepBar";

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
  const [sharing, setSharing] = useState<Preset | Preset[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const leaveAt = settings.leaveTime ? leaveTimeToEpoch(settings.leaveTime, now) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-12 pt-6">
      <header className="mb-6 px-1">
        <p className="text-sm font-semibold tracking-wide text-brand">ReadyGo</p>
        <h1 className="text-[1.85rem] font-extrabold leading-tight text-ink">出門精算師</h1>
      </header>

      {session && !session.finishedAt && (
        <button
          onClick={onResume}
          className="mb-4 flex w-full items-center justify-between rounded-3xl bg-brand p-4 text-left text-white shadow-md"
        >
          <span>
            <span className="block text-sm opacity-80">進行中</span>
            <span className="text-lg font-bold">{session.presetName}</span>
          </span>
          <span className="text-lg font-bold">繼續 ▶</span>
        </button>
      )}

      <section className="card mb-6 p-4">
        <label className="mb-2 block font-bold text-ink" htmlFor="leave">
          今日幾點要出門？
        </label>
        <div className="flex items-center gap-2">
          <input
            id="leave"
            type="time"
            value={settings.leaveTime}
            onChange={(e) => onSettings({ ...settings, leaveTime: e.target.value })}
            className="tnum h-14 min-w-0 flex-1 rounded-2xl border border-line bg-paper px-4 text-2xl font-bold text-ink"
          />
          {settings.leaveTime && (
            <button
              onClick={() => onSettings({ ...settings, leaveTime: "" })}
              className="h-14 rounded-2xl border border-line px-4 font-semibold text-sub"
            >
              清除
            </button>
          )}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-sub">設定後會計出幾點開始準備，計時期間亦會提你仲有幾多緩衝。</p>
      </section>

      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-lg font-bold text-ink">我的出門模式</h2>
        {presets.length > 1 && (
          <button onClick={() => setSharing(presets)} className="text-[15px] font-semibold text-brand">
            分享／備份全部
          </button>
        )}
      </div>

      <div className="space-y-3">
        {presets.map((p) => {
          const total = p.steps.reduce((a, s) => a + s.minutes, 0);
          const startBy = leaveAt ? leaveAt - total * 60_000 : null;
          const late = startBy !== null && startBy < now;
          return (
            <article key={p.id} className="card p-4">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h3 className="text-xl font-bold leading-snug text-ink">{p.name}</h3>
                <span className="tnum shrink-0 text-lg font-bold text-brand">{total} 分鐘</span>
              </div>
              <p className="mb-3 text-[15px] leading-relaxed text-sub">{p.steps.map((s) => s.name).join("・")}</p>
              <StepBar steps={p.steps} className="mb-3" />
              {startBy !== null && (
                <p
                  className={`mb-3 rounded-xl px-3 py-2 text-[15px] font-semibold ${
                    late ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"
                  }`}
                >
                  {late ? `已經遲咗 ${Math.ceil((now - startBy) / 60000)} 分鐘開始` : `最遲 ${fmtClock(startBy)} 開始準備`}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => onStart(p)}
                  disabled={p.steps.length === 0}
                  className="h-14 flex-1 rounded-2xl bg-brand text-lg font-bold text-white active:bg-brand-strong disabled:opacity-40"
                >
                  開始 ▶
                </button>
                <button
                  onClick={() => onEdit(p.id)}
                  className="h-14 rounded-2xl border border-line bg-card px-4 font-semibold text-ink"
                >
                  編輯
                </button>
                <button
                  onClick={() => setSharing(p)}
                  className="h-14 rounded-2xl border border-line bg-card px-4 font-semibold text-ink"
                >
                  分享
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <button
        onClick={() => onEdit(null)}
        className="mt-4 h-14 w-full rounded-2xl border-2 border-dashed border-line font-semibold text-sub"
      >
        ＋ 新增出門模式
      </button>

      <p className="mt-8 text-center text-sm text-faint">所有資料只儲存喺你呢部裝置，無需登入。</p>

      <ShareModal preset={sharing} onClose={() => setSharing(null)} />
    </main>
  );
}
