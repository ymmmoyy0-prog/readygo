"use client";
import { useState } from "react";
import type { Preset } from "@/lib/types";
import { QUICK_TEMPLATES, blankPreset, fromTemplate, presetForTotal, templateTotal, type Template } from "@/lib/defaults";
import Ruler from "./Ruler";

export default function OnboardingView({
  firstRun,
  onPick,
  onSkip,
  onCancel,
}: {
  firstRun: boolean;
  onPick: (draft: Preset, templateKey: string | null) => void;
  onSkip: () => void;
  onCancel?: () => void;
}) {
  const [custom, setCustom] = useState("45");
  const customMin = Math.round(Number(custom));
  const customOk = Number.isFinite(customMin) && customMin >= 5 && customMin <= 180;

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 pb-12 pt-8">
      {onCancel && (
        <button onClick={onCancel} className="-mt-4 mb-4 h-11 px-1 text-[17px] font-semibold text-sub">
          ← 返回
        </button>
      )}
      <header className="mb-8">
        <p className="mb-2 text-sm font-semibold tracking-wide text-ink">{firstRun ? "歡迎使用" : "新增出門模式"}</p>
        <h1 className="text-[2rem] font-extrabold leading-tight text-ink">{firstRun ? "出門精算師" : "由模板開始"}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-sub">
          {firstRun
            ? "將出門前要做的事拆分為多個步驟，每步倒數計時，時間到自動進入下一步。請先選擇一個起點，下一頁可逐項修改名稱及時間。"
            : "選擇一個時長或模板作為起點，下一頁再修改為你需要的步驟。"}
        </p>
      </header>

      <Section title="你平日出門前大約需要多少時間？" hint="選擇時長後，系統會自動分配步驟">
        <div className="grid grid-cols-3 gap-3">
          {QUICK_TEMPLATES.map((t) => (
            <button
              key={t.key}
              onClick={() => onPick(fromTemplate(t), t.key)}
              className="border border-ink flex flex-col items-center px-2 py-5 text-center active:bg-brand-soft"
            >
              <span className="tnum text-[2.5rem] font-extrabold leading-none text-ink">{templateTotal(t)}</span>
              <span className="mt-1 text-sm font-semibold text-sub">分鐘</span>
              <span className="mt-3 text-[13px] leading-snug text-faint">{t.blurb}</span>
            </button>
          ))}
        </div>

        <div className="border border-ink mt-3 flex items-center gap-3 p-3">
          <label htmlFor="custom-total" className="shrink-0 pl-1 text-[15px] font-semibold text-ink">
            其他時長
          </label>
          <input
            id="custom-total"
            type="number"
            inputMode="numeric"
            min={5}
            max={180}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="tnum h-12 w-20 border border-line bg-paper text-center text-xl font-bold text-ink"
          />
          <span className="text-sub">分鐘</span>
          <button
            disabled={!customOk}
            onClick={() => onPick(presetForTotal(customMin), "custom")}
            className="ml-auto h-12 bg-ink px-4 font-bold text-white disabled:opacity-40"
          >
            使用
          </button>
        </div>
      </Section>

      <Section title="模板內容">
        <div className="space-y-3">
          {QUICK_TEMPLATES.map((t) => (
            <TemplateRow key={t.key} t={t} onClick={() => onPick(fromTemplate(t), t.key)} />
          ))}
        </div>
      </Section>

      <button
        onClick={() => onPick(blankPreset(), null)}
        className="mt-2 h-14 w-full border-[1.5px] border-dashed border-ink bg-card/60 text-[17px] font-semibold text-ink"
      >
        由零開始，自行設定
      </button>

      {firstRun && (
        <button onClick={onSkip} className="mt-6 block w-full text-center text-[15px] text-sub underline underline-offset-4">
          跳過，直接加入全部 3 個模板
        </button>
      )}
    </main>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {hint ? <p className="mb-3 text-[15px] text-sub">{hint}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

function TemplateRow({ t, onClick }: { t: Template; onClick: () => void }) {
  const steps = t.steps.map(([name, minutes]) => ({ name, minutes }));
  return (
    <button onClick={onClick} className="border border-ink block w-full p-4 text-left active:bg-brand-soft">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[17px] font-bold text-ink">{t.name}</span>
        <span className="tnum shrink-0 font-bold text-ink">{templateTotal(t)} 分鐘</span>
      </div>
      <p className="mb-3 text-[15px] leading-relaxed text-sub">{t.steps.map((s) => s[0]).join("・")}</p>
      <Ruler steps={steps} />
    </button>
  );
}
