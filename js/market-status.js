/**
 * ============================================================================
 * ZenHold - 美股開休市與市場狀態判定引擎 (Market Status Engine)
 * ============================================================================
 * 支援美東時間 (US Eastern Time, ET) 自動計算（包含夏令/冬令日光節約時間）
 * 支援美股常規交易、盤前、盤後、週末休市與美國主要聯邦交易休假日判定
 * 提供加密貨幣 24/7 全年無休提醒
 */

const US_HOLIDAYS_CALENDAR = {
  // 2025 年美股休市日
  '2025-01-01': '元旦 (New Year\'s Day)',
  '2025-01-20': '馬丁路德·金恩紀念日 (MLK Jr. Day)',
  '2025-02-17': '華盛頓誕辰/總統日 (Presidents\' Day)',
  '2025-04-18': '耶穌受難日 (Good Friday)',
  '2025-05-26': '陣亡將士紀念日 (Memorial Day)',
  '2025-06-19': '六月節國家獨立日 (Juneteenth)',
  '2025-07-04': '獨立紀念日 (Independence Day)',
  '2025-09-01': '勞工節 (Labor Day)',
  '2025-11-27': '感恩節 (Thanksgiving Day)',
  '2025-12-25': '聖誕節 (Christmas Day)',
  
  // 2026 年美股休市日
  '2026-01-01': '元旦 (New Year\'s Day)',
  '2026-01-19': '馬丁路德·金恩紀念日 (MLK Jr. Day)',
  '2026-02-16': '華盛頓誕辰/總統日 (Presidents\' Day)',
  '2026-04-03': '耶穌受難日 (Good Friday)',
  '2026-05-25': '陣亡將士紀念日 (Memorial Day)',
  '2026-06-19': '六月節國家獨立日 (Juneteenth)',
  '2026-07-03': '獨立紀念日補假 (Independence Day Observed)',
  '2026-09-07': '勞工節 (Labor Day)',
  '2026-11-26': '感恩節 (Thanksgiving Day)',
  '2026-12-25': '聖誕節 (Christmas Day)',

  // 2027 年美股休市日
  '2027-01-01': '元旦 (New Year\'s Day)',
  '2027-01-18': '馬丁路德·金恩紀念日 (MLK Jr. Day)',
  '2027-02-15': '華盛頓誕辰/總統日 (Presidents\' Day)',
  '2027-03-26': '耶穌受難日 (Good Friday)',
  '2027-05-31': '陣亡將士紀念日 (Memorial Day)',
  '2027-06-18': '六月節補假 (Juneteenth Observed)',
  '2027-07-05': '獨立紀念日補假 (Independence Day Observed)',
  '2027-09-06': '勞工節 (Labor Day)',
  '2027-11-25': '感恩節 (Thanksgiving Day)',
  '2027-12-24': '聖誕節補假 (Christmas Observed)'
};

