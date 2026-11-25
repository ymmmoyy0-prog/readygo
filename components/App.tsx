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
import { decodePreset } from "@/lib/share";
import { createSession } from "@/lib/session";
import { leaveTimeToEpoch } from "@/lib/time";
import { initSpeech, speak } from "@/lib/speech";
import HomeView from "./HomeView";
import EditorView from "./EditorView";
import TimerView from "./TimerView";
import SummaryView from "./SummaryView";
import Modal from "./Modal";

type View =
  | { name: "home" }
  | { name: "edit"; presetId: string | null }
  | { name: "timer" }
  | { name: "summary" };

export default function App() {
  const [ready, setReady] = useState(false);
  const [presets, setPresetsState] = useState<Preset[]>([]);
  const [history, setHistoryState] = useState<StepRecord[]>([]);
  const [settings, setSettingsState] = useState<Settings>(defaultSettings);
  const [session, setSessionState] = useState<Session | null>(null);
  const [view, setView] = useState<View>({ name: "home" });
  const [incoming, setIncoming] = useState<Preset | null>(null);
  const [badLink, setBadLink] = useState(false);

  useEffect(() => {
    setPresetsState(loadPresets());
    setHistoryState(loadHistory());
    setSettingsState(loadSettings());
    const s = loadSession();
    if (s) {
      setSessionState(s);
      setView(s.finishedAt ? { name: "summary" } : { name: "timer" });
    }
    const params = new URLSearchParams(window.location.search);
    const code = params.get("preset");
    if (code) {
      const p = decodePreset(code);
      if (p) setIncoming(p);
      else setBadLink(true);
    }
    initSpeech();
    setReady(true);
  }, []);

  const setPresets = useCallback((p: Preset[]) => {
    setPresetsState(p);
    savePresets(p);
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
  const setSession = useCallback((s: Session | null) => {
    setSessionState(s);
    saveSession(s);
  }, []);

  const clearQuery = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("preset");
    window.history.replaceState(null, "", url.pathname + url.search);
  };

  const acceptImport = () => {
    if (!incoming) return;
    let name = incoming.name;
    const names = new Set(presets.map((p) => p.name));
    if (names.has(name)) name = `${name}（分享）`;
    setPresets([...presets, { ...incoming, name }]);
    setIncoming(null);
    clearQuery();
  };

  const start = (preset: Preset) => {
    const target = settings.leaveTime ? leaveTimeToEpoch(settings.leaveTime) : null;
    const s = createSession(preset, target);
    if (!settings.muted) speak(`開始${preset.name}，第一步：${preset.steps[0].name}`); // 用戶手勢內觸發，解鎖 iOS 語音
    setSession(s);
    setView({ name: "timer" });
  };

  if (!ready) return <div className="min-h-dvh bg-[#0a0a0b]" />;

  const editing = view.name === "edit" ? presets.find((p) => p.id === view.presetId) ?? null : null;

  return (
    <>
      {view.name === "home" && (
        <HomeView
          presets={presets}
          settings={settings}
          session={session}
          onSettings={setSettings}
          onStart={start}
          onEdit={(id) => setView({ name: "edit", presetId: id })}
          onResume={() => setView(session?.finishedAt ? { name: "summary" } : { name: "timer" })}
        />
      )}
      {view.name === "edit" && (
        <EditorView
          preset={editing}
          history={history}
          onSave={(p) => {
            const exists = presets.some((x) => x.id === p.id);
            setPresets(exists ? presets.map((x) => (x.id === p.id ? p : x)) : [...presets, p]);
            setView({ name: "home" });
          }}
          onDelete={(id) => {
            setPresets(presets.filter((x) => x.id !== id));
            setHistory((h) => h.filter((r) => r.presetId !== id));
            setView({ name: "home" });
          }}
          onCancel={() => setView({ name: "home" })}
        />
      )}
      {view.name === "timer" && session && (
        <TimerView
          session={session}
          settings={settings}
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
          preset={presets.find((p) => p.id === session.presetId) ?? null}
          history={history}
          onUpdatePreset={(p) => setPresets(presets.map((x) => (x.id === p.id ? p : x)))}
          onDone={() => {
            setSession(null);
            setView({ name: "home" });
          }}
        />
      )}

      <Modal open={!!incoming} title="是否匯入分享的出門流程？">
        {incoming && (
          <>
            <p className="mb-3 text-lg font-semibold text-lime-300">{incoming.name}</p>
            <ol className="mb-4 space-y-1 text-neutral-200">
              {incoming.steps.map((s, i) => (
                <li key={s.id} className="flex justify-between rounded-lg bg-neutral-800 px-3 py-2">
                  <span>
                    {i + 1}. {s.name}
                  </span>
                  <span className="tnum text-neutral-400">{s.minutes} 分鐘</span>
                </li>
              ))}
            </ol>
            <p className="mb-4 text-neutral-400">
              總計 {incoming.steps.reduce((a, s) => a + s.minutes, 0)} 分鐘。匯入後只會存喺你部手機，可以自由修改。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIncoming(null);
                  clearQuery();
                }}
                className="h-14 flex-1 rounded-2xl bg-neutral-700 text-lg font-semibold"
              >
                唔使
              </button>
              <button onClick={acceptImport} className="h-14 flex-1 rounded-2xl bg-lime-400 text-lg font-bold text-black">
                匯入
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={badLink} title="連結無效" onClose={() => setBadLink(false)}>
        <p className="mb-4 text-neutral-300">呢條分享連結已損壞或者唔完整，請叫朋友重新複製一次。</p>
        <button
          onClick={() => {
            setBadLink(false);
            clearQuery();
          }}
          className="h-12 w-full rounded-2xl bg-neutral-700 font-semibold"
        >
          知道
        </button>
      </Modal>
    </>
  );
}
