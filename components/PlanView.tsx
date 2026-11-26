"use client";
import { useRef, useState } from "react";
import type { Plan, Preset, Settings, TimeMode } from "@/lib/types";
import { dateTimeToEpoch, fmtClock, todayKey } from "@/lib/time";
import { doorToDoorMin } from "@/lib/target";
import { estimateDoorToDoorMin } from "@/lib/transit";
import { uid } from "@/lib/id";
import TimeField from "./TimeField";
import TransitBadge from "./TransitBadge";
import AddModePanel from "./AddModePanel";
import Collapse from "./Collapse";
import Bump from "./Bump";
import { RouteEditor } from "./RouteView";
import { BusIcon, CarIcon, PlusIcon, TrainIcon } from "./Icons";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

function dateLabel(key: string, now: number) {
  if (key === todayKey(now)) return "今天";
  if (key === todayKey(now, 1)) return "明天";
  const [y, m, d] = key.split("-").map(Number);
  return `${m}/${d}（${WEEK[new Date(y, m - 1, d).getDay()]}）`;
}

/** 此行程的門到門分鐘：有專用交通用專用，否則沿用平日 */
export function planTravelMin(plan: Plan, settings: Settings) {
  return plan.transit ? estimateDoorToDoorMin(plan.transit, settings.transit.doorBufferMin) : doorToDoorMin(settings);
}

/** 計算鬧鐘、開始準備、出門時間 */
export function planTimes(plan: Plan, preset: Preset | undefined, settings: Settings) {
  const total = plan.minutes ?? (preset ? preset.steps.reduce((a, s) => a + s.minutes, 0) : 0);
  const at = dateTimeToEpoch(plan.date, plan.time);
  if (at === null) return null;
  const leaveAt = plan.mode === "arrive" ? at - planTravelMin(plan, settings) * 60_000 : at;
  const startAt = leaveAt - total * 60_000;
  return { total, leaveAt, startAt, alarmAt: startAt - plan.wakeBufferMin * 60_000 };
}

