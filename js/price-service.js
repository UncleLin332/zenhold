/**
 * ============================================================================
 * ZenHold - 即時市場行情爬蟲與報價服務 (Price Service)
 * ============================================================================
 * 支援多來源加密貨幣與美股/ETF行情獲取：
 * 1. 加密貨幣：Binance 24hr Ticker API & CoinGecko 公開報價 API (免金鑰、高頻率)
 * 2. 美股與 ETF：Yahoo Finance Chart API / CORS 代理 / Finnhub API (可選填金鑰)
 * 3. 智慧快取與降級保底機制，確保離線或網路異常時依然保持介面平穩
 */

const CRYPTO_COINGECKO_MAP = {
  'BTC': 'bitcoin',
  'BITCOIN': 'bitcoin',
  'ETH': 'ethereum',
  'ETHEREUM': 'ethereum',
  'SOL': 'solana',
  'SOLANA': 'solana',
  'BNB': 'binancecoin',
  'XRP': 'ripple',
  'ADA': 'cardano',
  'DOGE': 'dogecoin',
  'AVAX': 'avalanche-2',
  'DOT': 'polkadot',
  'LINK': 'chainlink',
  'NEAR': 'near',
  'SUI': 'sui',
  'APT': 'aptos',
  'MATIC': 'matic-network',
  'POL': 'polygon-ecosystem-token',
  'SHIB': 'shiba-inu',
  'PEPE': 'pepe'
};

