let cachedVoice: SpeechSynthesisVoice | null = null;
let voiceLang = "zh-HK";

function supported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** 優先粵語 zh-HK，其次 zh-TW，再其次 zh-CN / 任何中文 */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!supported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const norm = (l: string) => l.toLowerCase().replace("_", "-");
  const by = (pred: (v: SpeechSynthesisVoice) => boolean) => voices.find(pred) ?? null;
  return (
    by((v) => norm(v.lang) === "zh-hk" || norm(v.lang).startsWith("yue")) ??
    by((v) => /cantonese|粵|廣東/i.test(v.name)) ??
    by((v) => norm(v.lang) === "zh-tw") ??
    by((v) => norm(v.lang) === "zh-cn") ??
    by((v) => norm(v.lang).startsWith("zh"))
  );
}

export function initSpeech() {
  if (!supported()) return;
  const refresh = () => {
    cachedVoice = pickVoice();
    if (cachedVoice) voiceLang = cachedVoice.lang;
  };
  refresh();
  window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
}

export function currentVoiceLabel(): string {
  if (!supported()) return "此瀏覽器不支援語音";
  return cachedVoice ? `${cachedVoice.name} (${cachedVoice.lang})` : "系統預設中文語音";
}

export function speak(text: string) {
  if (!supported()) return;
  try {
    if (!cachedVoice) cachedVoice = pickVoice();
    const u = new SpeechSynthesisUtterance(text);
    if (cachedVoice) u.voice = cachedVoice;
    u.lang = cachedVoice?.lang ?? voiceLang;
    u.rate = 1;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}

export function stopSpeech() {
  if (supported()) window.speechSynthesis.cancel();
}
