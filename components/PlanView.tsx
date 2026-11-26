"use client";
import { useState } from "react";
import type { Plan, Preset, Settings, TimeMode } from "@/lib/types";
import { dateTimeToEpoch, fmtClock, todayKey } from "@/lib/time";
import { doorToDoorMin } from "@/lib/target";
import { uid } from "@/lib/id";
import TimeField from "./TimeField";
import TransitBadge from "./TransitBadge";
import AddModePanel from "./AddModePanel";
import Collapse from "./Collapse";
import Bump from "./Bump";
import { PlusIcon } from "./Icons";

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

function dateLabel(key: string, now: number) {
  if (key === todayKey(now)) return "今天";
  if (key === todayKey(now, 1)) return "明天";
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}/${d}（${WEEK[dt.getDay()]}）`;
}

/** 計算鬧鐘、開始準備、出門時間 */
export function planTimes(plan: Plan, preset: Preset | undefined, settings: Settings) {
  const total = plan.minutes ?? (preset ? preset.steps.reduce((a, s) => a + s.minutes, 0) : 0);
  const at = dateTimeToEpoch(plan.date, plan.time);
  if (at === null) return null;
  const leaveAt = plan.mode === "arrive" ? at - doorToDoorMin(settings) * 60_000 : at;
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
  const [editing, setEditing] = useState<Plan | null>(null);
  const plans = settings.plans.filter((p) => p.date >= todayKey(now)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const save = (p: Plan) => {
    const rest = settings.plans.filter((x) => x.id !== p.id && x.date >= todayKey(now));
    onSettings({ ...settings, plans: [...rest, p] });
    setEditing(null);
  };
  const remove = (id: string) => {
    onSettings({ ...settings, plans: settings.plans.filter((x) => x.id !== id) });
    setEditing(null);
  };

  if (editing) {
    return (
      <PlanEditor
        key={editing.id}
        initial={editing}
        isNew={!settings.plans.some((p) => p.id === editing.id)}
        presets={presets}
        settings={settings}
        onAddPreset={onAddPreset}
        onBlankPreset={onBlankPreset}
        onSave={save}
        onDelete={remove}
        onBack={() => setEditing(null)}
      />
    );
  }

  const blank = (): Plan => ({
    id: uid(),
    name: "",
    presetId: presets[0]?.id ?? "",
    minutes: null,
    mode: settings.timeMode,
    time: (settings.timeMode === "arrive" ? settings.arriveTime : settings.leaveTime) || "09:00",
    wakeBufferMin: 10,
    date: todayKey(now, 1),
  });

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-paper">
      <div className="flex items-center justify-between border-b-[3px] border-ink px-4 py-3">
        <button onClick={onBack} className="h-10 font-semibold text-ink">
          ← 返回
        </button>
        <b className="text-ink">行程預約</b>
        <span className="w-12" />
      </div>
      <p className="px-5 pt-3 text-[13px] text-sub">預先安排出門行程，計算應於何時起床及開始準備；當天主頁會顯示行程，一按即可開始。</p>

      <div className="mt-3 border-t border-ink">
        {plans.map((p) => {
          const preset = presets.find((x) => x.id === p.presetId);
          const t = planTimes(p, preset, settings);
          return (
            <button key={p.id} onClick={() => setEditing(p)} className="grid w-full grid-cols-[4.2rem_1fr_auto] items-center gap-3 border-b border-line px-5 py-3.5 text-left">
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
        <button onClick={() => setEditing(blank())} className="flex w-full items-center gap-2 px-5 py-4 text-left text-ink">
          <PlusIcon size={20} />
          <span className="text-[15px] font-bold">預約新行程</span>
        </button>
      </div>
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
  onBack,
}: {
  initial: Plan;
  isNew: boolean;
  presets: Preset[];
  settings: Settings;
  onAddPreset: (p: Preset) => Preset;
  onBlankPreset: () => void;
  onSave: (p: Plan) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const now = Date.now();
  const [p, setP] = useState<Plan>(initial);
  const [adding, setAdding] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (patch: Partial<Plan>) => setP((x) => ({ ...x, ...patch }));
  const preset = presets.find((x) => x.id === p.presetId);
  const baseTotal = preset ? preset.steps.reduce((a, s) => a + s.minutes, 0) : 0;
  const total = p.minutes ?? baseTotal;
  const t = planTimes(p, preset, settings);
  const route = settings.transit.primary;

  const row = "border-b border-line px-5 py-3";
  const label = "block text-[13px] text-sub";

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col bg-paper pb-28">
      <div className="flex items-center justify-between border-b-[3px] border-ink px-4 py-3">
        <button onClick={onBack} className="h-10 font-semibold text-ink">
          ← 返回
        </button>
        <b className="text-ink">{isNew ? "預約新行程" : "修改行程"}</b>
        <span className="w-12" />
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
            <PlusIcon size={14} />
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
              <span className="tnum w-16 text-center font-extrabold text-ink"><Bump value={total} /> 分</span>
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
        <div className="flex items-center justify-between gap-3">
          <TimeField id="plan-time" value={p.time} onChange={(v) => set({ time: v })} size={32} />
          {p.mode === "arrive" && (
            <span className="flex min-w-0 items-center gap-1.5 text-[14px] text-sub">
              {route && <TransitBadge route={route} />}
              <span className="shrink-0">路程約 {doorToDoorMin(settings)} 分</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-ink px-5 py-3">
        <span>
          <span className={label}>起床緩衝</span>
          <span className="tnum text-lg font-extrabold text-ink"><Bump value={p.wakeBufferMin} /> 分鐘</span>
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

      <div className="fixed inset-x-0 bottom-0 border-t-[1.5px] border-ink bg-paper px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-lg">
          <button
            disabled={!preset || !p.time}
            onClick={() => onSave(p)}
            className="h-14 w-full bg-ink text-lg font-bold text-white disabled:opacity-40"
          >
            儲存行程
          </button>
        </div>
      </div>
    </main>
  );
}
