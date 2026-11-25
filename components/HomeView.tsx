"use client";
import { useEffect, useState } from "react";
import type { Preset, Session, Settings } from "@/lib/types";
import { fmtClock, leaveTimeToEpoch, todayKey } from "@/lib/time";
import ShareModal from "./ShareModal";
import Flap from "./Flap";
import Ruler from "./Ruler";
import StationClock, { Logo } from "./StationClock";

export default function HomeView({
  presets,
  settings,
  session,
  onSettings,
  onStart,
  onEdit,
  onResume,
  onPlan,
}: {
  presets: Preset[];
  settings: Settings;
  session: Session | null;
  onSettings: (s: Settings) => void;
  onStart: (p: Preset, leaveTime?: string) => void;
  onEdit: (id: string | null) => void;
  onResume: () => void;
  onPlan: () => void;
}) {
  const [sharing, setSharing] = useState<Preset | Preset[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const leaveAt = settings.leaveTime ? leaveTimeToEpoch(settings.leaveTime, now) : null;
  const plan = settings.plan && settings.plan.date === todayKey(now) ? settings.plan : null;
  const planPreset = plan ? presets.find((p) => p.id === plan.presetId) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-paper pb-12">
      <header className="flex items-center gap-3 border-b-[3px] border-ink px-5 pb-4 pt-6">
        <Logo />
        <div>
          <p className="text-xs font-extrabold tracking-[0.16em] text-danger">READYGO</p>
          <h1 className="text-[1.6rem] font-extrabold leading-tight text-ink">出門精算師</h1>
        </div>
      </header>

      {session && !session.finishedAt && (
        <button onClick={onResume} className="flex w-full items-center justify-between bg-ink px-5 py-4 text-left text-white">
          <span>
            <span className="block text-sm text-white/70">進行中</span>
            <span className="text-lg font-bold">{session.presetName}</span>
          </span>
          <span className="text-lg font-bold">繼續 →</span>
        </button>
      )}

      {/* 出門時間 */}
      <section className="flex items-center gap-4 border-b border-ink px-5 py-5">
        <StationClock size={88} />
        <div className="min-w-0 flex-1">
          <label htmlFor="leave" className="block text-sm text-sub">
            今日出門時間
          </label>
          <div className="relative mt-1 inline-block">
            {settings.leaveTime ? (
              <Flap text={settings.leaveTime} style={{ fontSize: 40 }} />
            ) : (
              <span className="inline-flex h-[49px] items-center border-[1.5px] border-dashed border-ink px-3 font-bold text-ink">
                設定時間
              </span>
            )}
            <input
              id="leave"
              type="time"
              value={settings.leaveTime}
              onChange={(e) => onSettings({ ...settings, leaveTime: e.target.value })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="今日出門時間"
            />
          </div>
          {settings.leaveTime && (
            <button
              onClick={() => onSettings({ ...settings, leaveTime: "" })}
              className="ml-3 align-top text-sm text-sub underline underline-offset-4"
            >
              清除
            </button>
          )}
        </div>
      </section>

      {/* 預早計劃 */}
      {plan && planPreset ? (
        <section className="border-b border-ink bg-warn-soft px-5 py-4">
          <p className="text-sm font-bold text-warn">今日計劃</p>
          <p className="mt-1 text-[17px] leading-relaxed text-ink">
            {planPreset.name}・{plan.leaveTime} 出門
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => onStart(planPreset, plan.leaveTime)}
              className="h-12 flex-1 bg-ink font-bold text-white"
            >
              按計劃開始
            </button>
            <button onClick={onPlan} className="h-12 border-[1.5px] border-ink px-4 font-bold text-ink">
              修改
            </button>
          </div>
        </section>
      ) : (
        <button onClick={onPlan} className="flex w-full items-center justify-between border-b border-ink px-5 py-4 text-left">
          <span>
            <span className="block font-bold text-ink">預早計劃</span>
            <span className="text-[15px] text-sub">前一晚計算何時起床、何時開始準備</span>
          </span>
          <span className="text-xl text-ink">→</span>
        </button>
      )}

      {/* 時刻表 */}
      <div className="flex items-baseline justify-between px-5 pb-2 pt-6">
        <h2 className="text-lg font-extrabold text-ink">出門模式</h2>
        {presets.length > 1 && (
          <button onClick={() => setSharing(presets)} className="text-[15px] font-semibold text-ink underline underline-offset-4">
            分享／備份全部
          </button>
        )}
      </div>

      <div className="border-t border-ink px-5">
        {presets.map((p) => {
          const total = p.steps.reduce((a, s) => a + s.minutes, 0);
          const startBy = leaveAt ? leaveAt - total * 60_000 : null;
          const late = startBy !== null && startBy < now;
          return (
            <article key={p.id} className="border-b border-line py-4">
              <div className="grid grid-cols-[4.2rem_1fr_auto] items-start gap-3">
                <div>
                  <div className={`tnum text-[1.35rem] font-extrabold leading-tight ${late ? "text-danger" : "text-ink"}`}>
                    {startBy !== null ? fmtClock(startBy) : "--:--"}
                  </div>
                  <div className="text-xs text-sub">開始</div>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[1.15rem] font-extrabold leading-snug text-ink">{p.name}</h3>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-sub">{p.steps.map((s) => s.name).join("・")}</p>
                  {late && <p className="mt-1 text-[13px] font-bold text-danger">已遲 {Math.ceil((now - startBy!) / 60000)} 分鐘</p>}
                </div>
                <span className="tnum border-[1.5px] border-ink px-2 py-0.5 text-[15px] font-extrabold text-ink">{total}′</span>
              </div>
              <div className="ml-[4.95rem] mt-3">
                <Ruler steps={p.steps} />
              </div>
              <div className="ml-[4.95rem] mt-3 grid grid-cols-[1fr_auto_auto] border-[1.5px] border-ink">
                <button
                  onClick={() => onStart(p)}
                  disabled={p.steps.length === 0}
                  className="h-11 bg-ink font-bold text-white disabled:opacity-40"
                >
                  開始 →
                </button>
                <button onClick={() => onEdit(p.id)} className="h-11 border-x-[1.5px] border-ink px-4 font-bold text-ink">
                  編輯
                </button>
                <button onClick={() => setSharing(p)} className="h-11 px-4 font-bold text-ink">
                  分享
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="px-5">
        <button onClick={() => onEdit(null)} className="mt-5 h-13 w-full border-[1.5px] border-ink py-3.5 font-bold text-ink">
          ＋ 新增出門模式
        </button>
        <p className="mt-8 text-center text-sm text-faint">所有資料只儲存於此裝置，無需登入。</p>
      </div>

      <ShareModal preset={sharing} onClose={() => setSharing(null)} />
    </main>
  );
}
