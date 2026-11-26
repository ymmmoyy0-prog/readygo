"use client";
import { useCallback, useEffect, useState } from "react";
import type { Preset, Session, Settings, StepRecord } from "@/lib/types";
import {
  defaultSettings,
  loadHistory,
  loadPresets,
  loadSession,
  loadSettings,
  saveHistory,
  savePresets,
  saveSession,
  saveSettings,
} from "@/lib/storage";
import { decodeShare } from "@/lib/share";
import { createSession } from "@/lib/session";
import { initSpeech, speak } from "@/lib/speech";
import { QUICK_TEMPLATES, blankPreset, defaultPresets, fromTemplate, scaleSteps } from "@/lib/defaults";
import HomeView from "./HomeView";
import EditorView from "./EditorView";
import TimerView from "./TimerView";
import SummaryView from "./SummaryView";
import OnboardingView from "./OnboardingView";
import PlanView from "./PlanView";
import RouteView from "./RouteView";
import { useTransit } from "@/lib/useTransit";
import { computeTarget } from "@/lib/target";
import Modal from "./Modal";

type View =
  | { name: "onboard"; firstRun: boolean }
  | { name: "home" }
  /** onboarding 為 undefined 代表一般編輯；字串或 null 代表新手引導中選擇的模板 */
  | { name: "edit"; draft: Preset; isNew: boolean; onboarding?: string | null; firstRun?: boolean }
  | { name: "timer" }
  | { name: "plan" }
  | { name: "routes" }
  | { name: "summary" };

