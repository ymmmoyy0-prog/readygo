"use client";
import { useMemo, useState } from "react";
import type { Preset, Step, StepRecord } from "@/lib/types";
import { uid } from "@/lib/id";
import { applySuggestions, getSuggestions } from "@/lib/stats";
import { fmtDuration } from "@/lib/time";
import ShareModal from "./ShareModal";

export default function EditorView({
  preset,
  history,
  onSave,
  onDelete,
  onCancel,
}: {
  preset: Preset | null;
  history: StepRecord[];
  onSave: (p: Preset) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Preset>(
    () =>
      preset ?? {
        id: uid(),
        name: "",
        updatedAt: Date.now(),
        steps: [{ id: uid(), name: "", minutes: 5, core: true }],
      }
  );
  const [sharing, setSharing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const isNew = !preset;

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
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-32 pt-5">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onCancel} className="h-11 rounded-xl px-2 text-neutral-400">
          ← 返回
        </button>
        <span className="tnum text-lg font-semibold text-lime-300">總計 {total} 分鐘</span>
      </div>

      <input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder="模式名稱，例如：返工淡妝"
        maxLength={40}
        className="mb-4 h-14 w-full rounded-xl bg-neutral-900 px-4 text-xl font-bold placeholder:text-neutral-600"
      />

      {suggestions.length > 0 && (
        <section className="mb-4 rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4">
          <h3 className="mb-2 font-bold text-amber-300">實際耗時建議</h3>
          <ul className="mb-3 space-y-1 text-sm text-neutral-200">
            {suggestions.map((s) => (
              <li key={s.stepId}>
                {s.name}：預設 {s.plannedMin} 分鐘，實際平均 {fmtDuration(s.avgSec)}（{s.reason}）→ 建議 {s.suggestedMin}{" "}
                分鐘
              </li>
            ))}
          </ul>
          <button
            onClick={() => setDraft(applySuggestions(draft, suggestions))}
            className="h-12 w-full rounded-xl bg-amber-400 font-bold text-black"
          >
            一鍵更新為實際平均時間
          </button>
        </section>
      )}

      <ol className="space-y-3">
        {draft.steps.map((s, i) => (
          <li key={s.id} className="rounded-2xl bg-neutral-900 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="w-6 text-center font-bold text-neutral-500">{i + 1}</span>
              <input
                value={s.name}
                onChange={(e) => updateStep(s.id, { name: e.target.value })}
                placeholder="步驟名稱"
                maxLength={30}
                className="h-12 min-w-0 flex-1 rounded-xl bg-neutral-800 px-3 text-lg placeholder:text-neutral-600"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-8">
              <div className="flex items-center overflow-hidden rounded-xl bg-neutral-800">
                <button
                  onClick={() => updateStep(s.id, { minutes: Math.max(1, s.minutes - 1) })}
                  className="h-11 w-11 text-xl"
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
                  className="tnum h-11 w-14 bg-transparent text-center text-lg font-bold"
                />
                <button
                  onClick={() => updateStep(s.id, { minutes: Math.min(240, s.minutes + 1) })}
                  className="h-11 w-11 text-xl"
                  aria-label="增加一分鐘"
                >
                  ＋
                </button>
              </div>
              <span className="text-neutral-400">分鐘</span>
              <button
                onClick={() => updateStep(s.id, { core: !s.core })}
                className={`h-11 rounded-xl px-3 text-sm font-semibold ${
                  s.core ? "bg-sky-500/20 text-sky-300" : "bg-neutral-800 text-neutral-500"
                }`}
                title="核心步驟在緊急壓縮時不會被建議跳過"
              >
                {s.core ? "核心" : "可跳過"}
              </button>
              <div className="ml-auto flex gap-1">
                <button onClick={() => move(i, -1)} className="h-11 w-10 rounded-xl bg-neutral-800" aria-label="上移">
                  ↑
                </button>
                <button onClick={() => move(i, 1)} className="h-11 w-10 rounded-xl bg-neutral-800" aria-label="下移">
                  ↓
                </button>
                <button
                  onClick={() => setDraft((d) => ({ ...d, steps: d.steps.filter((x) => x.id !== s.id) }))}
                  className="h-11 w-10 rounded-xl bg-neutral-800 text-red-400"
                  aria-label="刪除步驟"
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <button
        onClick={() =>
          setDraft((d) => ({ ...d, steps: [...d.steps, { id: uid(), name: "", minutes: 5, core: true }] }))
        }
        className="mt-3 h-14 w-full rounded-2xl border-2 border-dashed border-neutral-700 font-semibold text-neutral-300"
      >
        ＋ 新增步驟
      </button>

      <p className="mt-3 text-sm text-neutral-500">「核心」步驟喺按「來不及了」時一定保留；「可跳過」步驟喺時間極度緊迫時會被建議跳過。</p>

      {!isNew && (
        <div className="mt-6 flex gap-2">
          <button onClick={() => setSharing(true)} className="h-12 flex-1 rounded-2xl bg-neutral-800 font-semibold">
            分享此出門流程
          </button>
          <button
            onClick={() => (confirmDel ? onDelete(draft.id) : setConfirmDel(true))}
            className={`h-12 flex-1 rounded-2xl font-semibold ${confirmDel ? "bg-red-600 text-white" : "bg-neutral-800 text-red-400"}`}
          >
            {confirmDel ? "再按一次確認刪除" : "刪除此模式"}
          </button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-[#0a0a0b]/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-lg gap-2">
          <button onClick={onCancel} className="h-14 flex-1 rounded-2xl bg-neutral-800 text-lg font-semibold">
            取消
          </button>
          <button
            disabled={!valid}
            onClick={() => onSave(cleaned())}
            className="h-14 flex-[2] rounded-2xl bg-lime-400 text-lg font-bold text-black disabled:opacity-40"
          >
            儲存
          </button>
        </div>
      </div>

      <ShareModal preset={sharing ? cleaned() : null} onClose={() => setSharing(false)} />
    </main>
  );
}
