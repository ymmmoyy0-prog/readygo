"use client";
import { useMemo, useState } from "react";
import type { Preset, Step, StepRecord } from "@/lib/types";
import { uid } from "@/lib/id";
import { scaleSteps } from "@/lib/defaults";
import { applySuggestions, getSuggestions } from "@/lib/stats";
import { fmtDuration } from "@/lib/time";
import ShareModal from "./ShareModal";
import Ruler from "./Ruler";
import Bump from "./Bump";

export default function EditorView({
  initial,
  isNew,
  onboarding,
  history,
  onSave,
  onDelete,
  onCancel,
}: {
  initial: Preset;
  isNew: boolean;
  onboarding: boolean;
  history: StepRecord[];
  onSave: (p: Preset, addOthers: boolean) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Preset>(initial);
  const [sharing, setSharing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [addOthers, setAddOthers] = useState(false);
  const [totalInput, setTotalInput] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const suggestions = useMemo(() => getSuggestions(draft, history), [draft, history]);
  const total = draft.steps.reduce((a, s) => a + (s.minutes || 0), 0);

  const updateStep = (id: string, patch: Partial<Step>) =>
    setDraft((d) => ({ ...d, steps: d.steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const steps = [...d.steps];
      const j = i + dir;
      if (j < 0 || j >= steps.length) return d;
      [steps[i], steps[j]] = [steps[j], steps[i]];
      return { ...d, steps };
    });

  const applyTotal = () => {
    const t = Math.round(Number(totalInput));
    if (!Number.isFinite(t) || t < 1) return;
    setDraft((d) => ({ ...d, steps: scaleSteps(d.steps.map((s) => ({ ...s, minutes: s.minutes || 1 })), t) }));
    setTotalInput("");
  };

  const cleaned = (): Preset => ({
    ...draft,
    name: draft.name.trim() || "我的出門模式",
    updatedAt: Date.now(),
    steps: draft.steps
      .filter((s) => s.name.trim())
      .map((s) => ({ ...s, name: s.name.trim(), minutes: Math.min(240, Math.max(1, Math.round(s.minutes || 1))) })),
  });

  const valid = draft.steps.some((s) => s.name.trim());

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-36 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onCancel} className="h-11 px-1 text-[17px] font-semibold text-sub">
          ← 返回
        </button>
        {!isNew && (
          <button onClick={() => setSharing(true)} className="h-11 px-2 font-semibold text-ink">
            分享
          </button>
        )}
      </div>

      <h1 className="mb-1 text-2xl font-extrabold text-ink">
        {onboarding ? "設定你的出門步驟" : isNew ? "新增出門模式" : "編輯出門模式"}
      </h1>
      <p className="mb-5 text-[15px] leading-relaxed text-sub">
        {onboarding ? "按個人習慣修改名稱及時間，不適用的步驟可以刪除。" : "步驟名稱、時間及次序均可隨時修改。"}
      </p>

      <label htmlFor="preset-name" className="mb-1 block text-sm font-semibold text-sub">
        模式名稱
      </label>
      <input
        id="preset-name"
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="例如：上班日常"
        maxLength={40}
        className="mb-4 h-14 w-full border border-line bg-card px-4 text-xl font-bold text-ink placeholder:font-normal placeholder:text-faint"
      />

      {/* 總時長 */}
      <section className="mb-4 border border-ink p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="font-semibold text-sub">總時長</span>
          <span className="tnum text-3xl font-extrabold text-ink">
            <Bump value={total} />
            <span className="ml-1 text-base font-semibold text-sub">分鐘</span>
          </span>
        </div>
        <Ruler steps={draft.steps.map((s) => ({ name: s.name, minutes: s.minutes || 0 }))} />
        {advanced && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={totalInput}
            onChange={(e) => setTotalInput(e.target.value)}
            placeholder="例如 25"
            aria-label="目標總分鐘"
            className="tnum h-12 w-24 border border-line bg-paper text-center text-lg font-bold text-ink placeholder:font-normal placeholder:text-faint"
          />
          <button
            onClick={applyTotal}
            disabled={!totalInput}
            className="h-12 flex-1 border border-brand/30 bg-brand-soft font-semibold text-ink disabled:opacity-40"
          >
            按比例調整至此總時長
          </button>
        </div>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="mb-4 border border-warn/25 bg-warn-soft p-4">
          <h3 className="mb-2 font-bold text-warn">根據實際耗時的建議</h3>
          <ul className="mb-3 space-y-2 text-[15px] leading-relaxed text-ink">
            {suggestions.map((s) => (
              <li key={s.stepId}>
                <span className="font-semibold">{s.name}</span>：預設 {s.plannedMin} 分鐘，實際平均{" "}
                {fmtDuration(s.avgSec)}，建議 <span className="font-bold">{s.suggestedMin} 分鐘</span>
                <span className="block text-sm text-sub">{s.reason}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setDraft(applySuggestions(draft, suggestions))}
            className="h-12 w-full bg-warn font-bold text-white"
          >
            一鍵更新為實際平均時間
          </button>
        </section>
      )}

      <h2 className="mb-2 text-sm font-semibold text-sub">步驟</h2>
      <ol className="space-y-3">
        {draft.steps.map((s, i) => (
          <li key={s.id} className="border border-ink p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-brand-soft text-sm font-bold text-ink">
                {i + 1}
              </span>
              <input
                value={s.name}
                onChange={(e) => updateStep(s.id, { name: e.target.value })}
                placeholder="步驟名稱，例如：更衣"
                maxLength={30}
                aria-label={`第 ${i + 1} 步名稱`}
                className="h-12 min-w-0 flex-1 border border-line bg-paper px-3 text-[17px] font-semibold text-ink placeholder:font-normal placeholder:text-faint"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-10">
              <div className="flex items-center overflow-hidden border border-line bg-paper">
                <button
                  onClick={() => updateStep(s.id, { minutes: Math.max(1, (s.minutes || 1) - 1) })}
                  className="h-11 w-11 text-xl text-sub"
                  aria-label="減少一分鐘"
                >
                  −
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={240}
                  value={s.minutes || ""}
                  onChange={(e) => updateStep(s.id, { minutes: Number(e.target.value) })}
                  aria-label={`第 ${i + 1} 步分鐘`}
                  className="tnum h-11 w-12 bg-transparent text-center text-lg font-bold text-ink"
                />
                <button
                  onClick={() => updateStep(s.id, { minutes: Math.min(240, (s.minutes || 0) + 1) })}
                  className="h-11 w-11 text-xl text-sub"
                  aria-label="增加一分鐘"
                >
                  ＋
                </button>
              </div>
              <span className="text-[15px] text-sub">分鐘</span>
              {advanced && (
              <button
                onClick={() => updateStep(s.id, { core: !s.core })}
                className={`h-9 px-3 text-sm font-semibold ${
                  s.core ? "bg-brand-soft text-ink" : "border border-line text-sub"
                }`}
                title="必做步驟在緊急壓縮時不會被建議跳過"
              >
                {s.core ? "必做" : "可跳過"}
              </button>
              )}
              <div className="ml-auto flex gap-1">
                <IconBtn label="上移" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </IconBtn>
                <IconBtn label="下移" onClick={() => move(i, 1)} disabled={i === draft.steps.length - 1}>
                  ↓
                </IconBtn>
                <IconBtn
                  label="刪除步驟"
                  onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((x) => x.id !== s.id) }))}
                  danger
                >
                  ✕
                </IconBtn>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <button
        onClick={() =>
          setDraft((d) => ({ ...d, steps: [...d.steps, { id: uid(), name: "", minutes: 5, core: true }] }))
        }
        className="mt-3 h-14 w-full border-[1.5px] border-dashed border-ink font-semibold text-sub"
      >
        ＋ 新增步驟
      </button>

      <button onClick={() => setAdvanced((a) => !a)} className="mt-4 text-[15px] font-semibold text-ink underline underline-offset-4">
        {advanced ? "收起進階設定" : "進階設定"}
      </button>
      {advanced && (
        <p className="mt-2 text-[15px] leading-relaxed text-sub">
          <span className="font-semibold text-ink">必做</span>：按「時間不足」時必定保留。
          <span className="font-semibold text-ink">可跳過</span>：時間極度緊迫時會建議跳過。
        </p>
      )}

      {onboarding && (
        <label className="border border-ink mt-5 flex items-center gap-3 p-4">
          <input
            type="checkbox"
            checked={addOthers}
            onChange={(e) => setAddOthers(e.target.checked)}
            className="h-6 w-6 accent-[var(--color-brand)]"
          />
          <span className="text-[15px] leading-snug text-ink">同時加入其他快速模板（20／30／60 分鐘），方便按日子切換</span>
        </label>
      )}

      {!isNew && (
        <button
          onClick={() => (confirmDel ? onDelete(draft.id) : setConfirmDel(true))}
          className={`mt-6 h-12 w-full font-semibold ${
            confirmDel ? "bg-danger text-white" : "border border-danger/30 text-danger"
          }`}
        >
          {confirmDel ? "再按一次確認刪除" : "刪除此模式"}
        </button>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2">
          <button onClick={onCancel} className="h-14 flex-1 border border-line bg-card text-lg font-semibold text-ink">
            取消
          </button>
          <button
            disabled={!valid}
            onClick={() => onSave(cleaned(), addOthers)}
            className="h-14 flex-[2] bg-ink text-lg font-bold text-white active:bg-brand-strong disabled:opacity-40"
          >
            {onboarding ? "完成設定" : "儲存"}
          </button>
        </div>
      </div>

      <ShareModal preset={sharing ? cleaned() : null} onClose={() => setSharing(false)} />
    </main>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`h-10 w-10 border border-line bg-paper text-lg disabled:opacity-30 ${
        danger ? "text-danger" : "text-sub"
      }`}
    >
      {children}
    </button>
  );
}