const MarketStatus = {
  /**
   * 取得當前美東時間 (America/New_York) 的 Date 物件資訊
   */
  getEasternTime(now = new Date()) {
    const etString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const etDate = new Date(etString);
    
    const year = etDate.getFullYear();
    const month = String(etDate.getMonth() + 1).padStart(2, '0');
    const day = String(etDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    
    const hours = etDate.getHours();
    const minutes = etDate.getMinutes();
    const seconds = etDate.getSeconds();
    const dayOfWeek = etDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const totalMinutes = hours * 60 + minutes;

    return {
      dateObj: etDate,
      dateKey,
      year,
      month,
      day,
      hours,
      minutes,
      seconds,
      dayOfWeek,
      totalMinutes,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      formattedTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    };
  },

  /**
   * 計算目前美股市場的交易狀態
   * 常規開盤：美東時間 09:30 - 16:00 (570 - 960 分鐘)
   * 盤前交易：美東時間 04:00 - 09:30 (240 - 570 分鐘)
   * 盤後交易：美東時間 16:00 - 20:00 (960 - 1200 分鐘)
   */
  getUSMarketStatus(now = new Date()) {
    const et = this.getEasternTime(now);
    const holidayName = US_HOLIDAYS_CALENDAR[et.dateKey];

    // 1. 美國國定休假日
    if (holidayName) {
      return {
        status: 'HOLIDAY',
        className: 'status-holiday',
        label: '今日國定休市',
        description: `美股今日因【${holidayName}】全日休市`,
        etTimeStr: et.formattedTime,
        nextEvent: '下一個交易日 09:30 ET 開市',
        isTrading: false
      };
    }

    // 2. 週末休市 (週六或週日)
    if (et.isWeekend) {
      const dayText = et.dayOfWeek === 6 ? '週六' : '週日';
      return {
        status: 'WEEKEND',
        className: 'status-closed',
        label: '週末休市中',
        description: `美股週末休市 (${dayText})，下週一 09:30 ET 開市`,
        etTimeStr: et.formattedTime,
        nextEvent: '週一 09:30 ET 開市',
        isTrading: false
      };
    }

    // 3. 週間工作日各時段判定
    const { totalMinutes, hours, minutes } = et;

    // A. 盤前交易 (04:00 ~ 09:30)
    if (totalMinutes >= 240 && totalMinutes < 570) {
      const minsToOpen = 570 - totalMinutes;
      const h = Math.floor(minsToOpen / 60);
      const m = minsToOpen % 60;
      const countdown = h > 0 ? `${h} 小時 ${m} 分鐘` : `${m} 分鐘`;
      return {
        status: 'PRE_MARKET',
        className: 'status-pre',
        label: '盤前交易中 (Pre-market)',
        description: `距離美股正式開盤還有約 ${countdown}`,
        etTimeStr: et.formattedTime,
        nextEvent: `今日 09:30 ET 開盤 (約剩 ${countdown})`,
        isTrading: true
      };
    }

    // B. 常規開市時間 (09:30 ~ 16:00)
    if (totalMinutes >= 570 && totalMinutes < 960) {
      const minsToClose = 960 - totalMinutes;
      const h = Math.floor(minsToClose / 60);
      const m = minsToClose % 60;
      const countdown = h > 0 ? `${h} 小時 ${m} 分鐘` : `${m} 分鐘`;
      return {
        status: 'OPEN',
        className: 'status-open',
        label: '美股開市中 (Market Open)',
        description: `美股常規交易進行中，距離收盤約 ${countdown}`,
        etTimeStr: et.formattedTime,
        nextEvent: `今日 16:00 ET 收盤 (約剩 ${countdown})`,
        isTrading: true
      };
    }

    // C. 盤後交易 (16:00 ~ 20:00)
    if (totalMinutes >= 960 && totalMinutes < 1200) {
      const minsToEnd = 1200 - totalMinutes;
      const h = Math.floor(minsToEnd / 60);
      const m = minsToEnd % 60;
      return {
        status: 'AFTER_HOURS',
        className: 'status-post',
        label: '盤後交易中 (After-hours)',
        description: `美股已收盤，目前為盤後交易時段至 20:00 ET`,
        etTimeStr: et.formattedTime,
        nextEvent: '明日 04:00 ET 盤前開始',
        isTrading: true
      };
    }

    // D. 已休市 (00:00 ~ 04:00 或 20:00 ~ 24:00)
    let nextOpenText = '今日 04:00 ET 盤前';
    if (totalMinutes >= 1200) {
      nextOpenText = et.dayOfWeek === 5 ? '下週一 04:00 ET 盤前' : '明日 04:00 ET 盤前';
    }
    return {
      status: 'CLOSED',
      className: 'status-closed',
      label: '美股已休市 (Market Closed)',
      description: '美股非交易時段，價格暫停撮合',
      etTimeStr: et.formattedTime,
      nextEvent: `${nextOpenText} 開啟`,
      isTrading: false
    };
  }
};

window.MarketStatus = MarketStatus;
