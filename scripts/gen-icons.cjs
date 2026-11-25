// 用預裝 Playwright 把 SVG 圖示輸出成 PNG：node scripts/gen-icons.cjs
const { chromium } = require("playwright");
const path = require("path");

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${pad ? 0 : 112}" fill="#0a0a0b"/>
  <g transform="translate(256 270) scale(${pad ? 0.78 : 1})">
    <circle r="150" fill="none" stroke="#a3e635" stroke-width="34"/>
    <rect x="-22" y="-215" width="44" height="50" rx="10" fill="#a3e635"/>
    <path d="M0 -95 V0 L70 52" fill="none" stroke="#fafafa" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = path.join(__dirname, "..", "public", "icons");
  const jobs = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["icon-maskable-512.png", 512, true],
    ["apple-touch-icon.png", 180, true],
  ];
  for (const [name, size, pad] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(pad).replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({ path: path.join(out, name), omitBackground: !pad });
  }
  await browser.close();
})();
