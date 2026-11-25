const pad = (n: number) => String(n).padStart(2, "0");

/** 秒數 -> mm:ss（超過一小時 h:mm:ss），負數加 + 號代表超時 */
export function fmtDuration(sec: number, overtimeSign = false): string {
  const neg = sec < 0;
  const s = Math.floor(Math.abs(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const body = h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
  if (neg && overtimeSign) return `+${body}`;
  return neg ? `-${body}` : body;
}

export function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "HH:MM" -> 下一個對應時刻（若已過去超過 3 小時則視為明天） */
export function leaveTimeToEpoch(hhmm: string, now = Date.now()): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  let t = d.getTime();
  if (t < now - 3 * 3600_000) t += 24 * 3600_000;
  return t;
}

export function fmtMinutesLabel(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m} 分鐘`;
}