export default function PlanView({
  presets,
  settings,
  onSettings,
  onAddPreset,
  onBlankPreset,
  onBack,
}: {
  presets: Preset[];
  settings: Settings;
  onSettings: (s: Settings) => void;
  onAddPreset: (p: Preset) => Preset;
  onBlankPreset: () => void;
  onBack: () => void;
}) {
  const now = Date.now();
  const blank = (): Plan => ({
    id: uid(),
    name: "",
    presetId: presets[0]?.id ?? "",
    minutes: null,
    mode: settings.timeMode,
    time: (settings.timeMode === "arrive" ? settings.arriveTime : settings.leaveTime) || "09:00",
    wakeBufferMin: 10,
    date: todayKey(now, 1),
    transit: null,
  });
  const [draft, setDraft] = useState<Plan>(blank);
  const [saved, setSaved] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const plans = settings.plans.filter((p) => p.date >= todayKey(now)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const isNew = !settings.plans.some((p) => p.id === draft.id);

  const save = (p: Plan) => {
    const rest = settings.plans.filter((x) => x.id !== p.id && x.date >= todayKey(now));
    onSettings({ ...settings, plans: [...rest, p] });
    setSaved(p.name || presets.find((x) => x.id === p.presetId)?.name || "行程");
    setDraft(blank());
    setTimeout(() => setSaved(null), 2500);
  };
  const remove = (id: string) => {
    onSettings({ ...settings, plans: settings.plans.filter((x) => x.id !== id) });
    setDraft(blank());
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-paper pb-28">
      <div ref={topRef} className="flex items-center justify-between border-b-[3px] border-ink px-4 py-3">
        <button onClick={onBack} className="h-10 font-semibold text-ink">
          ← 返回
        </button>
        <b className="text-ink">超前規劃</b>
        <span className="w-12" />
      </div>
      <p className="border-b border-line px-5 py-3 text-[13px] text-sub">
        預先安排出門行程，計算應於何時起床及開始準備；當天主頁會顯示行程，一按即可開始。
      </p>

      <Collapse open={!!saved}>
        <p className="bg-ok-soft px-5 py-2.5 text-[15px] font-bold text-ok">✓ 已加入「{saved}」，見下方已安排行程</p>
      </Collapse>

      <PlanEditor
        key={draft.id}
        initial={draft}
        isNew={isNew}
        presets={presets}
        settings={settings}
        onAddPreset={onAddPreset}
        onBlankPreset={onBlankPreset}
        onSave={save}
        onDelete={remove}
        onCancelEdit={() => setDraft(blank())}
      />

      {plans.length > 0 && (
        <section className="mt-6 border-t-[1.5px] border-ink">
          <h2 className="px-5 pb-1 pt-4 text-[15px] font-extrabold text-ink">已安排行程</h2>
          {plans.map((p) => {
            const preset = presets.find((x) => x.id === p.presetId);
            const t = planTimes(p, preset, settings);
            const active = p.id === draft.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setDraft(p);
                  topRef.current?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`grid w-full grid-cols-[4.2rem_1fr_auto] items-center gap-3 border-b border-line px-5 py-3.5 text-left ${active ? "bg-brand-soft" : ""}`}
              >
                <span className="text-[14px] font-bold text-ink">{dateLabel(p.date, now)}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-extrabold text-ink">{p.name || preset?.name || "行程"}</span>
                  <span className="tnum text-[13px] text-sub">
                    {p.mode === "arrive" ? `${p.time} 到達` : `${p.time} 出門`}・{preset?.name ?? "—"}
                  </span>
                </span>
                {t && (
                  <span className="text-right">
                    <span className="block text-[11px] text-sub">鬧鐘</span>
                    <span className="tnum text-[1.2rem] font-extrabold text-ink">{fmtClock(t.alarmAt)}</span>
                  </span>
                )}
              </button>
            );
          })}
        </section>
      )}
    </main>
  );
}

