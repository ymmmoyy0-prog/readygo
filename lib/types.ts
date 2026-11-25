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

export interface Settings {
  muted: boolean;
  /** 手動目標出門時間 "HH:MM"，空字串代表未設定 */
  leaveTime: string;
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
}
