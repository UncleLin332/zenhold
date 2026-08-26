/**
 * ============================================================================
 * ZenHold - 本地儲存與備份管理器 (Storage Engine)
 * ============================================================================
 * 負責持倉清單之 CRUD、預設示範數據初始化、JSON 備份匯出與還原。
 * 完全存放於瀏覽器 localStorage，保護投資隱私與資產安全。
 */

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
    category: 'crypto', // 'crypto' | 'stock' | 'etf'
    shares: 0.35,
    costPrice: 62500,
    notes: '核心數位黃金儲備，定期定額'
  },
  {
    id: 'demo-voo-2',
    symbol: 'VOO',
    name: 'Vanguard S&P 500 ETF',
    category: 'etf',
    shares: 15,
    costPrice: 485.50,
    notes: '美股大盤核心指數定海神針'
  },
  {
    id: 'demo-qqq-3',
    symbol: 'QQQ',
    name: 'Invesco QQQ (Nasdaq 100)',
    category: 'etf',
    shares: 8,
    costPrice: 460.00,
    notes: '科技巨頭成長動能'
  },
  {
    id: 'demo-nvda-4',
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    category: 'stock',
    shares: 12,
    costPrice: 116.80,
    notes: 'AI 運算核心基礎建設'
  },
  {
    id: 'demo-aapl-5',
    symbol: 'AAPL',
    name: 'Apple Inc.',
    category: 'stock',
    shares: 10,
    costPrice: 215.00,
    notes: '生態系與自由現金流堡壘'
  }
];

const StorageService = {
  /**
   * 取得持倉資料列表
   */
  getHoldings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HOLDINGS);
      if (!data) {
        // 初次造訪：寫入預設示範組合
        this.saveHoldings(DEFAULT_DEMO_HOLDINGS);
        return [...DEFAULT_DEMO_HOLDINGS];
      }
      return JSON.parse(data);
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
    const newHolding = {
      id: newId,
      symbol: item.symbol.toUpperCase().trim(),
      name: item.name ? item.name.trim() : item.symbol.toUpperCase().trim(),
      category: item.category || 'stock',
      shares: parseFloat(item.shares) || 0,
      costPrice: parseFloat(item.costPrice) || 0,
      notes: item.notes ? item.notes.trim() : '',
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
   * 匯出備份 JSON 檔案
   */
  exportBackupJSON() {
    const backupData = {
      version: '1.0',
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
    return [...DEFAULT_DEMO_HOLDINGS];
  },

  /**
   * 讀取使用者設定
   */
  getSettings() {
    try {
      const s = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return s ? JSON.parse(s) : { refreshInterval: 60, finnhubKey: 'da7f8npr01qj8fm6l88gda7f8npr01qj8fm6l890' };
    } catch (e) {
      return { refreshInterval: 60, finnhubKey: 'da7f8npr01qj8fm6l88gda7f8npr01qj8fm6l890' };
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
