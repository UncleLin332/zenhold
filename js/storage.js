/**
 * ============================================================================
 * ZenHold - 本地儲存與投資心境手札管理器 (Storage Engine)
 * ============================================================================
 * 負責持倉清單之 CRUD、時光手札歷史時間軸、示範數據初始化、JSON 備份匯出與還原。
 * 完全存放於瀏覽器 localStorage，保護投資隱私與資產安全。
 */

const DEFAULT_GLOBAL_FINNHUB_KEY = 'da7f8npr01qj8fm6l88gda7f8npr01qj8fm6l890';

const STORAGE_KEYS = {
  HOLDINGS: 'zenhold_holdings_data',
  SETTINGS: 'zenhold_user_settings',
  PRICE_CACHE: 'zenhold_price_cache'
};

const DEFAULT_DEMO_HOLDINGS = [
  {
    id: 'demo-btc-1',
    symbol: 'BTC',
    name: 'Bitcoin (比特幣)',
    category: 'crypto',
    shares: 0.35,
    costPrice: 62500,
    notes: '核心數位黃金儲備，定期定額',
    journal: [
      {
        id: 'jnl-btc-1',
        date: '2026-01-15',
        timestamp: 1768435200000,
        tag: '初衷信念',
        content: '建立核心數位黃金儲備。比特幣擁有絕對稀缺性與全球去中心化共識，作為長期抗通膨定海神針，設定每逢回調分批定期定額。'
      },
      {
        id: 'jnl-btc-2',
        date: '2026-06-20',
        timestamp: 1781913600000,
        tag: '波動定心',
        content: '市場經歷短期回檔震盪，鏈上基本面與長期持有者數據依舊堅固。不隨恐慌情緒殺跌，保持定力，靜待減半週期後續效應。'
      }
    ]
  },
  {
    id: 'demo-voo-2',
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    category: 'etf',
    shares: 15,
    costPrice: 485.50,
    notes: '美股大盤核心指數定海神針',
    journal: [
      {
        id: 'jnl-voo-1',
        date: '2026-02-10',
        timestamp: 1770681600000,
        tag: '初衷信念',
        content: '全美前 500 強企業核心指數，隨全球最強生產力長期穩健複合成長。只買不賣，做時間的朋友。'
      }
    ]
  },
  {
    id: 'demo-qqq-3',
    symbol: 'QQQ',
    name: 'Invesco QQQ (Nasdaq 100)',
    category: 'etf',
    shares: 8,
    costPrice: 460.00,
    notes: '科技巨頭成長動能',
    journal: [
      {
        id: 'jnl-qqq-1',
        date: '2026-03-01',
        timestamp: 1772323200000,
        tag: '初衷信念',
        content: '聚焦科技前沿與創新突破，承載 AI 時代科技巨頭的長期爆發力。'
      }
    ]
  },
  {
    id: 'demo-nvda-4',
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    category: 'stock',
    shares: 12,
    costPrice: 116.80,
    notes: 'AI 運算核心基礎建設',
    journal: [
      {
        id: 'jnl-nvda-1',
        date: '2026-04-12',
        timestamp: 1775952000000,
        tag: '初衷信念',
        content: '全球 AI 基礎設施算力無可替代的龍頭，CUDA 生態系護城河深厚。'
      }
    ]
  },
  {
    id: 'demo-aapl-5',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    category: 'stock',
    shares: 10,
    costPrice: 215.00,
    notes: '生態系與自由現金流堡壘',
    journal: [
      {
        id: 'jnl-aapl-1',
        date: '2026-05-08',
        timestamp: 1778198400000,
        tag: '初衷信念',
        content: '無與倫比的硬體軟體生態鎖定與龐大自由現金流，持續買回庫藏股提供強韌底氣。'
      }
    ]
  }
];