const PriceService = {
  // 快取儲存：symbol -> { price, change24h, change24hPct, lastUpdated, source }
  cache: {},

  /**
   * 初始化快取（從 localStorage 載入已記錄的價格）
   */
  initCache() {
    try {
      const saved = localStorage.getItem('zenhold_price_cache');
      if (saved) {
        this.cache = JSON.parse(saved);
      }
    } catch (e) {
      console.warn('載入行情快取失敗:', e);
    }
  },

  /**
   * 儲存快取至 localStorage
   */
  saveCache() {
    try {
      localStorage.setItem('zenhold_price_cache', JSON.stringify(this.cache));
    } catch (e) {
      console.warn('儲存行情快取失敗:', e);
    }
  },

  /**
   * 批次更新所有持倉標的之行情
   * @param {Array} holdings 持倉清單
   * @param {Object} options 設定選項（如 finnhubKey 等）
   * @returns {Promise<Object>} 回傳各標的最新價格物件
   */
  async fetchAllPrices(holdings, options = {}) {
    if (!holdings || holdings.length === 0) return this.cache;

    const cryptoItems = holdings.filter(h => h.category === 'crypto');
    const stockItems = holdings.filter(h => h.category === 'stock' || h.category === 'etf');

    const promises = [];

    if (cryptoItems.length > 0) {
      promises.push(this.fetchCryptoPrices(cryptoItems));
    }

    if (stockItems.length > 0) {
      promises.push(this.fetchStockPrices(stockItems, options));
    }

    await Promise.allSettled(promises);
    this.saveCache();
    return this.cache;
  },

  /**
   * 抓取加密貨幣即時報價 (優先嘗試 Binance，備選 CoinGecko)
   */
  async fetchCryptoPrices(cryptoList) {
    const symbols = [...new Set(cryptoList.map(item => item.symbol.toUpperCase()))];

    for (const sym of symbols) {
      let fetched = false;

      // 1. 優先嘗試 Binance Public 24hr API (無 CORS 限制、更新速度極快)
      try {
        const binanceSymbol = `${sym}USDT`;
        const resp = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}`, {
          cache: 'no-store'
        });
        if (resp.ok) {
          const data = await resp.json();
          const price = parseFloat(data.lastPrice);
          const changePct = parseFloat(data.priceChangePercent);
          const changeVal = parseFloat(data.priceChange);

          if (!isNaN(price) && price > 0) {
            this.cache[sym] = {
              price,
              change24h: changeVal,
              change24hPct: changePct,
              lastUpdated: Date.now(),
              source: 'Binance API'
            };
            fetched = true;
          }
        }
      } catch (err) {
        // Binance 失敗時靜默轉入備用管道
      }

      // 2. 備用管道：CoinGecko Public API
      if (!fetched) {
        try {
          const coinId = CRYPTO_COINGECKO_MAP[sym] || sym.toLowerCase();
          const cgResp = await fetch(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true`
          );
          if (cgResp.ok) {
            const cgData = await cgResp.json();
            if (cgData[coinId]) {
              const price = cgData[coinId].usd;
              const changePct = cgData[coinId].usd_24h_change || 0;
              this.cache[sym] = {
                price,
                change24h: (price * changePct) / 100,
                change24hPct: changePct,
                lastUpdated: Date.now(),
                source: 'CoinGecko'
              };
              fetched = true;
            }
          }
        } catch (e) {
          // CoinGecko 失敗
        }
      }
    }
  },

  /**
   * 抓取美股與 ETF 即時行情
   * 支援 Yahoo Finance、公開 CORS Proxy、與自訂 Finnhub API Key
   */
  async fetchStockPrices(stockList, options = {}) {
    const symbols = [...new Set(stockList.map(item => item.symbol.toUpperCase()))];
    const finnhubKey = options.finnhubKey || localStorage.getItem('zenhold_finnhub_key') || '';

    for (const sym of symbols) {
      let fetched = false;

      // 1. 若使用者有提供 Finnhub Key，優先使用 Finnhub 官方即時 API
      if (finnhubKey) {
        try {
          const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${finnhubKey}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.c && data.c > 0) {
              const currentPrice = data.c;
              const prevClose = data.pc || currentPrice;
              const changeVal = data.d || (currentPrice - prevClose);
              const changePct = data.dp || ((changeVal / prevClose) * 100);

              this.cache[sym] = {
                price: currentPrice,
                change24h: changeVal,
                change24hPct: changePct,
                lastUpdated: Date.now(),
                source: 'Finnhub'
              };
              fetched = true;
            }
          }
        } catch (e) {
          // Finnhub 連線失敗
        }
      }

      // 2. 透過 Yahoo Finance 公開 Chart API 抓取最新股價 (附帶可靠的 AllOrigins 代理)
      if (!fetched) {
        try {
          const targetUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`;
          // 透過 allorigins 公開代理繞過瀏覽器 CORS
          const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000); // 4秒逾時保護
          
          const res = await fetch(proxyUrl, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (res.ok) {
            const proxyData = await res.json();
            const yfData = JSON.parse(proxyData.contents);
            const meta = yfData?.chart?.result?.[0]?.meta;

            if (meta) {
              const currentPrice = meta.regularMarketPrice || meta.chartPreviousClose;
              const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
              const changeVal = currentPrice - prevClose;
              const changePct = prevClose > 0 ? (changeVal / prevClose) * 100 : 0;

              if (currentPrice > 0) {
                this.cache[sym] = {
                  price: currentPrice,
                  change24h: changeVal,
                  change24hPct: changePct,
                  lastUpdated: Date.now(),
                  source: 'Yahoo Finance'
                };
                fetched = true;
              }
            }
          }
        } catch (e) {
          // Yahoo Finance 抓取逾時或失敗
        }
      }

      // 3. 備援保底：若無網路或外部 API 均無法回應，但使用者有手動輸入成本或歷史快取，保留既有數值
      if (!fetched && !this.cache[sym]) {
        // 從持倉列表中查找使用者的購買成本作為基礎參考
        const item = stockList.find(i => i.symbol.toUpperCase() === sym);
        if (item && item.costPrice > 0) {
          this.cache[sym] = {
            price: item.costPrice,
            change24h: 0,
            change24hPct: 0,
            lastUpdated: Date.now(),
            source: '手動/成本基準'
          };
        }
      }
    }
  },

  /**
   * 手動覆蓋單一標的現價
   */
  setManualPrice(symbol, price) {
    const sym = symbol.toUpperCase();
    const current = this.cache[sym] || {};
    const oldPrice = current.price || price;
    const changeVal = price - oldPrice;
    const changePct = oldPrice > 0 ? (changeVal / oldPrice) * 100 : 0;

    this.cache[sym] = {
      price: parseFloat(price),
      change24h: changeVal,
      change24hPct: changePct,
      lastUpdated: Date.now(),
      source: '手動指定'
    };
    this.saveCache();
  },

  /**
   * 取得指定標的之即時行情
   */
  getPrice(symbol) {
    return this.cache[symbol.toUpperCase()] || null;
  }
};

PriceService.initCache();
window.PriceService = PriceService;
