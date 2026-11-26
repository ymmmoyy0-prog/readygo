import type { Preset, Session, Settings, StepRecord } from "./types";
import { defaultPresets, migrateQuick15 } from "./defaults";
import { defaultTransit } from "./transit";

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

export const defaultSettings: Settings = {
  muted: false,
  leaveTime: "",
  timeMode: "leave",
  arriveTime: "",
  manualTravelMin: 30,
  transit: defaultTransit,
  transitSkipped: false,
  plans: [],
};

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
  const list = read<Preset[]>(K.presets, []);
  const m = migrateQuick15(list);
  if (m.changed) write(K.presets, m.list);
  return m.list;
}

export const savePresets = (p: Preset[]) => write(K.presets, p);

export const loadHistory = () => read<StepRecord[]>(K.history, []);
export const saveHistory = (h: StepRecord[]) => write(K.history, h.slice(-HISTORY_CAP));

export const loadSettings = (): Settings => {
  const raw = read<Partial<Settings>>(K.settings, {});
  const s = { ...defaultSettings, ...raw, transit: { ...defaultTransit, ...(raw.transit ?? {}) } } as Settings;
  // 舊版只有單一計劃（settings.plan）：轉為行程清單
  const legacy = (raw as { plan?: Record<string, unknown> | null }).plan;
  if (legacy && !raw.plans) {
    s.plans = [
      {
        id: "legacy",
        name: "",
        presetId: String(legacy.presetId ?? ""),
        minutes: null,
        mode: legacy.mode === "arrive" ? "arrive" : "leave",
        time: String(legacy.time ?? legacy.leaveTime ?? "08:30"),
        wakeBufferMin: Number(legacy.wakeBufferMin ?? 10),
        date: String(legacy.date ?? ""),
      },
    ];
  }
  delete (s as { plan?: unknown }).plan;
  return s;
};
export const saveSettings = (s: Settings) => write(K.settings, s);

export const loadSession = () => read<Session | null>(K.session, null);
export const saveSession = (s: Session | null) => write(K.session, s);

/** 一次性提示（例如首次計時的紅點）是否已看過 */
export function tipSeen(key: string): boolean {
  try {
    return localStorage.getItem(`readygo.tip.${key}`) === "1";
  } catch {
    return true;
  }
}
export function markTip(key: string) {
  try {
    localStorage.setItem(`readygo.tip.${key}`, "1");
  } catch {
    /* ignore */
  }
}