export default function App() {
  const [ready, setReady] = useState(false);
  const [presets, setPresetsState] = useState<Preset[] | null>(null);
  const [history, setHistoryState] = useState<StepRecord[]>([]);
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);
  const [session, setSessionState] = useState<Session | null>(null);
  const [view, setView] = useState<View>({ name: "home" });
  const [incoming, setIncoming] = useState<Preset[] | null>(null);
  const [badLink, setBadLink] = useState(false);

  useEffect(() => {
    let loaded = loadPresets();
    // 首次使用：直接加入快速模板，主頁以 1-2-3 步驟引導
    if (!loaded) {
      loaded = defaultPresets();
      savePresets(loaded);
    }
    setPresetsState(loaded);
    setHistoryState(loadHistory());
    setSettingsState(loadSettings());
    const s = loadSession();
    if (s && loaded) {
      setSessionState(s);
      setView(s.finishedAt ? { name: "summary" } : { name: "timer" });
    }
    const code = new URLSearchParams(window.location.search).get("preset");
    if (code) {
      const p = decodeShare(code);
      if (p) setIncoming(p);
      else setBadLink(true);
    }
    initSpeech();
    setReady(true);
  }, []);

  const setPresets = useCallback((p: Preset[]) => {
    setPresetsState(p);
    savePresets(p);
    // 申請持久儲存，減低瀏覽器自動清除資料的機會
    navigator.storage?.persist?.().catch(() => {});
  }, []);
  const setHistory = useCallback((fn: (h: StepRecord[]) => StepRecord[]) => {
    setHistoryState((prev) => {
      const next = fn(prev);
      saveHistory(next);
      return next;
    });
  }, []);
  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);
  const live = useTransit(settings.transit, (which, min) =>
    // 實時配對得出的乘車分鐘寫回路線設定
    setSettingsState((prev) => {
      const r = prev.transit[which];
      if (!r || r.rideManual) return prev;
      // 與舊值平均，避免單次異常令乘車時間大幅跳動
      const blended = Math.round((r.rideMin + min) / 2);
      if (blended === r.rideMin) return prev;
      const next = { ...prev, transit: { ...prev.transit, [which]: { ...r, rideMin: blended } } };
      saveSettings(next);
      return next;
    })
  );
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  const target = computeTarget(settings, live, clock);

  const setSession = useCallback((s: Session | null) => {
    setSessionState(s);
    saveSession(s);
  }, []);

  const list = presets ?? [];

  const clearQuery = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("preset");
    window.history.replaceState(null, "", url.pathname + url.search);
  };

  const acceptImport = () => {
    if (!incoming) return;
    const names = new Set(list.map((p) => p.name));
    const added = incoming.map((p) => {
      const name = names.has(p.name) ? `${p.name}（分享）` : p.name;
      names.add(name);
      return { ...p, name };
    });
    setPresets([...list, ...added]);
    setIncoming(null);
    clearQuery();
    if (view.name === "onboard") setView({ name: "home" });
  };

  const addPreset = (p: Preset): Preset => {
    let name = p.name;
    for (let i = 2; list.some((x) => x.name === name); i++) name = `${p.name} ${i}`;
    const added = { ...p, name };
    setPresets([...list, added]);
    return added;
  };

  const start = (base: Preset, planId?: string) => {
    let st = settings;
    let preset = base;
    const plan = planId ? settings.plans.find((x) => x.id === planId) : undefined;
    if (plan) {
      st = plan.mode === "arrive" ? { ...settings, timeMode: "arrive", arriveTime: plan.time } : { ...settings, timeMode: "leave", leaveTime: plan.time };
      setSettings(st);
      // 「只限今次」分鐘：按比例縮放步驟，只影響這次計時
      if (plan.minutes !== null) preset = { ...base, steps: scaleSteps(base.steps, plan.minutes) };
    }
    const t = computeTarget(st, live, Date.now());
    const s = createSession(preset, t.leaveAt);
    if (!settings.muted) speak(`開始${preset.name}，第一步，${preset.steps[0].name}`); // 於用戶操作內觸發，解鎖 iOS 語音
    setSession(s);
    setView({ name: "timer" });
  };

  if (!ready) return <div className="min-h-dvh bg-paper" />;

  return (
    <>
      {view.name === "onboard" && (
        <OnboardingView
          firstRun={view.firstRun}
          onPick={(draft, key) => setView({ name: "edit", draft, isNew: true, onboarding: key, firstRun: view.firstRun })}
          onSkip={() => {
            setPresets([...list, ...defaultPresets()]);
            setView({ name: "home" });
          }}
          onCancel={view.firstRun ? undefined : () => setView({ name: "home" })}
        />
      )}
      {view.name === "home" && (
        <HomeView
          presets={list}
          settings={settings}
          session={session}
          onSettings={setSettings}
          onStart={start}
          onEdit={(id) => {
            const p = list.find((x) => x.id === id);
            setView(p ? { name: "edit", draft: p, isNew: false } : { name: "edit", draft: blankPreset(), isNew: true });
          }}
          onAdd={addPreset}
          onDelete={(id) => {
            setPresets(list.filter((x) => x.id !== id));
            setHistory((h) => h.filter((r) => r.presetId !== id));
          }}
          onResume={() => setView(session?.finishedAt ? { name: "summary" } : { name: "timer" })}
          onPlan={() => setView({ name: "plan" })}
          target={target}
          live={live}
        />
      )}
      {view.name === "plan" && (
        <PlanView
          presets={list}
          settings={settings}
          onSettings={setSettings}
          onAddPreset={addPreset}
          onBlankPreset={() => setView({ name: "edit", draft: blankPreset(), isNew: true })}
          onBack={() => setView({ name: "home" })}
        />
      )}
      {view.name === "routes" && (
        <RouteView settings={settings} live={live} onSettings={setSettings} onBack={() => setView({ name: "home" })} />
      )}
      {view.name === "edit" && (
        <EditorView
          key={view.draft.id}
          initial={view.draft}
          isNew={view.isNew}
          onboarding={view.onboarding !== undefined && !!view.firstRun}
          history={history}
          onSave={(p, addOthers) => {
            if (view.onboarding !== undefined) {
              const extras = addOthers
                ? QUICK_TEMPLATES.filter((t) => t.key !== view.onboarding).map(fromTemplate)
                : [];
              setPresets([...list, p, ...extras]);
            } else {
              const exists = list.some((x) => x.id === p.id);
              setPresets(exists ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]);
            }
            setView({ name: "home" });
          }}
          onDelete={(id) => {
            setPresets(list.filter((x) => x.id !== id));
            setHistory((h) => h.filter((r) => r.presetId !== id));
            setView({ name: "home" });
          }}
          onCancel={() =>
            setView(view.onboarding !== undefined ? { name: "onboard", firstRun: !!view.firstRun } : { name: "home" })
          }
        />
      )}
      {view.name === "timer" && session && (
        <TimerView
          session={session}
          settings={settings}
          live={live}
          liveLeave={settings.timeMode === "arrive" && target.source === "live" ? target.leaveAt : null}
          onSettings={setSettings}
          onSession={setSession}
          onRecord={(rec) => setHistory((h) => [...h, rec])}
          onUnrecord={(sessionId, stepId) =>
            setHistory((h) => h.filter((r) => !(r.sessionId === sessionId && r.stepId === stepId)))
          }
          onFinish={() => setView({ name: "summary" })}
          onExit={() => {
            setSession(null);
            setView({ name: "home" });
          }}
        />
      )}
      {view.name === "summary" && session && (
        <SummaryView
          session={session}
          preset={list.find((p) => p.id === session.presetId) ?? null}
          history={history}
          onUpdatePreset={(p) => setPresets(list.map((x) => (x.id === p.id ? p : x)))}
          onDone={() => {
            setSession(null);
            setView({ name: "home" });
          }}
        />
      )}

      <Modal open={!!incoming} title="是否匯入分享的出門流程？">
        {incoming && (
          <>
            <div className="mb-4 space-y-4">
              {incoming.map((p) => (
                <div key={p.id}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="text-lg font-bold text-brand">{p.name}</p>
                    <span className="tnum shrink-0 font-semibold text-ink">
                      {p.steps.reduce((a, s) => a + s.minutes, 0)} 分鐘
                    </span>
                  </div>
                  <ol className="divide-y divide-line border-t border-b border-ink">
                    {p.steps.map((s, i) => (
                      <li key={s.id} className="flex justify-between gap-3 px-4 py-2.5">
                        <span className="text-ink">
                          <span className="mr-2 text-faint">{i + 1}</span>
                          {s.name}
                        </span>
                        <span className="tnum shrink-0 text-sub">{s.minutes} 分鐘</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <p className="mb-5 leading-relaxed text-sub">匯入後只會儲存於你的裝置，可自由修改。</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIncoming(null);
                  clearQuery();
                }}
                className="h-14 flex-1 border-[1.5px] border-ink text-lg font-bold text-ink"
              >
                不用
              </button>
              <button onClick={acceptImport} className="h-14 flex-[1.4] bg-ink text-lg font-bold text-white">
                {incoming.length > 1 ? `匯入 ${incoming.length} 個` : "匯入"}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={badLink} title="連結無效" onClose={() => setBadLink(false)}>
        <p className="mb-5 text-sub">此分享連結已損壞或不完整，請對方重新複製一次。</p>
        <button
          onClick={() => {
            setBadLink(false);
            clearQuery();
          }}
          className="h-12 w-full border-[1.5px] border-ink font-bold"
        >
          明白
        </button>
      </Modal>
    </>
  );
}
