/**
 * ============================================================================
 * ZenHold - 主應用程式核心控制器 (App Controller)
 * ============================================================================
 * 整合市場狀態、定心禪語、即時行情爬蟲、資產配置圓餅圖、持倉明細、時光手札與模態互動
 */

// 精選「定心禪語」金句庫 —— 提醒投資者戒除焦躁與市場情緒干擾
const ZEN_MINDFUL_QUOTES = [
  { text: '心若止水，波瀾不驚；市場喧囂皆過客，靜觀雲起定風波。', author: '禪宗定心' },
  { text: '不以暴漲而狂喜，不以暴跌而恐慌；長期之道，在於守心。', author: '靜心之道' },
  { text: '市場短期是投票機，長期是稱重機；耐得住寂寞，守得住繁華。', author: '葛拉漢' },
  { text: '草木不因一日風雨而枯，資產不因短期起伏而敗；順應週期，自成天地。', author: '自然之道' },
  { text: '繁華落盡見真淳，風浪過後是定力；莫在巔峰慕名而來，莫在低谷轉身而去。', author: '投資心法' },
  { text: '致虛極，守靜篤；萬物並作，吾以觀復。', author: '道德經' },
  { text: '行情如四季輪轉，春華秋實自有其時；不憂不懼，靜待花開。', author: '禪語心齋' },
  { text: '交易之病在於貪躁，持盈保泰貴在淡泊；手中有糧，心中不慌。', author: '養心箴言' }
];

