import type { Preset, Session, Settings, StepRecord } from "./types";
import { defaultPresets } from "./defaults";

const K = {
  presets: "readygo.presets.v1",
  history: "readygo.history.v1",
  settings: "readygo.settings.v1",
  session: "readygo.session.v1",
};

const HISTORY_CAP = 600;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 私隱模式或空間不足 */
  }
}

export const defaultSettings: Settings = { muted: false, leaveTime: "", plan: null };

/** 回傳 null 代表首次使用（顯示新手引導） */
export function loadPresets(): Preset[] | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(K.presets);
  } catch {
    /* 無法使用 localStorage 時直接給預設模板 */
    return defaultPresets();
  }
  if (raw === null) return null;
  return read<Preset[]>(K.presets, []);
}

export const savePresets = (p: Preset[]) => write(K.presets, p);

export const loadHistory = () => read<StepRecord[]>(K.history, []);
export const saveHistory = (h: StepRecord[]) => write(K.history, h.slice(-HISTORY_CAP));

export const loadSettings = () => ({ ...defaultSettings, ...read<Partial<Settings>>(K.settings, {}) });
export const saveSettings = (s: Settings) => write(K.settings, s);

export const loadSession = () => read<Session | null>(K.session, null);
export const saveSession = (s: Session | null) => write(K.session, s);
