import type { Preset } from "./types";
import { uid } from "./id";

type RawSteps = [string, number, 0 | 1][];
interface Payload {
  v: 1;
  n: string;
  s: RawSteps;
}
/** v2：一條連結包含多個模式（例如私人模板包、全部模式備份） */
interface PackPayload {
  v: 2;
  p: { n: string; s: RawSteps }[];
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

export function encodePack(list: Preset[]): string {
  const payload: PackPayload = {
    v: 2,
    p: list.map((p) => ({ n: p.name, s: p.steps.map((s) => [s.name, s.minutes, s.core ? 1 : 0]) })),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function buildShareUrl(p: Preset | Preset[]): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  const code = Array.isArray(p) ? (p.length === 1 ? encodePreset(p[0]) : encodePack(p)) : encodePreset(p);
  return `${base}?preset=${code}`;
}

function build(n: unknown, raw: unknown): Preset {
  if (typeof n !== "string" || !Array.isArray(raw)) throw new Error("bad payload");
  if (raw.length < 1 || raw.length > 30) throw new Error("bad length");
  const steps = (raw as RawSteps).map(([name, minutes, core]) => {
      if (typeof name !== "string" || !name.trim()) throw new Error("bad name");
      const m = Math.round(Number(minutes));
      if (!Number.isFinite(m) || m < 1 || m > 240) throw new Error("bad minutes");
      return { id: uid(), name: name.trim().slice(0, 30), minutes: m, core: core === 1 };
  });
  return { id: uid(), name: n.trim().slice(0, 40) || "分享的出門流程", steps, updatedAt: Date.now() };
}

/** 解碼並驗證分享參數（單一或多個模式），無效時回傳 null */
export function decodeShare(code: string): Preset[] | null {
  try {
    const data = JSON.parse(fromBase64Url(code)) as Payload | PackPayload;
    if (data?.v === 1) return [build(data.n, data.s)];
    if (data?.v === 2 && Array.isArray(data.p) && data.p.length >= 1 && data.p.length <= 20) {
      return data.p.map((x) => build(x.n, x.s));
    }
    return null;
  } catch {
    return null;
  }
}
