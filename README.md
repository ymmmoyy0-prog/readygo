# 出門精算師 ReadyGo

手機優先的出門計時 PWA。Next.js (App Router) + Tailwind CSS v4 + TypeScript，純前端，所有資料存在瀏覽器 `localStorage`。

## 啟動

```bash
npm install
npm run dev        # 開發模式 http://localhost:3000（不註冊 Service Worker）
npm run build && npm start   # 正式模式，PWA 與離線緩存生效
```

手機測試 Wake Lock、Service Worker、加到主畫面都需要 **HTTPS**，建議部署到 Vercel 後用手機開啟。

## 已完成（第一步）

| 功能 | 位置 |
| --- | --- |
| 新手引導：20／30／60 分鐘或自訂時長模板，逐步改名改時間 | `components/OnboardingView.tsx`, `lib/defaults.ts` |
| 分段倒數、超時紅色 `+mm:ss`、緩衝即時扣減 | `components/TimerView.tsx`, `lib/session.ts` |
| 佔畫面 36% 的完成大按鈕、暫停、上一步 | `components/TimerView.tsx` |
| Screen Wake Lock（切回前台自動重新申請） | `lib/wakeLock.ts` |
| 語音報時（zh-HK → zh-TW → zh-CN）、靜音開關 | `lib/speech.ts` |
| 緊急壓縮（≥60% 按比例；否則跳過非核心步驟） | `lib/session.ts` `planCompression` |
| 實際耗時紀錄、對比總結卡、一鍵更新平均時間 | `lib/stats.ts`, `components/SummaryView.tsx` |
| `?preset=` 分享連結（單個或多個模式，可作備份）與匯入確認 | `lib/share.ts`, `components/App.tsx` |
| PWA manifest、Service Worker 離線緩存 | `public/manifest.json`, `public/sw.js` |

## localStorage 鍵

* `readygo.presets.v1`：出門模式
* `readygo.history.v1`：每步實際耗時（最多 600 筆）
* `readygo.settings.v1`：靜音、目標出門時間
* `readygo.session.v1`：進行中流程（重新整理後可繼續）

## 圖示

`node scripts/gen-icons.cjs` 用 Playwright 由 SVG 重新產生 `public/icons/*.png`。
