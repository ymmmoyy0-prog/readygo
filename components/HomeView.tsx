"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Preset, Session, Settings } from "@/lib/types";
import { fmtClock, todayKey } from "@/lib/time";
import type { LiveTransit, Target } from "@/lib/target";
import { listDepartures } from "@/lib/target";
import ShareModal from "./ShareModal";
import Modal from "./Modal";
import TimeField from "./TimeField";
import TransitBadge from "./TransitBadge";
import { Logo } from "./StationClock";
import { BusIcon, CarIcon, ClockIcon, ListIcon, PlusIcon, TrainIcon } from "./Icons";

type StepState = "done" | "current" | "todo";

/** 路線圖車站節點：完成＝黑底剔號；當前＝紅色脈動；未到＝空心數字 */
function Node({ n, state }: { n: number; state: StepState }) {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" aria-label={`第 ${n} 步`}>
      {state === "current" && (
        <circle cx="17" cy="17" r="15" fill="none" stroke="#d52b1e" strokeWidth="2">
          <animate attributeName="r" values="14;17" dur="1.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0" dur="1.4s" repeatCount="indefinite" />
        </circle>
      )}
      <circle
        cx="17"
        cy="17"
        r="14"
        fill={state === "done" ? "#111" : state === "current" ? "#d52b1e" : "#fff"}
        stroke={state === "todo" ? "#111" : "none"}
        strokeWidth="2"
      />
      {state === "done" ? (
        <path d="M11 17.5l4 4 8-9" fill="none" stroke="#fff" strokeWidth="2.6" />
      ) : (
        <text x="17" y="22.5" textAnchor="middle" fontSize="15" fontWeight="800" fill={state === "todo" ? "#111" : "#fff"}>
          {n}
        </text>
      )}
    </svg>
  );
}

function Station({
  n,
  state,
  icon,
  last,
  children,
}: {
  n: number;
  state: StepState;
  icon: ReactNode;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="relative grid grid-cols-[34px_1fr] gap-x-4 pl-5 pr-5">
      {/* 路線 */}
      {!last && (
        <span
          className={`absolute bottom-0 left-[calc(1.25rem+16px)] top-[34px] w-[3px] ${state === "done" ? "bg-ink" : "bg-line"}`}
          aria-hidden
        />
      )}
      <div className="relative z-10 pt-4">
        <Node n={n} state={state} />
        <div className={`mt-2 flex justify-center bg-paper py-1 ${state === "todo" ? "text-faint" : "text-ink"}`}>{icon}</div>
      </div>
      <div className={`min-w-0 pb-6 pt-4 ${state === "todo" ? "opacity-45" : ""}`}>{children}</div>
    </section>
  );
}

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

  const s1 = !!time;
  const s2 = !!route || settings.transitSkipped;
  const state = (n: number): StepState => {
    const done = [s1, s2, false][n - 1];
    if (done) return "done";
    const firstOpen = !s1 ? 1 : !s2 ? 2 : 3;
    return n === firstOpen ? "current" : "todo";
  };

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

      <div className="pt-2">
        {/* ① 時間 */}
        <Station n={1} state={state(1)} icon={<ClockIcon />}>
          <div className="mb-3 grid grid-cols-2 border-[1.5px] border-ink">
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
          <div className={state(1) === "current" ? "nudge" : ""}>
            <TimeField id="main-time" value={time} onChange={setTime} placeholder="--:--" />
          </div>
        </Station>

        {/* ② 交通 */}
        <Station
          n={2}
          state={state(2)}
          icon={route?.co === "CAR" ? <CarIcon /> : route?.co === "MTR" ? <TrainIcon /> : <BusIcon />}
        >
          {route ? (
            <button onClick={onRoutes} className="block w-full text-left">
              <div className="flex min-w-0 items-center gap-2 text-[15px] text-ink">
                <TransitBadge route={route} />
                {route.co !== "CAR" && route.co !== "MTR" && (
                  <span className="truncate text-sub">
                    {route.from.name} → {route.to.name}
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="tnum text-[15px] text-ink">
                  {shownDep ? `${fmtClock(shownDep.board)} 班次` : ""}
                </span>
                {target.leaveAt !== null && arrive && (
                  <span className="text-right">
                    <span className="block text-[12px] text-sub">{target.source === "live" ? "應出門" : "應出門（估算）"}</span>
                    <span className="tnum text-[1.7rem] font-extrabold leading-none text-ink">{fmtClock(target.leaveAt)}</span>
                  </span>
                )}
              </div>
              {live.error && route.co !== "CAR" && <p className="mt-1 text-[13px] text-danger">{live.error}</p>}
            </button>
          ) : (
            <div>
              <button
                onClick={onRoutes}
                className={`flex h-16 w-full items-center justify-center gap-5 border-[1.5px] text-ink ${
                  state(2) === "current" ? "border-danger" : "border-dashed border-ink"
                }`}
                aria-label="設定交通"
              >
                <BusIcon size={26} />
                <TrainIcon size={26} />
                <CarIcon size={26} />
                <span className="text-danger">
                  <PlusIcon size={26} />
                </span>
              </button>
              {!settings.transitSkipped && (
                <button
                  onClick={() => onSettings({ ...settings, transitSkipped: true })}
                  className="mt-2 text-[13px] text-sub underline underline-offset-4"
                >
                  略過
                </button>
              )}
              {settings.transitSkipped && arrive && target.leaveAt !== null && (
                <p className="tnum mt-2 text-[15px] text-ink">
                  路程 {settings.manualTravelMin} 分・應出門 <b>{fmtClock(target.leaveAt)}</b>
                </p>
              )}
            </div>
          )}
        </Station>

        {/* ③ 出門所需時間 */}
        <Station n={3} state={state(3)} icon={<ListIcon />} last>
          <div className="border-t border-ink">
            {presets.map((p) => {
              const total = p.steps.reduce((a, s) => a + s.minutes, 0);
              const startBy = target.leaveAt !== null ? target.leaveAt - total * 60_000 : null;
              const late = startBy !== null && startBy < now;
              return (
                <div key={p.id} className="grid grid-cols-[3.4rem_1fr_auto_auto] items-center gap-2.5 border-b border-line py-3">
                  <span className={`tnum text-[1.1rem] font-extrabold ${late ? "text-danger" : "text-ink"}`}>
                    {startBy !== null ? fmtClock(startBy) : "--:--"}
                  </span>
                  <button onClick={() => setMenu(p)} className="min-w-0 truncate text-left text-[16px] font-extrabold text-ink">
                    {p.name}
                  </button>
                  <span className="tnum text-[14px] text-sub">{total}′</span>
                  <button
                    onClick={() => onStart(p)}
                    disabled={p.steps.length === 0}
                    className="h-10 bg-ink px-3.5 text-[15px] font-bold text-white disabled:opacity-40"
                  >
                    開始
                  </button>
                </div>
              );
            })}
            <button onClick={() => onEdit(null)} className="flex w-full items-center gap-2 py-3 text-left text-[15px] text-sub" aria-label="新增出門模式">
              <PlusIcon size={18} />
            </button>
          </div>
        </Station>
      </div>

      <nav className="mt-auto border-t border-ink">
        <button onClick={onPlan} className="flex w-full items-center justify-between border-b border-line px-5 py-4 font-bold text-ink">
          <span>明天的計劃</span>
          <span>→</span>
        </button>
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
