# ZenHold 禪定資產 · 美股與加密貨幣靜心追蹤器

> **「靜水流深，持盈保泰。心安，則萬物自適。」**

[![Live Demo](https://img.shields.io/badge/線上立即使用-Live%20Demo-2b7a4b?style=for-the-badge&logo=google-chrome&logoColor=white)](https://unclelin332.github.io/zenhold/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

🌐 **線上免安裝直接使用網址**：👉 **[https://unclelin332.github.io/zenhold/](https://unclelin332.github.io/zenhold/)**

ZenHold 是一個專為持有 **比特幣 (BTC)、加密貨幣、美股個股與美股 ETF** 的長期投資者量身打造的極簡禪意資產管理工具。採用純前端架構（HTML5 + CSS3 + 原生 JavaScript），零依賴、無後端、資料 100% 留存在使用者本機瀏覽器中。

> 💡 **任何人點擊上方網址皆可獨立使用**：所有數據皆獨立儲存在每位使用者的瀏覽器本機 (`localStorage`)，無須註冊登入，保護個人隱私不外洩。

---

## 🎋 核心特色

1. **素白墨韻禪意美學 (Sumi & Washi Zen Aesthetic)**
   - 採用柔和米白和紙底色 (`#f7f5f0`)、沈穩書法水墨灰黑 (`#1b1c1d`) 與清雅竹青/赭石色彩。
   - 舒適的留白呼吸感，遠離市場雜訊與焦慮感。

2. **「靜心定性 · 禪語心齋」金句提醒**
   - 頁面核心區域常駐提醒金句，防止情緒化追高殺跌。
   - 支援「隨喜換一句」，在市場劇烈波動時重獲內心平靜。

3. **美股開休市與市場狀態即時偵測**
   - 自動換算美東時間（US Eastern Time, ET）。
   - 即時判定目前為 **美股開市中 (Market Open)**、**盤前交易 (Pre-market)**、**盤後交易 (After-hours)**、**週末休市 (Weekend)** 或 **美國國定假日休市 (US Holidays)**。
   - 附帶精確的倒數計時，並標明加密貨幣 24/7 全天候運作。

4. **動態資產配置甜甜圈/圓餅圖**
   - 原生 Canvas 高清渲染，支援雙檢視模式切換：
     - **大類佔比**：加密貨幣 vs 美股個股 vs 美股 ETF。
     - **標的佔比**：個別持倉（如 BTC, VOO, AAPL...）的資產權重。
   - 支援滑鼠 Hover 互動高亮與即時數值聯動。

5. **多管道即時行情爬蟲 (Price Service)**
   - **加密貨幣**：直連 Binance Public 24hr API & CoinGecko 公開 API，無需 API Key 即可獲取秒級即時價格與 24h 漲跌。
   - **美股與 ETF**：內建 Finnhub 官方即時 API + Yahoo Finance 公開 Chart API 備援。
   - **離線智慧快取與手動覆蓋**：斷網或 API 異常時平穩顯示快取，並支援手動指定價格。

6. **本機儲存與安全備份 (Local Storage)**
   - 數據自動儲存在瀏覽器 `localStorage`，絕無個資或持倉上傳伺服器的風險。
   - 提供 **一鍵匯出 JSON 備份檔** 與 **匯入 JSON 還原** 功能，確保更換電腦或清理瀏覽器時資料不遺失。

---

## 📁 專案檔案結構

```
Stock/
├── index.html              # 主頁面結構與禪意介面
├── css/
│   └── zen-theme.css       # 素白墨韻樣式表、響應式排版與微動效
├── js/
│   ├── market-status.js    # 美股開休市判定與節假日日曆引擎
│   ├── price-service.js    # 加密貨幣與美股/ETF 即時行情爬蟲
│   ├── portfolio-chart.js  # 原生 Canvas 禪意甜甜圈圖引擎
│   ├── storage.js          # 本地 localStorage 資料與備份管理器
│   └── app.js              # 主控制器、事件綁定與定心禪語庫
└── README.md               # 專案說明文件
```

---

## 🚀 如何使用

1. **線上直接使用（最推薦）**：
   - 直接前往 [https://unclelin332.github.io/zenhold/](https://unclelin332.github.io/zenhold/) 開啟。
   - 手機可點選瀏覽器選單中的「加入主畫面 (Add to Home Screen)」，即可享有 App 般的使用體驗。
2. **本機直接開啟**：
   - 下載本專案後，直接雙擊 `index.html` 即可在任一現代瀏覽器中開啟使用。
3. **新增持倉**：
   - 點擊右上角「**+ 新增標的**」，可點擊常用標的（如 BTC, VOO, QQQ, NVDA, AAPL 等），輸入持有數量與買入均價。
4. **隨時定心**：
   - 當市場波動感到焦慮時，點擊「**隨喜換一句**」獲取投資心法。