function PlanEditor({
  initial,
  isNew,
  presets,
  settings,
  onAddPreset,
  onBlankPreset,
  onSave,
  onDelete,
  onCancelEdit,
}: {
  initial: Plan;
  isNew: boolean;
  presets: Preset[];
  settings: Settings;
  onAddPreset: (p: Preset) => Preset;
  onBlankPreset: () => void;
  onSave: (p: Plan) => void;
  onDelete: (id: string) => void;
  onCancelEdit: () => void;
}) {
  const now = Date.now();
  const [p, setP] = useState<Plan>(initial);
  const [adding, setAdding] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (patch: Partial<Plan>) => setP((x) => ({ ...x, ...patch }));
  const preset = presets.find((x) => x.id === p.presetId);
  const baseTotal = preset ? preset.steps.reduce((a, s) => a + s.minutes, 0) : 0;
  const total = p.minutes ?? baseTotal;
  const t = planTimes(p, preset, settings);
  const route = p.transit ?? settings.transit.primary;

  const row = "border-b border-line px-5 py-3";
  const label = "block text-[13px] text-sub";

  return (
    <>
      <div className="flex items-center justify-between px-5 pb-1 pt-4">
        <h2 className="text-[17px] font-extrabold text-ink">{isNew ? "預約新行程" : "修改行程"}</h2>
        {!isNew && (
          <button onClick={onCancelEdit} className="text-[14px] text-sub underline underline-offset-4">
            改為新增
          </button>
        )}
      </div>

      <label className={row}>
        <span className={label}>行程名稱</span>
        <input
          value={p.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="例如：週末出遊"
          maxLength={30}
          className="mt-1 h-11 w-full border-[1.5px] border-ink px-3 text-[17px] font-bold text-ink placeholder:font-normal placeholder:text-faint"
        />
      </label>

      <div className={row}>
        <span className={label}>日期</span>
        <div className="mt-1 flex gap-1.5">
          {[0, 1].map((d) => (
            <button
              key={d}
              onClick={() => set({ date: todayKey(now, d) })}
              className={`h-11 px-4 font-bold ${p.date === todayKey(now, d) ? "bg-ink text-white" : "border-[1.5px] border-ink text-ink"}`}
            >
              {d ? "明天" : "今天"}
            </button>
          ))}
          <input
            type="date"
            value={p.date}
            min={todayKey(now)}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            className="h-11 min-w-0 flex-1 border-[1.5px] border-ink px-2 text-[15px] font-bold text-ink"
            aria-label="選擇日期"
          />
        </div>
      </div>

      <div className={row}>
        <span className={label}>出門模式</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((x) => (
            <button
              key={x.id}
              onClick={() => set({ presetId: x.id, minutes: null })}
              className={`px-3 py-2 text-[14px] font-bold ${p.presetId === x.id ? "bg-ink text-white" : "border-[1.5px] border-ink text-ink"}`}
            >
              {x.name} <span className="tnum font-normal opacity-70">{x.steps.reduce((a, s) => a + s.minutes, 0)}′</span>
            </button>
          ))}
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-1 border-[1.5px] border-dashed border-ink px-3 py-2 text-[14px] font-bold text-ink"
            aria-expanded={adding}
          >
            <span className={`transition-transform duration-300 ${adding ? "rotate-45" : ""}`}>
              <PlusIcon size={14} />
            </span>
            新增
          </button>
        </div>
        <Collapse open={adding}>
          <div className="mt-2">
            <AddModePanel
              onAdd={(np) => {
                const added = onAddPreset(np);
                set({ presetId: added.id, minutes: null });
                setAdding(false);
              }}
              onBlank={onBlankPreset}
            />
          </div>
        </Collapse>
        {preset && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[14px] text-ink">
              只限今次
              {p.minutes !== null && p.minutes !== baseTotal && <span className="ml-1 text-sub">（原本 {baseTotal} 分鐘）</span>}
            </span>
            <span className="flex items-center border-[1.5px] border-ink">
              <button onClick={() => set({ minutes: Math.max(5, total - 5) })} className="h-10 w-10 text-xl text-ink" aria-label="減少五分鐘">
                −
              </button>
              <span className="tnum w-16 text-center font-extrabold text-ink">
                <Bump value={total} /> 分
              </span>
              <button onClick={() => set({ minutes: Math.min(240, total + 5) })} className="h-10 w-10 text-xl text-ink" aria-label="增加五分鐘">
                ＋
              </button>
            </span>
          </div>
        )}
      </div>

      <div className={row}>
        <div className="mb-2 grid grid-cols-2 border-[1.5px] border-ink">
          {(["leave", "arrive"] as TimeMode[]).map((m, i) => (
            <button
              key={m}
              onClick={() => set({ mode: m })}
              className={`h-10 text-[15px] font-bold ${i ? "border-l-[1.5px] border-ink" : ""} ${p.mode === m ? "bg-ink text-white" : "text-ink"}`}
            >
              {m === "leave" ? "出門時間" : "到達時間"}
            </button>
          ))}
        </div>
        <TimeField id="plan-time" value={p.time} onChange={(v) => set({ time: v })} size={32} />
      </div>

      {/* 交通 */}
      <div className="border-b border-line">
        <button onClick={() => setRouteOpen((o) => !o)} className="flex w-full items-center gap-2 px-5 py-3 text-left" aria-expanded={routeOpen}>
          <span className="min-w-0 flex-1">
            <span className={label}>交通{p.mode === "leave" ? "（以到達時間計算時使用）" : ""}</span>
            <span className="mt-1 flex min-w-0 items-center gap-2 text-[15px] text-ink">
              {route ? (
                <>
                  <TransitBadge route={route} />
                  <span className="shrink-0 text-sub">{p.transit ? "此行程專用" : "沿用平日"}</span>
                </>
              ) : (
                <span className="flex items-center gap-3 text-sub">
                  <BusIcon size={20} />
                  <TrainIcon size={20} />
                  <CarIcon size={20} />
                  未設定
                </span>
              )}
              <span className="tnum ml-auto shrink-0 text-sub">路程約 {planTravelMin(p, settings)} 分</span>
            </span>
          </span>
          <span className={`shrink-0 text-sub transition-transform duration-300 ${routeOpen ? "rotate-180" : ""}`}>▼</span>
        </button>
        <Collapse open={routeOpen}>
          <div className="pb-3">
            <RouteEditor
              key={p.transit ? "own" : "daily"}
              initial={p.transit ?? null}
              onSave={(r) => {
                set({ transit: r });
                setRouteOpen(false);
              }}
              onCancel={() => setRouteOpen(false)}
            />
            {p.transit && (
              <div className="px-5 pt-2">
                <button
                  onClick={() => {
                    set({ transit: null });
                    setRouteOpen(false);
                  }}
                  className="w-full border-[1.5px] border-ink py-3 font-bold text-ink"
                >
                  改回沿用平日交通
                </button>
              </div>
            )}
          </div>
        </Collapse>
      </div>

      <div className="flex items-center justify-between border-b border-ink px-5 py-3">
        <span>
          <span className={label}>起床緩衝</span>
          <span className="tnum text-lg font-extrabold text-ink">
            <Bump value={p.wakeBufferMin} /> 分鐘
          </span>
        </span>
        <span className="flex border-[1.5px] border-ink">
          <button onClick={() => set({ wakeBufferMin: Math.max(0, p.wakeBufferMin - 5) })} className="h-10 w-11 text-xl text-ink" aria-label="起床緩衝減少">
            −
          </button>
          <button
            onClick={() => set({ wakeBufferMin: Math.min(90, p.wakeBufferMin + 5) })}
            className="h-10 w-11 border-l-[1.5px] border-ink text-xl text-ink"
            aria-label="起床緩衝增加"
          >
            ＋
          </button>
        </span>
      </div>

      {t && (
        <section className="px-5 py-5">
          <div className="bg-ink px-5 py-4 text-white">
            <p className="text-sm text-white/70">建議鬧鐘</p>
            <p className="tnum text-[3.2rem] font-extrabold leading-tight">{fmtClock(t.alarmAt)}</p>
          </div>
          <div className="grid grid-cols-2 border-[1.5px] border-t-0 border-ink">
            <div className="px-4 py-3">
              <p className="text-[13px] text-sub">開始準備</p>
              <p className="tnum text-[1.6rem] font-extrabold text-ink">{fmtClock(t.startAt)}</p>
            </div>
            <div className="border-l-[1.5px] border-ink px-4 py-3">
              <p className="text-[13px] text-sub">出門</p>
              <p className="tnum text-[1.6rem] font-extrabold text-ink">{fmtClock(t.leaveAt)}</p>
            </div>
          </div>
          <p className="mt-3 text-[14px] text-sub">請自行將鬧鐘設定為 {fmtClock(t.alarmAt)}。</p>
        </section>
      )}

      {!isNew && (
        <div className="px-5">
          <button
            onClick={() => (confirmDel ? onDelete(p.id) : setConfirmDel(true))}
            className={`h-12 w-full font-bold ${confirmDel ? "bg-danger text-white" : "border-[1.5px] border-danger text-danger"}`}
          >
            {confirmDel ? "再按一次確認刪除" : "刪除此行程"}
          </button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t-[1.5px] border-ink bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-lg">
          <button
            disabled={!preset || !p.time}
            onClick={() => onSave(p)}
            className="h-14 w-full bg-ink text-lg font-bold text-white disabled:opacity-40"
          >
            {isNew ? "加入行程" : "儲存修改"}
          </button>
        </div>
      </div>
    </>
  );
}
