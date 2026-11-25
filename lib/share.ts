import type { Preset } from "./types";
import { uid } from "./id";

interface Payload {
  v: 1;
  n: string;
  s: [string, number, 0 | 1][];
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(b64: string): string {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm + "===".slice((norm.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodePreset(p: Preset): string {
  const payload: Payload = {
    v: 1,
    n: p.name,
    s: p.steps.map((s) => [s.name, s.minutes, s.core ? 1 : 0]),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function buildShareUrl(p: Preset): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?preset=${encodePreset(p)}`;
}

/** 解碼並驗證分享參數，無效時回傳 null */
export function decodePreset(code: string): Preset | null {
  try {
    const data = JSON.parse(fromBase64Url(code)) as Payload;
    if (data?.v !== 1 || typeof data.n !== "string" || !Array.isArray(data.s)) return null;
    if (data.s.length < 1 || data.s.length > 30) return null;
    const steps = data.s.map(([name, minutes, core]) => {
      if (typeof name !== "string" || !name.trim()) throw new Error("bad name");
      const m = Math.round(Number(minutes));
      if (!Number.isFinite(m) || m < 1 || m > 240) throw new Error("bad minutes");
      return { id: uid(), name: name.trim().slice(0, 30), minutes: m, core: core === 1 };
    });
    return {
      id: uid(),
      name: data.n.trim().slice(0, 40) || "分享的出門流程",
      steps,
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}
