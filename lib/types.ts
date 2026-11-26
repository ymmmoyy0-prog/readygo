export interface Step {
  id: string;
  name: string;
  minutes: number;
  /** 核心步驟：緊急壓縮時不會被建議跳過 */
  core: boolean;
}

export interface Preset {
  id: string;
  name: string;
  steps: Step[];
  updatedAt: number;
}

export interface StepRecord {
  sessionId: string;
  presetId: string;
  stepId: string;
  stepName: string;
  plannedSec: number;
  actualSec: number;
  at: number;
}

import type { TransitSettings } from "./transit";

export type TimeMode = "leave" | "arrive";

export interface Plan {
  id: string;
  /** 行程名稱，例如「週末出遊」 */
  name: string;
  presetId: string;
  /** 只限今次的準備分鐘；null 代表沿用模式原本時長 */
  minutes: number | null;
  /** 以出門時間或到達時間計算 */
  mode: TimeMode;
  /** "HH:MM" */
  time: string;
  /** 起床後至開始準備的緩衝分鐘 */
  wakeBufferMin: number;
  /** 日期 "YYYY-MM-DD"（本地時間） */
  date: string;
  /** 此行程專用交通；null 代表沿用平日首選路線 */
  transit?: import("./transit").RouteCfg | null;
}

export interface Settings {
  muted: boolean;
  /** 手動目標出門時間 "HH:MM"，空字串代表未設定 */
  leaveTime: string;
  timeMode: TimeMode;
  /** 到達目的地時間 "HH:MM" */
  arriveTime: string;
  /** 未設定交通路線時，以此分鐘作為門到門路程 */
  manualTravelMin: number;
  transit: TransitSettings;
  /** 用戶選擇不設定交通（第 2 步略過） */
  transitSkipped: boolean;
  plans: Plan[];
}

export interface RunStep {
  id: string;
  name: string;
  /** 本次流程使用的時長（可能被壓縮） */
  plannedSec: number;
  /** 模板原本時長 */
  origSec: number;
  core: boolean;
  skip: boolean;
}

export interface Session {
  id: string;
  presetId: string;
  presetName: string;
  steps: RunStep[];
  index: number;
  startedAt: number;
  stepStartedAt: number;
  pausedAt: number | null;
  pausedMs: number;
  /** 最晚出門時間（epoch ms） */
  targetLeave: number | null;
  /** stepId -> 實際秒數 */
  actuals: Record<string, number>;
  compressed: boolean;
  finishedAt: number | null;
  /** 最近一次自動進入下一步：被自動完成的步驟索引與時間，用於顯示「延長」 */
  autoFrom?: { index: number; at: number } | null;
}
