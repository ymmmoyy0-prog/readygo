"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Preset, Session, Settings } from "@/lib/types";
import { fmtClock, todayKey } from "@/lib/time";
import type { LiveTransit, Target } from "@/lib/target";
import { listDepartures } from "@/lib/target";
import { speak } from "@/lib/speech";
import ShareModal from "./ShareModal";
import Modal from "./Modal";
import TimeField from "./TimeField";
import TransitBadge from "./TransitBadge";
import RouteView from "./RouteView";
import AddModePanel from "./AddModePanel";
import Collapse from "./Collapse";
import { Logo } from "./StationClock";
import {
  AddSquareIcon,
  BusIcon,
  CarIcon,
  ClockIcon,
  ListIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RefreshIcon,
  ShareUpIcon,
  SpeakerIcon,
  TrainIcon,
  TrashIcon,
} from "./Icons";

type StepState = "done" | "current" | "todo";
type LiveProps = LiveTransit & { error: string | null; loading: boolean; updatedAt: number | null; refresh: () => Promise<void> };

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
  title,
  caption,
  last,
  expand,
  children,
}: {
  n: number;
  state: StepState;
  icon: ReactNode;
  title: string;
  caption: string;
  last?: boolean;
  expand?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="relative">
      {!last && (
        <span
          className={`absolute bottom-0 left-[calc(1.25rem+16px)] top-[34px] w-[3px] ${state === "done" ? "bg-ink" : "bg-line"}`}
          aria-hidden
        />
      )}
      <div className="grid grid-cols-[34px_1fr] gap-x-4 px-5">
        <div className="relative z-10 pt-4">
          <Node n={n} state={state} />
          <div className={`mt-2 flex justify-center bg-paper py-1 ${state === "todo" ? "text-faint" : "text-ink"}`}>{icon}</div>
        </div>
        <div className={`min-w-0 pb-5 pt-4 ${state === "todo" ? "opacity-45" : ""}`}>
          <h2 className="text-[17px] font-extrabold leading-tight text-ink">{title}</h2>
          <p className="mb-3 mt-0.5 text-[13px] text-sub">{caption}</p>
          {children}
        </div>
      </div>
      {expand && <div className="relative z-10">{expand}</div>}
    </section>
  );
}

/** 向左滑出刪除鍵 */
function SwipeRow({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const W = 72;
  const [x, setX] = useState(0);
  const start = useRef<{ x: number; y: number; base: number; horiz: boolean | null } | null>(null);
  return (
    <div className="relative overflow-hidden border-b border-line">
      <button onClick={onDelete} className="absolute inset-y-0 right-0 flex w-[72px] items-center justify-center bg-danger text-white" aria-label="刪除">
        <TrashIcon />
      </button>
      <div
        className="relative bg-paper transition-transform duration-150"
        style={{ transform: `translateX(${x}px)` }}
        onTouchStart={(e) => {
          start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: x, horiz: null };
        }}
        onTouchMove={(e) => {
          const s = start.current;
          if (!s) return;
          const dx = e.touches[0].clientX - s.x;
          const dy = e.touches[0].clientY - s.y;
          if (s.horiz === null && Math.abs(dx) + Math.abs(dy) > 8) s.horiz = Math.abs(dx) > Math.abs(dy);
          if (s.horiz) setX(Math.max(-W, Math.min(0, s.base + dx)));
        }}
        onTouchEnd={() => {
          setX((v) => (v < -W / 2 ? -W : 0));
          start.current = null;
        }}
      >
        {children}
      </div>
    </div>
  );
}

