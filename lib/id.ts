export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID().slice(0, 12);
    } catch {
      /* 非安全連線（http 區網）時可能不可用 */
    }
  }
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
