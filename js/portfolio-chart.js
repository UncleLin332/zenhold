/**
 * ============================================================================
 * ZenHold - 禪意資產配置甜甜圈/圓餅圖引擎 (Portfolio Chart Engine)
 * ============================================================================
 * 基於原生 HTML5 Canvas 打造，具備 High-DPI (Retina) 高清渲染、
 * 柔和色調、動態互動 Hover 與雙模式（類別佔比 vs 標的佔比）切換。
 */

const ZEN_CHART_COLORS = [
  '#c4923e', // 暖琥珀 (Crypto / BTC)
  '#365975', // 靛藍 (US Stock)
  '#674e6e', // 黛紫 (ETF)
  '#2b7a4b', // 竹青綠
  '#b84333', // 赭石紅
  '#7a6f5d', // 泥土灰棕
  '#4a6b6c', // 松針青
  '#8a5d3b', // 栗色
  '#4f5d75', // 墨青
  '#837d7d'  // 硯台灰
];

const PortfolioChart = {
  canvas: null,
  ctx: null,
  slices: [],
  hoverIndex: -1,
  mode: 'category', // 'category' | 'holdings'
  animationProgress: 1,

  init(canvasId) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.bindEvents();
  },

  setMode(mode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.animate();
    }
  },

  bindEvents() {
    if (!this.canvas) return;

    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (this.canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (this.canvas.height / rect.height);
      const centerX = this.canvas.width / 2;
      const centerY = this.canvas.height / 2;

      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const outerRadius = (Math.min(this.canvas.width, this.canvas.height) / 2) * 0.88;
      const innerRadius = outerRadius * 0.55;

      let hitIndex = -1;
      if (dist >= innerRadius && dist <= outerRadius + 8) {
        let angle = Math.atan2(dy, dx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;
        // 轉為以 12 點鐘方向為起點 ( -PI/2 )
        const normalizedAngle = (angle + Math.PI / 2) % (Math.PI * 2);

        for (let i = 0; i < this.slices.length; i++) {
          const s = this.slices[i];
          if (normalizedAngle >= s.startAngle && normalizedAngle < s.endAngle) {
            hitIndex = i;
            break;
          }
        }
      }

      if (this.hoverIndex !== hitIndex) {
        this.hoverIndex = hitIndex;
        this.draw();
        this.updateCenterInfo();
      }
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.hoverIndex !== -1) {
        this.hoverIndex = -1;
        this.draw();
        this.updateCenterInfo();
      }
    });
  },

  /**
   * 計算並整理圖表數據
   */
  prepareData(holdings, priceService) {
    let totalValue = 0;
    const items = [];

    holdings.forEach(h => {
      const pData = priceService.getPrice(h.symbol);
      const curPrice = pData?.price || h.costPrice || 0;
      const val = (parseFloat(h.shares) || 0) * curPrice;
      totalValue += val;
      items.push({
        ...h,
        currentPrice: curPrice,
        marketValue: val
      });
    });

    this.totalValue = totalValue;

    if (this.mode === 'category') {
      const catMap = {
        crypto: { name: '加密貨幣 (Crypto)', value: 0, color: '#c4923e', code: 'crypto' },
        stock: { name: '美股個股 (Stocks)', value: 0, color: '#365975', code: 'stock' },
        etf: { name: '美股 ETF (ETFs)', value: 0, color: '#674e6e', code: 'etf' }
      };

      items.forEach(it => {
        if (catMap[it.category]) {
          catMap[it.category].value += it.marketValue;
        }
      });

      const categories = Object.values(catMap).filter(c => c.value > 0);
      return { totalValue, list: categories };
    } else {
      // 個別標的佔比
      const sorted = [...items].filter(i => i.marketValue > 0).sort((a, b) => b.marketValue - a.marketValue);
      const formatted = sorted.map((it, idx) => ({
        name: it.symbol,
        fullName: it.name || it.symbol,
        value: it.marketValue,
        color: ZEN_CHART_COLORS[idx % ZEN_CHART_COLORS.length],
        code: it.symbol
      }));
      return { totalValue, list: formatted };
    }
  },

  render(holdings, priceService) {
    const data = this.prepareData(holdings, priceService);
    const { totalValue, list } = data;

    // 計算各扇形角度
    let currentAngle = 0;
    this.slices = list.map(item => {
      const pct = totalValue > 0 ? item.value / totalValue : 0;
      const angle = pct * Math.PI * 2;
      const slice = {
        name: item.name,
        value: item.value,
        pct: pct * 100,
        color: item.color,
        startAngle: currentAngle,
        endAngle: currentAngle + angle
      };
      currentAngle += angle;
      return slice;
    });

    this.draw();
    this.renderLegend(list, totalValue);
    this.updateCenterInfo();
  },

  animate() {
    this.animationProgress = 0;
    const startTime = performance.now();
    const duration = 350;

    const step = (timestamp) => {
      const elapsed = timestamp - startTime;
      this.animationProgress = Math.min(1, elapsed / duration);
      this.draw();
      if (this.animationProgress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  },

  draw() {
    if (!this.canvas || !this.ctx) return;

    // 處理 Retina 高清螢幕解析度
    const dpr = window.devicePixelRatio || 1;
    const width = 240;
    const height = 240;

    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = (width / 2) * 0.84;
    const innerRadius = baseRadius * 0.58;

    if (this.slices.length === 0 || this.totalValue === 0) {
      // 繪製空狀態圓環
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius, 0, Math.PI * 2);
      ctx.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
      ctx.fillStyle = '#eeebe3';
      ctx.fill();
      ctx.restore();
      return;
    }

    // 繪製各個扇形
    this.slices.forEach((slice, i) => {
      const isHovered = i === this.hoverIndex;
      const currentOuter = isHovered ? baseRadius + 4 : baseRadius;
      const currentInner = isHovered ? innerRadius - 2 : innerRadius;

      // 旋轉起點由頂部 ( -PI/2 ) 開始
      const drawStart = slice.startAngle * this.animationProgress - Math.PI / 2;
      const drawEnd = slice.endAngle * this.animationProgress - Math.PI / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, currentOuter, drawStart, drawEnd);
      ctx.arc(centerX, centerY, currentInner, drawEnd, drawStart, true);
      ctx.closePath();

      ctx.fillStyle = slice.color;
      ctx.fill();

      // 細緻柔和白邊線
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    });

    ctx.restore();
  },

  updateCenterInfo() {
    const labelEl = document.getElementById('chartCenterLabel');
    const valEl = document.getElementById('chartCenterVal');
    if (!labelEl || !valEl) return;

    if (this.hoverIndex >= 0 && this.slices[this.hoverIndex]) {
      const s = this.slices[this.hoverIndex];
      labelEl.textContent = s.name;
      valEl.textContent = `${s.pct.toFixed(1)}%`;
      valEl.style.color = s.color;
    } else {
      labelEl.textContent = '總資產配置';
      valEl.textContent = `$${(this.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      valEl.style.color = 'var(--ink-900)';
    }
  },

  renderLegend(list, totalValue) {
    const legendEl = document.getElementById('chartLegendList');
    if (!legendEl) return;

    if (!list || list.length === 0) {
      legendEl.innerHTML = '<div style="font-size:12px;color:var(--ink-500);text-align:center;padding:12px;">尚無持倉資料</div>';
      return;
    }

    legendEl.innerHTML = list.map((item, idx) => {
      const pct = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(1) : '0.0';
      const valStr = `$${item.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      return `
        <div class="legend-item" data-index="${idx}">
          <div class="legend-left">
            <span class="legend-color-dot" style="background-color: ${item.color};"></span>
            <span class="legend-name">${item.fullName || item.name}</span>
          </div>
          <div class="legend-right">
            <span class="legend-val">${valStr}</span>
            <span class="legend-pct">${pct}%</span>
          </div>
        </div>
      `;
    }).join('');
  }
};

window.PortfolioChart = PortfolioChart;