function isIosBrowser() {
  if (typeof navigator === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return ios && !standalone;
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
  onAdd,
  onDelete,
  onResume,
  onPlan,
  historyCount,
  onClearHistory,
}: {
  historyCount: number;
  onClearHistory: () => void;
  presets: Preset[];
  settings: Settings;
  session: Session | null;
  target: Target;
  live: LiveProps;
  onSettings: (s: Settings) => void;
  onStart: (p: Preset, planId?: string) => void;
  onEdit: (id: string | null) => void;
  onAdd: (p: Preset) => void;
  onDelete: (id: string) => void;
  onResume: () => void;
  onPlan: () => void;
}) {
  const [sharing, setSharing] = useState<Preset | Preset[] | null>(null);
  const [confirmDel, setConfirmDel] = useState<Preset | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [openTransit, setOpenTransit] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [a2hs, setA2hs] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullStart = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("readygo.a2hs") === "1";
    } catch {
      /* ignore */
    }
    setA2hs(!dismissed && isIosBrowser());
  }, []);

  const arrive = settings.timeMode === "arrive";
  const time = arrive ? settings.arriveTime : settings.leaveTime;
  const setTime = (v: string) => onSettings(arrive ? { ...settings, arriveTime: v } : { ...settings, leaveTime: v });
  const todays = settings.plans
    .filter((p) => p.date === todayKey(now))
    .map((plan) => ({ plan, preset: presets.find((x) => x.id === plan.presetId) }))
    .filter((x): x is { plan: typeof x.plan; preset: Preset } => !!x.preset);
  const upcoming = settings.plans.filter((p) => p.date >= todayKey(now)).length;
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

  const doRefresh = async () => {
    setRefreshing(true);
    await live.refresh();
    setRefreshing(false);
  };

  return (
    <main
      className="mx-auto flex min-h-dvh max-w-lg flex-col bg-paper"
      onTouchStart={(e) => {
        pullStart.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
      }}
      onTouchMove={(e) => {
        if (pullStart.current === null) return;
        const dy = e.touches[0].clientY - pullStart.current;
        setPull(dy > 0 ? Math.min(90, dy * 0.5) : 0);
      }}
      onTouchEnd={() => {
        if (pull > 55 && route) doRefresh();
        setPull(0);
        pullStart.current = null;
      }}
    >
      {/* 下拉更新 */}
      {route && (pull > 0 || refreshing) && (
        <div className="flex items-center justify-center gap-2 bg-brand-soft text-[13px] text-sub" style={{ height: refreshing ? 40 : pull }}>
          <span className={refreshing ? "animate-spin" : ""} style={{ transform: refreshing ? undefined : `rotate(${pull * 4}deg)` }}>
            <RefreshIcon size={18} />
          </span>
          {refreshing ? "更新中" : pull > 55 ? "放開更新班次" : "下拉更新班次"}
          {live.updatedAt && !refreshing && <span className="tnum">・{new Date(live.updatedAt).toLocaleTimeString("zh-HK", { hour12: false })}</span>}
        </div>
      )}

      <header className="flex items-center gap-2.5 border-b-[3px] border-ink px-5 py-4">
        <Logo size={28} />
        <h1 className="text-xl font-extrabold text-ink">出門精算師</h1>
        {route && (
          <button onClick={doRefresh} className="ml-auto text-ink" aria-label="更新班次">
            <span className={refreshing ? "inline-block animate-spin" : "inline-block"}>
              <RefreshIcon size={20} />
            </span>
          </button>
        )}
      </header>

      {a2hs && (
        <div className="flex items-center gap-2 border-b border-ink bg-warn-soft px-5 py-2.5 text-ink">
          <ShareUpIcon size={22} />
          <span aria-hidden>→</span>
          <AddSquareIcon size={22} />
          <span className="text-[14px] font-semibold">加到主畫面</span>
          <button
            onClick={() => {
              setA2hs(false);
              try {
                localStorage.setItem("readygo.a2hs", "1");
              } catch {
                /* ignore */
              }
            }}
            className="ml-auto h-8 w-8 text-lg"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>
      )}

      {session && !session.finishedAt && (
        <button onClick={onResume} className="flex w-full items-center justify-between bg-ink px-5 py-3.5 text-left text-white">
          <span className="font-bold">進行中：{session.presetName}</span>
          <span className="font-bold">繼續 →</span>
        </button>
      )}

      {todays.map(({ plan, preset }) => (
        <div key={plan.id} className="flex items-center justify-between gap-3 border-b border-ink bg-warn-soft px-5 py-3">
          <span className="min-w-0 truncate text-[15px] text-ink">
            <b>{plan.name || preset.name}</b>・{plan.mode === "arrive" ? `${plan.time} 到達` : `${plan.time} 出門`}
          </span>
          <button onClick={() => onStart(preset, plan.id)} className="h-10 shrink-0 bg-ink px-3 text-[15px] font-bold text-white">
            開始
          </button>
        </div>
      ))}

      <div className="pt-2">
        {/* ① 時間 */}
        <Station n={1} state={state(1)} icon={<ClockIcon />} title="時間" caption="設定今日出門或到達的時間">
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
          title="交通"
          caption="選擇交通工具，自動計算出門時間"
          expand={
            <Collapse open={openTransit}>
              <RouteView embedded settings={settings} live={live} onSettings={onSettings} onBack={() => setOpenTransit(false)} />
            </Collapse>
          }
        >
          {route ? (
            <button onClick={() => setOpenTransit((o) => !o)} className="block w-full text-left">
              <div className="flex min-w-0 items-center gap-2 text-[15px] text-ink">
                <TransitBadge route={route} />
                {route.co !== "CAR" && route.co !== "MTR" && (
                  <span className="truncate text-sub">
                    {route.from.name} → {route.to.name}
                  </span>
                )}
                <span className={`ml-auto shrink-0 text-sub transition-transform duration-300 ${openTransit ? "rotate-180" : ""}`}>▼</span>
              </div>
              <div className="mt-2 flex items-end justify-between gap-3">
                <span className="tnum text-[15px] text-ink">{shownDep ? `${fmtClock(shownDep.board)} 班次` : ""}</span>
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
                onClick={() => setOpenTransit((o) => !o)}
                className={`flex h-16 w-full items-center justify-center gap-5 border-[1.5px] text-ink ${
                  state(2) === "current" ? "border-danger" : "border-dashed border-ink"
                }`}
                aria-label="設定交通"
                aria-expanded={openTransit}
              >
                <BusIcon size={26} />
                <TrainIcon size={26} />
                <CarIcon size={26} />
                <span className="text-danger">
                  <PlusIcon size={26} />
                </span>
              </button>
              {!settings.transitSkipped && !openTransit && (
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
        <Station n={3} state={state(3)} icon={<ListIcon />} title="出門所需時間" caption="選擇準備所需時間，按「開始」計時" last>
          {/* 語音提示開關 */}
          <div className="mb-3 flex items-center gap-3 border-y border-line py-2.5">
            <SpeakerIcon size={22} off={settings.muted} />
            <span className="text-[15px] font-bold text-ink">語音提示</span>
            <button
              onClick={() => speak("語音提示已開啟")}
              disabled={settings.muted}
              className="flex items-center gap-1 border border-ink px-2 py-1 text-[13px] font-bold text-ink disabled:opacity-30"
            >
              <PlayIcon size={11} />
              試聽
            </button>
            <button
              role="switch"
              aria-checked={!settings.muted}
              aria-label="語音提示"
              onClick={() => onSettings({ ...settings, muted: !settings.muted })}
              className="ml-auto"
            >
              <svg width="52" height="30" viewBox="0 0 52 30" aria-hidden>
                <rect
                  x="1"
                  y="1"
                  width="50"
                  height="28"
                  rx="14"
                  fill={settings.muted ? "#d9d9d9" : "#1f7a45"}
                  style={{ transition: "fill 0.25s ease" }}
                />
                <circle
                  cx="15"
                  cy="15"
                  r="11"
                  fill="#fff"
                  style={{
                    transform: settings.muted ? "translateX(0)" : "translateX(22px)",
                    transition: "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
              </svg>
            </button>
          </div>

          <div className="border-t border-ink">
            {presets.map((p) => {
              const total = p.steps.reduce((a, s) => a + s.minutes, 0);
              const startBy = target.leaveAt !== null ? target.leaveAt - total * 60_000 : null;
              const late = startBy !== null && startBy < now;
              return (
                <SwipeRow key={p.id} onDelete={() => setConfirmDel(p)}>
                  <div className="grid grid-cols-[3.3rem_1fr_auto_auto_auto] items-center gap-2 py-3">
                    <span className={`tnum text-[1.05rem] font-extrabold ${late ? "text-danger" : "text-ink"}`}>
                      {startBy !== null ? fmtClock(startBy) : "--:--"}
                    </span>
                    <span className="min-w-0 truncate text-[16px] font-extrabold text-ink">{p.name}</span>
                    <span className="tnum text-[14px] text-sub">{total}′</span>
                    <button onClick={() => onEdit(p.id)} className="flex h-10 w-9 items-center justify-center text-ink" aria-label={`編輯${p.name}`}>
                      <PencilIcon size={19} />
                    </button>
                    <button
                      onClick={() => onStart(p)}
                      disabled={p.steps.length === 0}
                      className="h-10 bg-ink px-3 text-[15px] font-bold text-white disabled:opacity-40"
                    >
                      開始
                    </button>
                  </div>
                </SwipeRow>
              );
            })}
            <button
              onClick={() => setOpenAdd((o) => !o)}
              className="flex w-full items-center gap-2 py-3 text-left text-ink"
              aria-label="新增出門模式"
              aria-expanded={openAdd}
            >
              <span className={`transition-transform duration-300 ${openAdd ? "rotate-45" : ""}`}>
                <PlusIcon size={20} />
              </span>
              <span className="text-[15px] font-bold">建立你的出門模式</span>
            </button>
            <Collapse open={openAdd}>
              <AddModePanel
                onAdd={(p) => {
                  onAdd(p);
                  setOpenAdd(false);
                }}
                onBlank={() => onEdit(null)}
              />
            </Collapse>
          </div>
        </Station>
      </div>

      <nav className="mt-auto border-t border-ink">
        <button onClick={onPlan} className="flex w-full items-center justify-between border-b border-line px-5 py-4 font-bold text-ink">
          <span>
            行程預約
            {upcoming > 0 && <span className="tnum ml-2 bg-ink px-1.5 py-0.5 text-[12px] text-white">{upcoming}</span>}
          </span>
          <span>→</span>
        </button>
        {presets.length > 1 && (
          <button onClick={() => setSharing(presets)} className="w-full border-b border-line px-5 py-4 text-left text-[15px] text-sub">
            分享／備份全部模式
          </button>
        )}
        <button
          onClick={() => setConfirmClear(true)}
          disabled={historyCount === 0}
          className="flex w-full items-center gap-2 px-5 py-4 text-left text-[15px] text-danger disabled:text-faint"
        >
          <TrashIcon size={18} />
          清除計時記錄
          <span className="tnum ml-auto text-[13px] text-sub">{historyCount} 筆</span>
        </button>
      </nav>

      <Modal open={confirmClear} title="清除全部計時記錄？" onClose={() => setConfirmClear(false)}>
        <p className="mb-5 text-[15px] text-sub">共 {historyCount} 筆，清除後無法復原，耗時建議會重新學習。出門模式及交通設定不受影響。</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setConfirmClear(false)} className="h-14 border-[1.5px] border-ink font-bold text-ink">
            取消
          </button>
          <button
            onClick={() => {
              onClearHistory();
              setConfirmClear(false);
            }}
            className="h-14 bg-danger font-bold text-white"
          >
            清除
          </button>
        </div>
      </Modal>

      <Modal open={!!confirmDel} title={`刪除「${confirmDel?.name ?? ""}」？`} onClose={() => setConfirmDel(null)}>
        <p className="mb-5 text-[15px] text-sub">此模式及其耗時紀錄將一併刪除，無法復原。</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setConfirmDel(null)} className="h-14 border-[1.5px] border-ink font-bold text-ink">
            取消
          </button>
          <button
            onClick={() => {
              onDelete(confirmDel!.id);
              setConfirmDel(null);
            }}
            className="h-14 bg-danger font-bold text-white"
          >
            刪除
          </button>
        </div>
      </Modal>

      <ShareModal preset={sharing} onClose={() => setSharing(null)} />
    </main>
  );
}