const App = {
  holdings: [],
  currentTab: 'all',
  refreshTimer: null,
  isRefreshing: false,
  editingId: null,
  activeJournalHoldingId: null,

  /**
   * 應用程式啟動初始化
   */
  async init() {
    // 1. 初始化資料與圖表
    this.holdings = StorageService.getHoldings();
    PortfolioChart.init('portfolioCanvas');

    // 2. 顯示隨機定心禪語
    this.renderRandomQuote();

    // 3. 綁定事件監聽
    this.bindEvents();

    // 4. 啟動美股市場狀態即時時鐘 (每秒更新)
    this.startMarketClock();

    // 5. 立即渲染基礎視圖與計算
    this.renderAll();

    // 6. 抓取最新即時市場行情 (初次加載)
    await this.refreshPrices();

    // 7. 啟動定時自動輪詢
    this.setupAutoRefresh();
  },

  /**
   * 隨機切換定心金句
   */
  renderRandomQuote() {
    const quoteEl = document.getElementById('zenQuoteText');
    const authorEl = document.getElementById('zenQuoteAuthor');
    if (!quoteEl) return;

    // 漸淡切換動效
    quoteEl.style.opacity = '0';
    setTimeout(() => {
      const randomIdx = Math.floor(Math.random() * ZEN_MINDFUL_QUOTES.length);
      const q = ZEN_MINDFUL_QUOTES[randomIdx];
      quoteEl.textContent = `「${q.text}」`;
      if (authorEl) authorEl.textContent = `—— ${q.author}`;
      quoteEl.style.opacity = '1';
    }, 150);
  },

  /**
   * 美股市場狀態與美東時鐘即時輪詢
   */
  startMarketClock() {
    const update = () => {
      const statusData = MarketStatus.getUSMarketStatus();
      const badgeEl = document.getElementById('marketStatusBadge');
      const textEl = document.getElementById('marketStatusText');
      const timeEl = document.getElementById('easternTimeDisplay');
      const nextEventEl = document.getElementById('marketNextEvent');

      if (badgeEl && textEl) {
        badgeEl.className = `status-indicator ${statusData.className}`;
        textEl.textContent = statusData.label;
      }
      if (timeEl) {
        timeEl.textContent = `${statusData.etTimeStr} ET`;
      }
      if (nextEventEl) {
        nextEventEl.textContent = statusData.description;
      }
    };

    update();
    setInterval(update, 1000);
  },

  /**
   * 刷新所有標的即時價格
   */
  async refreshPrices() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    const refreshIcon = document.getElementById('refreshIcon');
    if (refreshIcon) refreshIcon.style.animation = 'spin 1s linear infinite';

    try {
      const settings = StorageService.getSettings();
      await PriceService.fetchAllPrices(this.holdings, {
        finnhubKey: settings.finnhubKey
      });
      this.renderAll();
      this.showToast('行情報價已同步更新');
    } catch (err) {
      console.error('更新行情失敗:', err);
      this.showToast('部分行情更新超時，已使用快取報價');
    } finally {
      this.isRefreshing = false;
      if (refreshIcon) refreshIcon.style.animation = '';
    }
  },

  /**
   * 設定自動定時刷新
   */
  setupAutoRefresh() {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    const settings = StorageService.getSettings();
    const intervalSeconds = parseInt(settings.refreshInterval, 10) || 60;

    if (intervalSeconds > 0) {
      this.refreshTimer = setInterval(() => {
        this.refreshPrices();
      }, intervalSeconds * 1000);
    }
  },

  /**
   * 計算並渲染所有介面區塊
   */
  renderAll() {
    this.renderDashboard();
    this.renderHoldingsTable();
    this.renderChart();
  },

  /**
   * 渲染資產總覽儀表板
   */
  renderDashboard() {
    let totalValue = 0;
    let totalCost = 0;
    let totalDayChangeVal = 0;

    let cryptoValue = 0, cryptoCost = 0;
    let stockValue = 0, stockCost = 0;
    let etfValue = 0, etfCost = 0;

    this.holdings.forEach(h => {
      const pData = PriceService.getPrice(h.symbol);
      const curPrice = pData?.price || h.costPrice || 0;
      const shares = parseFloat(h.shares) || 0;
      const cost = parseFloat(h.costPrice) || 0;

      const itemValue = shares * curPrice;
      const itemCost = shares * cost;
      
      const change24hPct = pData?.change24hPct || 0;
      const prevPrice = curPrice / (1 + change24hPct / 100);
      const dayChangeItem = (curPrice - prevPrice) * shares;

      totalValue += itemValue;
      totalCost += itemCost;
      totalDayChangeVal += dayChangeItem;

      if (h.category === 'crypto') {
        cryptoValue += itemValue;
        cryptoCost += itemCost;
      } else if (h.category === 'stock') {
        stockValue += itemValue;
        stockCost += itemCost;
      } else if (h.category === 'etf') {
        etfValue += itemValue;
        etfCost += itemCost;
      }
    });

    const totalUnrealizedPnL = totalValue - totalCost;
    const totalReturnPct = totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;
    const totalDayChangePct = totalValue > 0 && (totalValue - totalDayChangeVal) > 0 
      ? (totalDayChangeVal / (totalValue - totalDayChangeVal)) * 100 
      : 0;

    // 填入總覽卡片
    this.setText('totalNetWorth', `$${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    this.setText('totalCostBasis', `$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    
    // 總未實現損益
    const pnlSign = totalUnrealizedPnL >= 0 ? '+' : '';
    const pnlClass = totalUnrealizedPnL >= 0 ? 'pnl-positive' : 'pnl-negative';
    const pnlEl = document.getElementById('totalPnLDisplay');
    if (pnlEl) {
      pnlEl.className = `metric-value ${pnlClass}`;
      pnlEl.textContent = `${pnlSign}$${Math.abs(totalUnrealizedPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const roiEl = document.getElementById('totalRoiDisplay');
    if (roiEl) {
      roiEl.className = `metric-subvalue ${pnlClass}`;
      roiEl.textContent = `報酬率：${pnlSign}${totalReturnPct.toFixed(2)}%`;
    }

    // 24H 當日漲跌
    const daySign = totalDayChangeVal >= 0 ? '+' : '';
    const dayClass = totalDayChangeVal >= 0 ? 'pnl-positive' : 'pnl-negative';
    const dayEl = document.getElementById('dayChangeDisplay');
    if (dayEl) {
      dayEl.className = `metric-value ${dayClass}`;
      dayEl.textContent = `${daySign}$${Math.abs(totalDayChangeVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    const dayPctEl = document.getElementById('dayChangePctDisplay');
    if (dayPctEl) {
      dayPctEl.className = `metric-subvalue ${dayClass}`;
      dayPctEl.textContent = `漲跌幅：${daySign}${totalDayChangePct.toFixed(2)}%`;
    }

    // 填入三大大類概覽卡
    this.updateCategoryMiniCard('catCrypto', cryptoValue, cryptoCost, totalValue);
    this.updateCategoryMiniCard('catStock', stockValue, stockCost, totalValue);
    this.updateCategoryMiniCard('catEtf', etfValue, etfCost, totalValue);
  },

  updateCategoryMiniCard(idPrefix, val, cost, totalVal) {
    const valEl = document.getElementById(`${idPrefix}Val`);
    const subEl = document.getElementById(`${idPrefix}Sub`);
    if (!valEl || !subEl) return;

    const pnl = val - cost;
    const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
    const weightPct = totalVal > 0 ? (val / totalVal) * 100 : 0;
    const sign = pnl >= 0 ? '+' : '';
    const colorClass = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';

    valEl.textContent = `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    subEl.innerHTML = `<span class="${colorClass}">損益 ${sign}${pnlPct.toFixed(1)}%</span> · 佔比 ${weightPct.toFixed(1)}%`;
  },

  /**
   * 渲染持倉明細表格 (包含時光手札徽章與連結)
   */
  renderHoldingsTable() {
    const tbody = document.getElementById('holdingsTableBody');
    if (!tbody) return;

    let filtered = this.holdings;
    if (this.currentTab !== 'all') {
      filtered = this.holdings.filter(h => h.category === this.currentTab);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 36px 16px; color: var(--ink-500);">
            <div style="font-family:var(--font-serif); font-size:15px; margin-bottom:8px;">「空山不見人，但聞人語響」</div>
            <div style="font-size:13px;">此類別目前尚無持倉，點擊上方「+ 新增標的」開始記錄。</div>
          </td>
        </tr>
      `;
      return;
    }

    // 計算總資產以獲得各別標的權重
    let totalPortfolioVal = 0;
    this.holdings.forEach(h => {
      const pData = PriceService.getPrice(h.symbol);
      const curPrice = pData?.price || h.costPrice || 0;
      totalPortfolioVal += (parseFloat(h.shares) || 0) * curPrice;
    });

    tbody.innerHTML = filtered.map(h => {
      const pData = PriceService.getPrice(h.symbol);
      const curPrice = pData?.price || h.costPrice || 0;
      const shares = parseFloat(h.shares) || 0;
      const costPrice = parseFloat(h.costPrice) || 0;

      const marketValue = shares * curPrice;
      const totalCost = shares * costPrice;
      const pnl = marketValue - totalCost;
      const pnlPct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
      const weightPct = totalPortfolioVal > 0 ? (marketValue / totalPortfolioVal) * 100 : 0;

      const pnlSign = pnl >= 0 ? '+' : '';
      const pnlClass = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';

      // 24H 變動
      const dayPct = pData?.change24hPct || 0;
      const daySign = dayPct >= 0 ? '+' : '';
      const dayClass = dayPct >= 0 ? 'pnl-positive' : 'pnl-negative';

      // 標籤類型徽章
      let badgeClass = 'badge-stock';
      let badgeText = '美股';
      if (h.category === 'crypto') {
        badgeClass = 'badge-crypto';
        badgeText = '加密';
      } else if (h.category === 'etf') {
        badgeClass = 'badge-etf';
        badgeText = 'ETF';
      }

      // 手札筆記數量
      const journalCount = (h.journal && Array.isArray(h.journal)) ? h.journal.length : 0;
      const journalBadgeText = journalCount > 0 ? `📖 ${journalCount} 則手札` : `📝 寫心境手札`;

      return `
        <tr data-id="${h.id}">
          <td>
            <div class="asset-cell">
              <span class="asset-icon-badge ${badgeClass}">${badgeText}</span>
              <div class="asset-details">
                <span class="asset-symbol" style="cursor:pointer;" onclick="App.openJournalModal('${h.id}')">${h.symbol}</span>
                <span class="asset-name" style="cursor:pointer;" onclick="App.openJournalModal('${h.id}')" title="${h.notes || ''}">${h.name || h.symbol}</span>
                <button class="asset-journal-badge" title="點擊展開投資心境與觀心覆盤手札" onclick="App.openJournalModal('${h.id}')">
                  ${journalBadgeText}
                </button>
              </div>
            </div>
          </td>
          <td class="num-cell">${shares.toLocaleString('en-US', { maximumFractionDigits: 6 })}</td>
          <td class="num-cell">$${costPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="num-cell">
            <div>$${curPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div class="${dayClass}" style="font-size:11px;">${daySign}${dayPct.toFixed(2)}% (24H)</div>
          </td>
          <td class="num-cell" style="font-weight:600;">$${marketValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td class="num-cell ${pnlClass}">
            <div>${pnlSign}$${Math.abs(pnl).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div style="font-size:11px;">${pnlSign}${pnlPct.toFixed(2)}%</div>
          </td>
          <td class="num-cell" style="color:var(--ink-700);">${weightPct.toFixed(1)}%</td>
          <td>
            <div class="action-btns">
              <button class="icon-btn" title="查看投資心境手札" onclick="App.openJournalModal('${h.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              </button>
              <button class="icon-btn btn-edit" title="編輯持倉" onclick="App.openEditModal('${h.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </button>
              <button class="icon-btn btn-delete" title="刪除標的" onclick="App.deleteHolding('${h.id}')">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  /**
   * 渲染圓餅圖
   */
  renderChart() {
    PortfolioChart.render(this.holdings, PriceService);
  },

  /**
   * 輔助設定文字
   */
  setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  /**
   * 綁定頁面事件
   */
  bindEvents() {
    // 1. 禪語換一句
    const btnQuote = document.getElementById('btnRefreshQuote');
    if (btnQuote) {
      btnQuote.addEventListener('click', () => this.renderRandomQuote());
    }

    // 2. 立即刷新行情
    const btnRefresh = document.getElementById('btnRefreshAll');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => this.refreshPrices());
    }

    // 3. 持倉分類 Tab 切換
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentTab = e.currentTarget.dataset.tab;
        this.renderHoldingsTable();
      });
    });

    // 4. 圓餅圖模式切換 (類別 vs 個別標的)
    const chartToggleBtns = document.querySelectorAll('.chart-toggle-btn');
    chartToggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        chartToggleBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const mode = e.currentTarget.dataset.mode;
        PortfolioChart.setMode(mode);
        this.renderChart();
      });
    });

    // 5. 模態視窗開啟/關閉綁定
    this.bindModalEvents();
  },

  bindModalEvents() {
    // 開啟新增持倉
    const btnAdd = document.getElementById('btnOpenAddModal');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => this.openAddModal());
    }

    // 開啟資料管理 (備份/還原/設定)
    const btnData = document.getElementById('btnOpenDataModal');
    if (btnData) {
      btnData.addEventListener('click', () => this.openDataModal());
    }

    // 關閉所有彈窗
    const closeBtns = document.querySelectorAll('.btn-close-modal, .modal-backdrop-close');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    // 表單提交：新增/編輯持倉
    const formHolding = document.getElementById('formHolding');
    if (formHolding) {
      formHolding.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveHoldingForm();
      });
    }

    // 表單提交：新增心境手札
    const formAddJournal = document.getElementById('formAddJournal');
    if (formAddJournal) {
      formAddJournal.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitNewJournalEntry();
      });
    }

    // 快速推薦標的標籤點擊
    const suggestPills = document.querySelectorAll('.suggest-pill');
    suggestPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const sym = e.currentTarget.dataset.symbol;
        const cat = e.currentTarget.dataset.category;
        const name = e.currentTarget.dataset.name;

        const inputSym = document.getElementById('inputSymbol');
        const selectCat = document.getElementById('selectCategory');
        const inputName = document.getElementById('inputName');

        if (inputSym) inputSym.value = sym;
        if (selectCat) selectCat.value = cat;
        if (inputName) inputName.value = name;
      });
    });

    // 備份匯出按鈕
    const btnExport = document.getElementById('btnExportBackup');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        StorageService.exportBackupJSON();
        this.showToast('已匯出 JSON 備份檔案');
      });
    }

    // 備份匯入檔案選擇
    const inputImport = document.getElementById('inputImportFile');
    if (inputImport) {
      inputImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          const res = StorageService.importBackupJSON(event.target.result);
          if (res.success) {
            this.holdings = StorageService.getHoldings();
            this.renderAll();
            this.refreshPrices();
            this.closeAllModals();
            this.showToast(`成功匯入 ${res.count} 筆持倉資料！`);
          } else {
            alert('匯入失敗：' + res.error);
          }
        };
        reader.readAsText(file);
      });
    }

    // 重置為範例資料
    const btnReset = document.getElementById('btnResetDemo');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('確定要重置為預設示範投資組合嗎？這將覆蓋目前的自訂資料。')) {
          this.holdings = StorageService.resetToDemo();
          this.renderAll();
          this.refreshPrices();
          this.closeAllModals();
          this.showToast('已恢復預設禪意組合');
        }
      });
    }

    // 儲存設定 (輪詢間隔、Finnhub Key)
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        const interval = document.getElementById('settingRefreshInterval').value;
        const key = document.getElementById('settingFinnhubKey').value.trim();

        StorageService.saveSettings({
          refreshInterval: parseInt(interval, 10),
          finnhubKey: key
        });

        this.setupAutoRefresh();
        this.closeAllModals();
        this.showToast('設定已成功儲存');
      });
    }
  },

  /**
   * 開啟投資心境手札模態視窗
   */
  openJournalModal(holdingId) {
    const item = this.holdings.find(h => h.id === holdingId);
    if (!item) return;

    this.activeJournalHoldingId = holdingId;

    // 填寫頂部摘要資訊
    const pData = PriceService.getPrice(item.symbol);
    const curPrice = pData?.price || item.costPrice || 0;
    const costPrice = parseFloat(item.costPrice) || 0;
    const pnlPct = costPrice > 0 ? ((curPrice - costPrice) / costPrice) * 100 : 0;
    const sign = pnlPct >= 0 ? '+' : '';
    const pnlClass = pnlPct >= 0 ? 'pnl-positive' : 'pnl-negative';

    document.getElementById('modalJournalTitle').textContent = `📖 投資心境手札 · ${item.symbol}`;
    document.getElementById('journalHoldingId').value = item.id;
    document.getElementById('journalAssetSymbol').textContent = `${item.symbol} · ${item.name || item.symbol}`;
    document.getElementById('journalAssetCost').textContent = `買入均價：$${costPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('journalAssetPrice').textContent = `$${curPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    const pnlEl = document.getElementById('journalAssetPnL');
    if (pnlEl) {
      pnlEl.className = pnlClass;
      pnlEl.textContent = `${sign}${pnlPct.toFixed(2)}%`;
    }

    // 重設輸入框並預設今日日期
    document.getElementById('journalContent').value = '';
    document.getElementById('journalDate').value = new Date().toISOString().slice(0, 10);

    // 渲染手札時間軸
    this.renderJournalTimeline(item);

    this.showModal('modalJournal');
  },

  /**
   * 渲染時間軸列表
   */
  renderJournalTimeline(holding) {
    const timelineEl = document.getElementById('journalTimeline');
    const badgeEl = document.getElementById('journalCountBadge');
    if (!timelineEl) return;

    const list = holding.journal || [];
    if (badgeEl) badgeEl.textContent = `共 ${list.length} 則時光手札`;

    if (list.length === 0) {
      timelineEl.innerHTML = `
        <div style="padding: 24px 16px; text-align: center; color: var(--ink-500); background-color: var(--bg-canvas); border-radius: var(--radius-md); border: 1px dashed var(--card-border);">
          <div style="font-family: var(--font-serif); font-size: 14px; margin-bottom: 6px;">「初心若磐，歲月不負」</div>
          <div style="font-size: 12px;">尚未記錄心境手札，立即在上方寫下您買入與持有的核心理由吧！</div>
        </div>
      `;
      return;
    }

    // 依日期時間倒序排列
    const sorted = [...list].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.timestamp || 0) - (a.timestamp || 0));

    timelineEl.innerHTML = sorted.map((entry) => {
      let tagClass = 'tag-mindset';
      if (entry.tag === '初衷信念') tagClass = 'tag-thesis';
      else if (entry.tag === '加倉觀點') tagClass = 'tag-accumulate';
      else if (entry.tag === '財報覆盤') tagClass = 'tag-review';
      else if (entry.tag === '波動定心') tagClass = 'tag-mindset';

      return `
        <div class="timeline-item">
          <div class="timeline-dot"></div>
          <div class="timeline-card">
            <div class="timeline-card-header">
              <div class="timeline-date-wrap">
                <span class="timeline-date">🗓️ ${entry.date || '未知日期'}</span>
                <span class="timeline-tag ${tagClass}">${entry.tag || '心態手札'}</span>
              </div>
              <button class="icon-btn btn-delete" title="刪除此則手札" onclick="App.deleteJournalEntry('${holding.id}', '${entry.id}')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
            <div class="timeline-content">${escapeHTML(entry.content)}</div>
          </div>
        </div>
      `;
    }).join('');
  },

  /**
   * 提交新增一則心境手札
   */
  submitNewJournalEntry() {
    const holdingId = document.getElementById('journalHoldingId').value;
    const content = document.getElementById('journalContent').value.trim();
    const date = document.getElementById('journalDate').value || new Date().toISOString().slice(0, 10);
    
    // 取得選取的標籤
    const tagRadios = document.getElementsByName('journalTag');
    let selectedTag = '初衷信念';
    for (const r of tagRadios) {
      if (r.checked) {
        selectedTag = r.value;
        break;
      }
    }

    if (!content) {
      alert('請填寫手札內容');
      return;
    }

    const newEntry = StorageService.addJournalEntry(holdingId, {
      tag: selectedTag,
      date,
      content
    });

    if (newEntry) {
      this.holdings = StorageService.getHoldings();
      const updatedHolding = this.holdings.find(h => h.id === holdingId);
      
      document.getElementById('journalContent').value = '';
      if (updatedHolding) {
        this.renderJournalTimeline(updatedHolding);
      }
      this.renderHoldingsTable();
      this.showToast('已寫入一則時光心境手札');
    }
  },

  /**
   * 刪除一則手札
   */
  deleteJournalEntry(holdingId, journalId) {
    if (confirm('確定要刪除這則歷史手札嗎？')) {
      StorageService.deleteJournalEntry(holdingId, journalId);
      this.holdings = StorageService.getHoldings();
      const updatedHolding = this.holdings.find(h => h.id === holdingId);
      if (updatedHolding) {
        this.renderJournalTimeline(updatedHolding);
      }
      this.renderHoldingsTable();
      this.showToast('已刪除該筆手札');
    }
  },

  openAddModal() {
    this.editingId = null;
    document.getElementById('modalHoldingTitle').textContent = '新增標的持倉';
    document.getElementById('formHolding').reset();
    document.getElementById('inputHoldingId').value = '';
    document.getElementById('manualPriceGroup').style.display = 'none';
    this.showModal('modalHolding');
  },

  openEditModal(id) {
    const item = this.holdings.find(h => h.id === id);
    if (!item) return;

    this.editingId = id;
    document.getElementById('modalHoldingTitle').textContent = `編輯持倉：${item.symbol}`;
    document.getElementById('inputHoldingId').value = item.id;
    document.getElementById('selectCategory').value = item.category;
    document.getElementById('inputSymbol').value = item.symbol;
    document.getElementById('inputName').value = item.name || '';
    document.getElementById('inputShares').value = item.shares;
    document.getElementById('inputCostPrice').value = item.costPrice;
    document.getElementById('inputNotes').value = item.notes || '';

    // 現價手動覆蓋欄位
    const pData = PriceService.getPrice(item.symbol);
    const manualGroup = document.getElementById('manualPriceGroup');
    const inputManual = document.getElementById('inputManualPrice');
    if (manualGroup && inputManual) {
      manualGroup.style.display = 'block';
      inputManual.value = pData?.price || item.costPrice;
    }

    this.showModal('modalHolding');
  },

  async saveHoldingForm() {
    const id = document.getElementById('inputHoldingId').value;
    const category = document.getElementById('selectCategory').value;
    const symbol = document.getElementById('inputSymbol').value.toUpperCase().trim();
    const name = document.getElementById('inputName').value.trim() || symbol;
    const shares = parseFloat(document.getElementById('inputShares').value);
    const costPrice = parseFloat(document.getElementById('inputCostPrice').value);
    const notes = document.getElementById('inputNotes').value.trim();
    const manualPrice = parseFloat(document.getElementById('inputManualPrice')?.value);

    if (!symbol || isNaN(shares) || shares <= 0 || isNaN(costPrice) || costPrice < 0) {
      alert('請填寫有效的代碼、數量與成本價');
      return;
    }

    if (id) {
      // 編輯既有
      StorageService.updateHolding(id, {
        category, symbol, name, shares, costPrice, notes
      });
      if (!isNaN(manualPrice) && manualPrice > 0) {
        PriceService.setManualPrice(symbol, manualPrice);
      }
      this.showToast(`已更新 ${symbol} 持倉`);
    } else {
      // 新增
      StorageService.addHolding({
        category, symbol, name, shares, costPrice, notes
      });
      this.showToast(`已成功新增 ${symbol}`);
    }

    this.holdings = StorageService.getHoldings();
    this.closeAllModals();
    this.renderAll();
    await this.refreshPrices();
  },

  deleteHolding(id) {
    const item = this.holdings.find(h => h.id === id);
    if (!item) return;

    if (confirm(`確定要刪除「${item.symbol} - ${item.name}」的持倉記錄嗎？`)) {
      StorageService.deleteHolding(id);
      this.holdings = StorageService.getHoldings();
      this.renderAll();
      this.showToast(`已刪除 ${item.symbol}`);
    }
  },

  openDataModal() {
    const settings = StorageService.getSettings();
    const intervalSelect = document.getElementById('settingRefreshInterval');
    const keyInput = document.getElementById('settingFinnhubKey');

    if (intervalSelect) intervalSelect.value = settings.refreshInterval || 60;
    if (keyInput) keyInput.value = settings.finnhubKey || '';

    this.showModal('modalData');
  },

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeAllModals() {
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(m => m.classList.remove('active'));
  },

  /**
   * 顯示溫和禪意的 Toast 提示
   */
  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'zen-toast';
    toast.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 2400);
  }
};

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
