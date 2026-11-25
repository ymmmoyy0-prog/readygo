"use client";
import { useEffect, useState } from "react";
import type { Preset, Session, Settings } from "@/lib/types";
import { fmtClock, todayKey } from "@/lib/time";
import type { LiveTransit, Target } from "@/lib/target";
import { listDepartures } from "@/lib/target";
import ShareModal from "./ShareModal";
import Modal from "./Modal";
import TimeField from "./TimeField";
import TransitBadge from "./TransitBadge";
import { Logo } from "./StationClock";

export default function HomeView({
  presets,
  settings,
  session,
  target,
  live,
  onSettings,
  onStart,
  onEdit,
  onResume,
  onPlan,
  onRoutes,
}: {
  presets: Preset[];
  settings: Settings;
  session: Session | null;
  target: Target;
  live: LiveTransit & { error: string | null };
  onSettings: (s: Settings) => void;
  onStart: (p: Preset, fromPlan?: boolean) => void;
  onEdit: (id: string | null) => void;
  onResume: () => void;
  onPlan: () => void;
  onRoutes: () => void;
}) {
  const [sharing, setSharing] = useState<Preset | Preset[] | null>(null);
  const [menu, setMenu] = useState<Preset | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const arrive = settings.timeMode === "arrive";
  const time = arrive ? settings.arriveTime : settings.leaveTime;
  const setTime = (v: string) => onSettings(arrive ? { ...settings, arriveTime: v } : { ...settings, leaveTime: v });
  const plan = settings.plan && settings.plan.date === todayKey(now) ? settings.plan : null;
  const planPreset = plan ? presets.find((p) => p.id === plan.presetId) : null;
  const route = settings.transit.primary;
  // 主頁未開始準備：以第一個模式的時長估算何時可以出門
  const prepSec = (presets[0]?.steps.reduce((a, s) => a + s.minutes, 0) ?? 0) * 60;
  const deps = listDepartures(settings, live, prepSec, now);
  const shownDep = target.dep ?? deps.find((d) => d.catchable)?.dep ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-paper">
      <header className="flex items-center gap-2.5 border-b-[3px] border-ink px-5 py-4">
        <Logo size={28} />
        <h1 className="text-xl font-extrabold text-ink">出門精算師</h1>
      </header>

      {session && !session.finishedAt && (
        <button onClick={onResume} className="flex w-full items-center justify-between bg-ink px-5 py-3.5 text-left text-white">
          <span className="font-bold">進行中：{session.presetName}</span>
          <span className="font-bold">繼續 →</span>
        </button>
      )}

      {plan && planPreset && (
        <div className="flex items-center justify-between gap-3 border-b border-ink bg-warn-soft px-5 py-3">
          <span className="min-w-0 text-[15px] text-ink">
            今日計劃：<b>{planPreset.name}</b>・{plan.mode === "arrive" ? `${plan.time} 到達` : `${plan.time} 出門`}
          </span>
          <button onClick={() => onStart(planPreset, true)} className="h-10 shrink-0 bg-ink px-3 text-[15px] font-bold text-white">
            開始
          </button>
        </div>
      )}

      {/* 時間 */}
      <section className="border-b border-ink px-5 py-5">
        <div className="mb-4 grid grid-cols-2 border-[1.5px] border-ink">
          {(["leave", "arrive"] as const).map((m, i) => (
            <button
              key={m}
              onClick={() => onSettings({ ...settings, timeMode: m })}
              className={`h-10 text-[15px] font-bold ${i ? "border-l-[1.5px] border-ink" : ""} ${
                settings.timeMode === m ? "bg-ink text-white" : "text-ink"
              }`}
            >
              {m === "leave" ? "出門時間" : "到達時間"}
            </button>
          ))}
        </div>
        <div className="flex items-end justify-between gap-3">
          <TimeField id="main-time" value={time} onChange={setTime} />
          {arrive && target.leaveAt !== null && (
            <div className="text-right">
              <div className="text-[13px] text-sub">{target.source === "live" ? "應出門" : "應出門（估算）"}</div>
              <div className="tnum text-[1.75rem] font-extrabold leading-tight text-ink">{fmtClock(target.leaveAt)}</div>
            </div>
          )}
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-2 text-[15px] text-ink">
          {route ? (
            <>
              <TransitBadge route={route} />
              <span className="truncate text-sub">
                {route.from.name} → {route.to.name}
              </span>
              {shownDep && <span className="tnum ml-auto shrink-0 font-bold">{fmtClock(shownDep.board)} 班次</span>}
            </>
          ) : (
            <button onClick={onRoutes} className="text-sub underline underline-offset-4">
              {arrive ? `未設定交通路線，暫以路程 ${settings.manualTravelMin} 分鐘計算` : "設定交通路線，查看實時班次"}
            </button>
          )}
        </div>
        {route && live.error && <p className="mt-1 text-[13px] text-danger">{live.error}</p>}
      </section>

      {/* 模式 */}
      <div>
        {presets.map((p) => {
          const total = p.steps.reduce((a, s) => a + s.minutes, 0);
          const startBy = target.leaveAt !== null ? target.leaveAt - total * 60_000 : null;
          const late = startBy !== null && startBy < now;
          return (
            <div key={p.id} className="grid grid-cols-[3.9rem_1fr_auto_auto] items-center gap-3 border-b border-line px-5 py-3.5">
              <span className={`tnum text-[1.2rem] font-extrabold ${late ? "text-danger" : "text-ink"}`}>
                {startBy !== null ? fmtClock(startBy) : "--:--"}
              </span>
              <button onClick={() => setMenu(p)} className="min-w-0 truncate text-left text-[17px] font-extrabold text-ink">
                {p.name}
              </button>
              <span className="tnum text-[15px] text-sub">{total}′</span>
              <button
                onClick={() => onStart(p)}
                disabled={p.steps.length === 0}
                className="h-10 bg-ink px-4 text-[15px] font-bold text-white disabled:opacity-40"
              >
                開始
              </button>
            </div>
          );
        })}
        <button onClick={() => onEdit(null)} className="w-full px-5 py-3.5 text-left text-[15px] font-semibold text-sub">
          ＋ 新增出門模式
        </button>
      </div>

      <nav className="mt-auto border-t border-ink">
        {[
          ["明天的計劃", onPlan],
          ["交通路線", onRoutes],
        ].map(([label, fn]) => (
          <button
            key={label as string}
            onClick={fn as () => void}
            className="flex w-full items-center justify-between border-b border-line px-5 py-4 font-bold text-ink"
          >
            <span>{label as string}</span>
            <span>→</span>
          </button>
        ))}
        {presets.length > 1 && (
          <button onClick={() => setSharing(presets)} className="w-full px-5 py-4 text-left text-[15px] text-sub">
            分享／備份全部模式
          </button>
        )}
      </nav>

      <Modal open={!!menu} title={menu?.name ?? ""} onClose={() => setMenu(null)}>
        <div className="grid gap-2">
          <button
            onClick={() => {
              const id = menu!.id;
              setMenu(null);
              onEdit(id);
            }}
            className="h-14 bg-ink text-lg font-bold text-white"
          >
            編輯
          </button>
          <button
            onClick={() => {
              setSharing(menu);
              setMenu(null);
            }}
            className="h-14 border-[1.5px] border-ink text-lg font-bold text-ink"
          >
            分享
          </button>
          <button onClick={() => setMenu(null)} className="h-12 text-sub">
            取消
          </button>
        </div>
      </Modal>

      <ShareModal preset={sharing} onClose={() => setSharing(null)} />
    </main>
  );
}