const StorageService = {
  /**
   * 取得持倉資料列表（自動遷移與修補手札）
   */
  getHoldings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HOLDINGS);
      if (!data) {
        // 初次造訪：寫入預設示範組合
        this.saveHoldings(DEFAULT_DEMO_HOLDINGS);
        return JSON.parse(JSON.stringify(DEFAULT_DEMO_HOLDINGS));
      }
      const list = JSON.parse(data);
      let needsSave = false;

      // 檢查並自動平滑遷移：確保每個 holding 都有 journal 陣列
      list.forEach(h => {
        if (!h.journal || !Array.isArray(h.journal)) {
          h.journal = [];
          if (h.notes && h.notes.trim() !== '') {
            const today = new Date().toISOString().slice(0, 10);
            h.journal.push({
              id: 'jnl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
              date: h.createdAt ? new Date(h.createdAt).toISOString().slice(0, 10) : today,
              timestamp: h.createdAt || Date.now(),
              tag: '初衷信念',
              content: h.notes
            });
          }
          needsSave = true;
        }
      });

      if (needsSave) {
        this.saveHoldings(list);
      }

      return list;
    } catch (err) {
      console.error('讀取持倉失敗:', err);
      return [];
    }
  },

  /**
   * 儲存持倉清單
   */
  saveHoldings(holdings) {
    try {
      localStorage.setItem(STORAGE_KEYS.HOLDINGS, JSON.stringify(holdings));
      return true;
    } catch (err) {
      console.error('儲存持倉失敗:', err);
      return false;
    }
  },

  /**
   * 新增持倉標的
   */
  addHolding(item) {
    const list = this.getHoldings();
    const newId = 'hold_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const today = new Date().toISOString().slice(0, 10);
    const initialNotes = item.notes ? item.notes.trim() : '';

    const newJournal = [];
    if (initialNotes) {
      newJournal.push({
        id: 'jnl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        date: today,
        timestamp: Date.now(),
        tag: '初衷信念',
        content: initialNotes
      });
    }

    const newHolding = {
      id: newId,
      symbol: item.symbol.toUpperCase().trim(),
      name: item.name ? item.name.trim() : item.symbol.toUpperCase().trim(),
      category: item.category || 'stock',
      shares: parseFloat(item.shares) || 0,
      costPrice: parseFloat(item.costPrice) || 0,
      notes: initialNotes,
      journal: newJournal,
      createdAt: Date.now()
    };
    list.unshift(newHolding);
    this.saveHoldings(list);
    return newHolding;
  },

  /**
   * 更新既有持倉
   */
  updateHolding(id, updatedFields) {
    const list = this.getHoldings();
    const idx = list.findIndex(h => h.id === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...updatedFields,
        symbol: (updatedFields.symbol || list[idx].symbol).toUpperCase().trim(),
        shares: parseFloat(updatedFields.shares !== undefined ? updatedFields.shares : list[idx].shares) || 0,
        costPrice: parseFloat(updatedFields.costPrice !== undefined ? updatedFields.costPrice : list[idx].costPrice) || 0,
        journal: updatedFields.journal || list[idx].journal || [],
        updatedAt: Date.now()
      };
      this.saveHoldings(list);
      return list[idx];
    }
    return null;
  },

  /**
   * 刪除持倉
   */
  deleteHolding(id) {
    let list = this.getHoldings();
    const beforeLen = list.length;
    list = list.filter(h => h.id !== id);
    this.saveHoldings(list);
    return list.length < beforeLen;
  },

  /**
   * 新增一則心境手札筆記
   */
  addJournalEntry(holdingId, entry) {
    const list = this.getHoldings();
    const holding = list.find(h => h.id === holdingId);
    if (!holding) return null;

    if (!holding.journal) holding.journal = [];

    const newEntry = {
      id: 'jnl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      date: entry.date || new Date().toISOString().slice(0, 10),
      timestamp: Date.now(),
      tag: entry.tag || '心態覆盤',
      content: entry.content ? entry.content.trim() : ''
    };

    // 依日期時間倒序（最新在最前）
    holding.journal.unshift(newEntry);
    this.saveHoldings(list);
    return newEntry;
  },

  /**
   * 刪除一則心境手札筆記
   */
  deleteJournalEntry(holdingId, journalId) {
    const list = this.getHoldings();
    const holding = list.find(h => h.id === holdingId);
    if (!holding || !holding.journal) return false;

    holding.journal = holding.journal.filter(j => j.id !== journalId);
    this.saveHoldings(list);
    return true;
  },

  /**
   * 匯出備份 JSON 檔案
   */
  exportBackupJSON() {
    const backupData = {
      version: '1.2',
      exportedAt: new Date().toISOString(),
      holdings: this.getHoldings(),
      settings: this.getSettings()
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchor = document.createElement('a');
    const filename = `ZenHold_Backup_${new Date().toISOString().slice(0,10)}.json`;
    
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  },

  /**
   * 匯入還原 JSON 檔案
   */
  importBackupJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!data || !Array.isArray(data.holdings)) {
        throw new Error('備份檔案格式無效');
      }

      this.saveHoldings(data.holdings);
      if (data.settings) {
        this.saveSettings(data.settings);
      }
      return { success: true, count: data.holdings.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  /**
   * 重置為範例組合
   */
  resetToDemo() {
    this.saveHoldings(DEFAULT_DEMO_HOLDINGS);
    return JSON.parse(JSON.stringify(DEFAULT_DEMO_HOLDINGS));
  },

  /**
   * 讀取使用者設定 (自動修補空金鑰)
   */
  getSettings() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      let parsed = s ? JSON.parse(s) : {};
      if (!parsed.finnhubKey || parsed.finnhubKey.trim() === '') {
        parsed.finnhubKey = DEFAULT_GLOBAL_FINNHUB_KEY;
        this.saveSettings(parsed);
      }
      return {
        refreshInterval: parsed.refreshInterval || 60,
        finnhubKey: parsed.finnhubKey
      };
    } catch (e) {
      return { refreshInterval: 60, finnhubKey: DEFAULT_GLOBAL_FINNHUB_KEY };
    }
  },

  /**
   * 儲存使用者設定
   */
  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('儲存設定失敗:', e);
    }
  }
};

window.StorageService = StorageService;
