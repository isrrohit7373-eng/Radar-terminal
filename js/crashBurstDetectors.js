/**
 * js/crashBurstDetectors.js (v3)
 * Dedicated Individual-Timeframe (1m, 3m, 5m, 15m) Sub-Panel Engine:
 * 1. CRASH DETECTOR (Long Liquidation, Bearish RSI & Bearish Vol-Price Divergence) — 4 sub-panels
 * 2. VOLUME BURST DETECTOR (Short Liquidation / Squeeze, Bullish RSI & Bullish Vol-Price Divergence) — 4 sub-panels
 *
 * Per-Panel Visual Sub-Charts (8 panels x 3 canvases = 24 synced canvases):
 *  - Composite Crash / Volume Burst Score Canvas (with Vol Z-Score spikes & Liq/Squeeze markers)
 *  - Individual RSI (14) + RSI MA (14) + Bearish/Bullish Divergence Overlay Sub-Chart
 *  - Individual MACD (12, 26, 9) + Signal + Histogram Sub-Chart
 *
 * Full Indicator Suite per individual timeframe:
 * - RSI (14) & RSI MA (14), MACD (12,26,9), RSI & Volume-Price Divergences
 * - OBI Pressure, Volume Spikes & Volume Z-Score, Fibonacci Levels/Targets
 * - Liquidation Tracking (Long Liq for Crash / Short Squeeze for Burst)
 * - 20 / 50 / 200 EMA, ATR & ATR%, OBV, Bollinger Bands (20,2)
 * - ADX (14) +DI/-DI, Standard Deviation (20), Historical Volatility (HV%), Boolean Triggers
 */
window.CrashBurstDetectors = (function () {
  const DETECTOR_TFS = ['1m', '3m', '5m', '15m'];
  const ANNUAL_BARS = { '1m': 525600, '3m': 175200, '5m': 105120, '15m': 35040 };

  const state3m = {
    candles: [],
    lastFetchMs: 0,
    fetching: false
  };

  function fmtPrice(p) {
    if (!Number.isFinite(p)) return '--';
    return '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fmtCompact(n) {
    if (!Number.isFinite(n)) return '--';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'K';
    return sign + abs.toFixed(1);
  }

  // Synthesize 3m candles from 1m candles (instant fallback & Simulation mode)
  function aggregate1mTo3m(candles1m) {
    if (!candles1m || !candles1m.length) return [];
    const out = [];
    const bucketMs = 3 * 60 * 1000;
    let cur = null;
    for (let i = 0; i < candles1m.length; i++) {
      const c = candles1m[i];
      const t = c.time || (i * 60000);
      const bKey = Math.floor(t / bucketMs) * bucketMs;
      if (!cur || cur.time !== bKey) {
        if (cur) out.push(cur);
        cur = {
          time: bKey,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume || 0,
          buyVol: c.buyVol != null ? c.buyVol : (c.close >= c.open ? (c.volume || 0) * 0.6 : (c.volume || 0) * 0.4),
          sellVol: c.sellVol != null ? c.sellVol : (c.close >= c.open ? (c.volume || 0) * 0.4 : (c.volume || 0) * 0.6)
        };
      } else {
        if (c.high > cur.high) cur.high = c.high;
        if (c.low < cur.low) cur.low = c.low;
        cur.close = c.close;
        const v = c.volume || 0;
        cur.volume += v;
        cur.buyVol += c.buyVol != null ? c.buyVol : (c.close >= c.open ? v * 0.6 : v * 0.4);
        cur.sellVol += c.sellVol != null ? c.sellVol : (c.close >= c.open ? v * 0.4 : v * 0.6);
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  // Non-blocking Binance REST fetch for 3m klines when in LIVE mode
  async function ensure3mCandles(mode) {
    if (mode !== 'LIVE') return;
    const now = Date.now();
    if (state3m.fetching || (now - state3m.lastFetchMs < 4500 && state3m.candles.length >= 60)) return;
    state3m.fetching = true;
    try {
      const resp = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=3m&limit=210');
      if (resp.ok) {
        const raw = await resp.json();
        if (Array.isArray(raw) && raw.length) {
          state3m.candles = raw.map(k => {
            const vol = parseFloat(k[5]) || 0;
            const buyVol = parseFloat(k[9]) || vol * 0.5;
            const sellVol = Math.max(0, vol - buyVol);
            return {
              time: k[0],
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: vol,
              buyVol,
              sellVol
            };
          });
          state3m.lastFetchMs = Date.now();
        }
      }
    } catch (_) {
      // Fallback to 1m aggregation silently
    } finally {
      state3m.fetching = false;
    }
  }

  function getCandlesForTf(tf, candlesByTf, mode) {
    if (tf === '3m') {
      if (mode === 'LIVE' && state3m.candles.length >= 30) {
        return state3m.candles;
      }
      return aggregate1mTo3m((candlesByTf && candlesByTf['1m']) || []);
    }
    return (candlesByTf && candlesByTf[tf]) || [];
  }

  // ---- CORE MATH HELPERS ----
  function calcEMA(values, period) {
    const out = new Array(values.length).fill(null);
    if (!values.length) return out;
    const k = 2 / (period + 1);
    let ema = null;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      ema = ema === null ? v : v * k + ema * (1 - k);
      out[i] = ema;
    }
    return out;
  }

  function calcSMA(values, period) {
    const out = new Array(values.length).fill(null);
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) continue;
      let sum = 0, cnt = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (values[j] !== null && values[j] !== undefined && !Number.isNaN(values[j])) {
          sum += values[j];
          cnt++;
        }
      }
      if (cnt === period) out[i] = sum / period;
    }
    return out;
  }

  function calcRSIWithMA(candles, period = 14, maPeriod = 14) {
    if (window.Indicators && window.Indicators.computeRSI) {
      return window.Indicators.computeRSI(candles, period, maPeriod);
    }
    const n = candles.length;
    const rsi = new Array(n).fill(null);
    if (n <= period) return { rsi, rsiMA: new Array(n).fill(null), latestRsi: null, latestRsiMA: null };
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    let avgGain = gains / period;
    let avgLoss = losses / period;
    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    for (let i = period + 1; i < n; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
      rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
    const rsiMA = calcSMA(rsi, maPeriod);
    return { rsi, rsiMA, latestRsi: rsi[n - 1], latestRsiMA: rsiMA[n - 1] };
  }

  function calcMACD(candles, fast = 12, slow = 26, signalPeriod = 9) {
    if (window.Indicators && window.Indicators.computeMACD) {
      return window.Indicators.computeMACD(candles, fast, slow, signalPeriod);
    }
    const n = candles.length;
    if (!n) return { macd: [], signal: [], hist: [], latestMacd: 0, latestSignal: 0, latestHist: 0 };
    const closes = candles.map(c => c.close);
    const ef = calcEMA(closes, fast);
    const es = calcEMA(closes, slow);
    const macd = closes.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null));
    const signal = calcEMA(macd, signalPeriod);
    const hist = macd.map((m, i) => (m != null && signal[i] != null ? m - signal[i] : null));
    return {
      macd,
      signal,
      hist,
      latestMacd: macd[n - 1] || 0,
      latestSignal: signal[n - 1] || 0,
      latestHist: hist[n - 1] || 0
    };
  }

  function calcDivergences(candles, rsiSeries) {
    if (window.Indicators && window.Indicators.detectDivergences) {
      return window.Indicators.detectDivergences(candles, rsiSeries);
    }
    return { rsiDivs: [], volDivs: [] };
  }

  function calcATR(candles, period = 14) {
    const n = candles.length;
    const atr = new Array(n).fill(null);
    const atrPct = new Array(n).fill(null);
    if (!n) return { atr, atrPct };
    const tr = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      if (i === 0) tr[i] = c.high - c.low;
      else {
        const pc = candles[i - 1].close;
        tr[i] = Math.max(c.high - c.low, Math.abs(c.high - pc), Math.abs(c.low - pc));
      }
    }
    let smooth = tr[0];
    for (let i = 0; i < n; i++) {
      if (i < period) smooth = (smooth * i + tr[i]) / (i + 1);
      else smooth = (smooth * (period - 1) + tr[i]) / period;
      atr[i] = smooth;
      atrPct[i] = candles[i].close > 0 ? (smooth / candles[i].close) * 100 : 0;
    }
    return { atr, atrPct };
  }

  function calcADX(candles, period = 14) {
    const n = candles.length;
    const adx = new Array(n).fill(0);
    const plusDI = new Array(n).fill(0);
    const minusDI = new Array(n).fill(0);
    if (n < 3) return { adx, plusDI, minusDI };

    let smTR = candles[0].high - candles[0].low;
    let smPDM = 0, smMDM = 0, smADX = 0;

    for (let i = 1; i < n; i++) {
      const c = candles[i], p = candles[i - 1];
      const upMove = c.high - p.high;
      const downMove = p.low - c.low;
      const pdm = (upMove > downMove && upMove > 0) ? upMove : 0;
      const mdm = (downMove > upMove && downMove > 0) ? downMove : 0;
      const tr = Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close));

      if (i <= period) {
        smTR += tr; smPDM += pdm; smMDM += mdm;
      } else {
        smTR = smTR - smTR / period + tr;
        smPDM = smPDM - smPDM / period + pdm;
        smMDM = smMDM - smMDM / period + mdm;
      }

      const pdi = smTR > 0 ? (100 * smPDM) / smTR : 0;
      const mdi = smTR > 0 ? (100 * smMDM) / smTR : 0;
      const dx = (pdi + mdi) > 0 ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0;
      smADX = i <= period ? ((smADX * (i - 1) + dx) / i) : ((smADX * (period - 1) + dx) / period);

      plusDI[i] = pdi;
      minusDI[i] = mdi;
      adx[i] = smADX;
    }
    return { adx, plusDI, minusDI };
  }

  function calcBollingerAndStd(closes, period = 20, mult = 2) {
    const n = closes.length;
    const mid = new Array(n).fill(null);
    const upper = new Array(n).fill(null);
    const lower = new Array(n).fill(null);
    const stdDev = new Array(n).fill(0);
    const pctB = new Array(n).fill(0.5);
    const bwPct = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - period + 1);
      const len = i - start + 1;
      let sum = 0;
      for (let j = start; j <= i; j++) sum += closes[j];
      const mean = sum / len;
      let vSum = 0;
      for (let j = start; j <= i; j++) {
        const d = closes[j] - mean;
        vSum += d * d;
      }
      const sd = Math.sqrt(vSum / len);
      const up = mean + mult * sd;
      const lo = mean - mult * sd;
      mid[i] = mean; upper[i] = up; lower[i] = lo;
      stdDev[i] = sd;
      pctB[i] = (up - lo) > 1e-9 ? (closes[i] - lo) / (up - lo) : 0.5;
      bwPct[i] = mean > 0 ? ((up - lo) / mean) * 100 : 0;
    }
    return { mid, upper, lower, stdDev, pctB, bwPct };
  }

  function calcOBV(candles) {
    const n = candles.length;
    const obv = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      if (candles[i].close > candles[i - 1].close) obv[i] = obv[i - 1] + (candles[i].volume || 0);
      else if (candles[i].close < candles[i - 1].close) obv[i] = obv[i - 1] - (candles[i].volume || 0);
      else obv[i] = obv[i - 1];
    }
    const obvEma = calcEMA(obv, 10);
    return { obv, obvEma };
  }

  function calcVolumeZScore(candles, period = 20) {
    const n = candles.length;
    const zScore = new Array(n).fill(0);
    const volRatio = new Array(n).fill(1);
    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - period + 1);
      const len = i - start + 1;
      let sum = 0;
      for (let j = start; j <= i; j++) sum += (candles[j].volume || 0);
      const mean = sum / len;
      let vSum = 0;
      for (let j = start; j <= i; j++) {
        const d = (candles[j].volume || 0) - mean;
        vSum += d * d;
      }
      const sd = Math.sqrt(vSum / len);
      const v = candles[i].volume || 0;
      zScore[i] = sd > 1e-9 ? (v - mean) / sd : 0;
      volRatio[i] = mean > 1e-9 ? v / mean : 1;
    }
    return { zScore, volRatio };
  }

  function calcHistoricalVolatility(closes, tf, period = 20) {
    const n = closes.length;
    const hv = new Array(n).fill(0);
    const returns = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      returns[i] = (closes[i - 1] > 0 && closes[i] > 0) ? Math.log(closes[i] / closes[i - 1]) : 0;
    }
    const annFactor = Math.sqrt(ANNUAL_BARS[tf] || 525600);
    for (let i = 1; i < n; i++) {
      const start = Math.max(1, i - period + 1);
      const len = i - start + 1;
      let sum = 0;
      for (let j = start; j <= i; j++) sum += returns[j];
      const mean = sum / len;
      let vSum = 0;
      for (let j = start; j <= i; j++) {
        const d = returns[j] - mean;
        vSum += d * d;
      }
      const sd = Math.sqrt(vSum / len);
      hv[i] = sd * annFactor * 100;
    }
    return hv;
  }

  function calcCandleOBI(candles, liveObi) {
    const n = candles.length;
    const obi = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const vol = c.volume || 0;
      if (c.buyVol != null && c.sellVol != null && vol > 0) {
        obi[i] = ((c.buyVol - c.sellVol) / vol) * 100;
      } else {
        const rng = Math.max(1e-6, c.high - c.low);
        obi[i] = ((c.close - c.open) / rng) * 100;
      }
    }
    if (n > 0 && Number.isFinite(liveObi)) {
      obi[n - 1] = obi[n - 1] * 0.65 + liveObi * 0.35;
    }
    return obi;
  }

  function calcFibLevels(candles, lookback = 40) {
    const slice = candles.slice(-lookback);
    let hi = -Infinity, lo = Infinity;
    slice.forEach(c => {
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    });
    const rng = Math.max(1e-6, hi - lo);
    return {
      swingHigh: hi,
      swingLow: lo,
      crash618: hi - rng * 0.618,
      crash786: hi - rng * 0.786,
      crashExt127: lo - rng * 0.272,
      burst618: lo + rng * 0.618,
      burstExt127: hi + rng * 0.272,
      burstExt161: hi + rng * 0.618
    };
  }

  // ---- MAIN INDIVIDUAL-TIMEFRAME ANALYSIS ----
  function analyzeTimeframe(tf, candles, liveObi) {
    const n = candles.length;
    if (n < 10) return null;

    const closes = candles.map(c => c.close);
    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    const ema200 = calcEMA(closes, 200);
    const rsiData = calcRSIWithMA(candles, 14, 14);
    const rsi = rsiData.rsi;
    const macdData = calcMACD(candles, 12, 26, 9);
    const divergences = calcDivergences(candles, rsi);
    const { atr, atrPct } = calcATR(candles, 14);
    const { adx, plusDI, minusDI } = calcADX(candles, 14);
    const bb = calcBollingerAndStd(closes, 20, 2);
    const { obv, obvEma } = calcOBV(candles);
    const { zScore: volZ, volRatio } = calcVolumeZScore(candles, 20);
    const hv = calcHistoricalVolatility(closes, tf, 20);
    const obiSeries = calcCandleOBI(candles, liveObi);
    const fib = calcFibLevels(candles, 40);

    // Filter divergences by direction for Crash (BEAR) & Volume Burst (BULL)
    const bearRsiDivs = (divergences.rsiDivs || []).filter(d => d.type === 'BEAR');
    const bearVolDivs = (divergences.volDivs || []).filter(d => d.type === 'BEAR');
    const bullRsiDivs = (divergences.rsiDivs || []).filter(d => d.type === 'BULL');
    const bullVolDivs = (divergences.volDivs || []).filter(d => d.type === 'BULL');

    const last = n - 1;
    const recentWindow = 25;
    const hasBearRsiDiv = bearRsiDivs.some(d => d.idx2 >= last - recentWindow);
    const hasBearVolDiv = bearVolDivs.some(d => d.idx2 >= last - recentWindow);
    const hasBullRsiDiv = bullRsiDivs.some(d => d.idx2 >= last - recentWindow);
    const hasBullVolDiv = bullVolDivs.some(d => d.idx2 >= last - recentWindow);

    const crashScoreSeries = new Array(n).fill(0);
    const burstScoreSeries = new Array(n).fill(0);
    const longLiqSeries = new Array(n).fill(0);
    const shortLiqSeries = new Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      const c = candles[i];
      const r = rsi[i] != null ? rsi[i] : 50;
      const rPrev = i >= 3 && rsi[i - 3] != null ? rsi[i - 3] : r;
      const rSlope = r - rPrev;
      const vz = volZ[i];
      const o = obiSeries[i];
      const a = atr[i] || 1;
      const ap = atrPct[i] || 0;
      const prevAp = i >= 5 ? (atrPct[i - 5] || ap) : ap;
      const atrExpanding = ap > prevAp * 1.15;
      const pb = bb.pctB[i];
      const adxV = adx[i];
      const pdi = plusDI[i];
      const mdi = minusDI[i];
      const mHist = macdData.hist[i] != null ? macdData.hist[i] : 0;
      const body = c.close - c.open;
      const bodyRatio = Math.abs(body) / Math.max(1e-6, a);
      const belowEma20 = c.close < ema20[i];
      const belowEma50 = c.close < ema50[i];
      const belowEma200 = c.close < ema200[i];
      const obvFalling = obv[i] < obvEma[i];
      const obvRising = obv[i] > obvEma[i];

      let prevLow = Infinity, prevHigh = -Infinity;
      for (let j = Math.max(0, i - 12); j < i; j++) {
        if (candles[j].low < prevLow) prevLow = candles[j].low;
        if (candles[j].high > prevHigh) prevHigh = candles[j].high;
      }

      // ---- LONG LIQUIDATION INTENSITY (0-100) ----
      let lLiq = 0;
      if (body < 0) lLiq += Math.min(28, bodyRatio * 14);
      if (c.low < prevLow && body < 0) lLiq += 20;
      if (vz >= 1.5 && body < 0) lLiq += Math.min(22, vz * 7.5);
      if (o < -15) lLiq += Math.min(18, Math.abs(o) * 0.35);
      if (pb < 0.05) lLiq += 12;
      lLiq = Math.max(0, Math.min(100, lLiq));
      longLiqSeries[i] = lLiq;

      // ---- SHORT LIQUIDATION / SQUEEZE INTENSITY (0-100) ----
      let sLiq = 0;
      if (body > 0) sLiq += Math.min(28, bodyRatio * 14);
      if (c.high > prevHigh && body > 0) sLiq += 20;
      if (vz >= 1.5 && body > 0) sLiq += Math.min(22, vz * 7.5);
      if (o > 15) sLiq += Math.min(18, o * 0.35);
      if (pb > 0.95) sLiq += 12;
      sLiq = Math.max(0, Math.min(100, sLiq));
      shortLiqSeries[i] = sLiq;

      // ---- COMPOSITE CRASH RISK SCORE (0-100) ----
      let cScore = 0;
      if (r < 45) cScore += Math.min(15, (45 - r) * 0.62);
      if (rSlope < -4) cScore += Math.min(11, Math.abs(rSlope) * 0.85);
      if (o < 0) cScore += Math.min(13, Math.abs(o) * 0.26);
      if (vz > 0.8 && body <= 0) cScore += Math.min(15, vz * 5.0);
      if (pb < 0.2) cScore += Math.min(11, (0.2 - pb) * 26);
      if (belowEma20) cScore += 5;
      if (belowEma50) cScore += 4;
      if (belowEma200) cScore += 4;
      if (adxV > 22 && mdi > pdi) cScore += Math.min(9, (adxV - 18) * 0.42);
      if (atrExpanding && body < 0) cScore += 6;
      if (obvFalling) cScore += 5;
      if (mHist < 0) cScore += 5;
      // Add Bearish Divergence boost on bars near active bearish divergences
      if (bearRsiDivs.some(d => i >= d.idx2 && i <= d.idx2 + 12)) cScore += 10;
      if (bearVolDivs.some(d => i >= d.idx2 && i <= d.idx2 + 12)) cScore += 8;

      cScore = Math.max(0, Math.min(100, cScore * 0.70 + lLiq * 0.34));
      crashScoreSeries[i] = cScore;

      // ---- COMPOSITE VOLUME BURST & PUMP SCORE (0-100) ----
      let bScore = 0;
      if (r > 55) bScore += Math.min(15, (r - 55) * 0.62);
      if (rSlope > 4) bScore += Math.min(11, rSlope * 0.85);
      if (o > 0) bScore += Math.min(13, o * 0.26);
      if (vz > 0.8 && body >= 0) bScore += Math.min(16, vz * 5.4);
      if (pb > 0.8) bScore += Math.min(11, (pb - 0.8) * 26);
      if (!belowEma20) bScore += 5;
      if (!belowEma50) bScore += 4;
      if (!belowEma200) bScore += 4;
      if (adxV > 22 && pdi > mdi) bScore += Math.min(9, (adxV - 18) * 0.42);
      if (atrExpanding && body > 0) bScore += 6;
      if (obvRising) bScore += 5;
      if (mHist > 0) bScore += 5;
      // Add Bullish Divergence boost on bars near active bullish divergences
      if (bullRsiDivs.some(d => i >= d.idx2 && i <= d.idx2 + 12)) bScore += 10;
      if (bullVolDivs.some(d => i >= d.idx2 && i <= d.idx2 + 12)) bScore += 8;

      bScore = Math.max(0, Math.min(100, bScore * 0.70 + sLiq * 0.34));
      burstScoreSeries[i] = bScore;
    }

    const prev = Math.max(0, last - 1);
    const cNow = candles[last];
    const lastRsi = rsi[last] != null ? rsi[last] : 50;
    const prevRsi3 = last >= 3 && rsi[last - 3] != null ? rsi[last - 3] : lastRsi;

    const crashNow = crashScoreSeries[last];
    const crashDelta = crashNow - crashScoreSeries[prev];
    const burstNow = burstScoreSeries[last];
    const burstDelta = burstNow - burstScoreSeries[prev];

    // Boolean condition flags for Crash Detector (includes Bearish RSI Div, Bearish Vol Div & MACD↓)
    const crashBools = [
      { label: 'BEAR RSI DIV', active: hasBearRsiDiv },
      { label: 'BEAR VOL DIV', active: hasBearVolDiv },
      { label: 'MACD↓', active: (macdData.latestHist || 0) < 0 },
      { label: 'LONG LIQ', active: longLiqSeries[last] >= 45 },
      { label: 'VOL Z≥2', active: volZ[last] >= 2.0 && cNow.close <= cNow.open },
      { label: 'BB BRK↓', active: bb.pctB[last] <= 0.1 },
      { label: 'RSI DROP', active: lastRsi < 38 || (lastRsi - prevRsi3) < -6 },
      { label: 'OBI<0', active: obiSeries[last] < -10 },
      { label: 'EMA↓', active: cNow.close < ema20[last] && cNow.close < ema50[last] },
      { label: 'ADX -DI', active: adx[last] >= 22 && minusDI[last] > plusDI[last] },
      { label: 'OBV↓', active: obv[last] < obvEma[last] }
    ];

    // Boolean condition flags for Volume Burst Detector (includes Bullish RSI Div, Bullish Vol Div & MACD↑)
    const burstBools = [
      { label: 'BULL RSI DIV', active: hasBullRsiDiv },
      { label: 'BULL VOL DIV', active: hasBullVolDiv },
      { label: 'MACD↑', active: (macdData.latestHist || 0) > 0 },
      { label: 'SHORT SQZ', active: shortLiqSeries[last] >= 45 },
      { label: 'VOL Z≥2', active: volZ[last] >= 2.0 && cNow.close >= cNow.open },
      { label: 'BB BRK↑', active: bb.pctB[last] >= 0.9 },
      { label: 'RSI SURGE', active: lastRsi > 62 || (lastRsi - prevRsi3) > 6 },
      { label: 'OBI>0', active: obiSeries[last] > 10 },
      { label: 'EMA↑', active: cNow.close > ema20[last] && cNow.close > ema50[last] },
      { label: 'ADX +DI', active: adx[last] >= 22 && plusDI[last] > minusDI[last] },
      { label: 'OBV↑', active: obv[last] > obvEma[last] }
    ];

    return {
      tf,
      candles,
      crashScoreSeries,
      burstScoreSeries,
      longLiqSeries,
      shortLiqSeries,
      volZ,
      rsiData,
      macdData,
      divergences: {
        bearRsiDivs,
        bearVolDivs,
        bullRsiDivs,
        bullVolDivs,
        hasBearRsiDiv,
        hasBearVolDiv,
        hasBullRsiDiv,
        hasBullVolDiv
      },
      latest: {
        close: cNow.close,
        crashScore: crashNow,
        crashDelta,
        burstScore: burstNow,
        burstDelta,
        longLiq: longLiqSeries[last],
        shortLiq: shortLiqSeries[last],
        rsi: lastRsi,
        rsiMA: rsiData.latestRsiMA,
        macd: macdData.latestMacd || 0,
        macdSig: macdData.latestSignal || 0,
        macdHist: macdData.latestHist || 0,
        obi: obiSeries[last],
        volZ: volZ[last],
        volRatio: volRatio[last],
        ema20: ema20[last],
        ema50: ema50[last],
        ema200: ema200[last],
        atr: atr[last],
        atrPct: atrPct[last],
        adx: adx[last],
        plusDI: plusDI[last],
        minusDI: minusDI[last],
        bbPctB: bb.pctB[last],
        bbWidthPct: bb.bwPct[last],
        stdDev: bb.stdDev[last],
        hvPct: hv[last],
        obv: obv[last],
        obvRising: obv[last] >= obvEma[last],
        fib
      },
      crashBools,
      burstBools
    };
  }

  function classifyStatus(score, mode) {
    if (score >= 75) return { text: mode === 'crash' ? 'EXTREME CRASH' : 'EXTREME BURST', cls: mode === 'crash' ? 'crit-red' : 'crit-green' };
    if (score >= 55) return { text: mode === 'crash' ? 'CRASH ALERT' : 'BURST ALERT', cls: mode === 'crash' ? 'alert-red' : 'alert-green' };
    if (score >= 35) return { text: 'WATCH', cls: 'watch' };
    return { text: 'CALM', cls: 'calm' };
  }

  // ---- CANVAS 1: COMPOSITE CRASH / VOLUME BURST SCORE CANVAS ----
  function drawDetectorCanvas(canvas, analysis, mode) {
    if (!canvas || !analysis) return;
    const isCrash = mode === 'crash';
    const scoreSeries = isCrash ? analysis.crashScoreSeries : analysis.burstScoreSeries;
    const liqSeries = isCrash ? analysis.longLiqSeries : analysis.shortLiqSeries;
    const activeVolDivs = isCrash ? analysis.divergences.bearVolDivs : analysis.divergences.bullVolDivs;
    const activeRsiDivs = isCrash ? analysis.divergences.bearRsiDivs : analysis.divergences.bullRsiDivs;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(260, rect.width);
    const H = Math.max(105, rect.height || 116);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060a11';
    ctx.fillRect(0, 0, W, H);

    const padL = 8, padR = 46, padT = 10, padB = 12;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const visCount = Math.min(60, scoreSeries.length);
    const start = scoreSeries.length - visCount;
    const sVis = scoreSeries.slice(start);
    const lVis = liqSeries.slice(start);
    const zVis = analysis.volZ.slice(start);

    const stepX = plotW / Math.max(1, visCount);
    const xOf = i => padL + (i + 0.5) * stepX;
    const xOfGlobal = gIdx => padL + (gIdx - start + 0.5) * stepX;
    const yOf = val => padT + ((100 - Math.max(0, Math.min(100, val))) / 100) * plotH;

    // Alert threshold band
    ctx.fillStyle = isCrash ? 'rgba(255, 71, 87, 0.06)' : 'rgba(0, 230, 118, 0.06)';
    ctx.fillRect(padL, yOf(100), plotW, yOf(55) - yOf(100));

    ctx.font = '9px monospace';
    [75, 55, 35].forEach(lvl => {
      const y = yOf(lvl);
      ctx.strokeStyle = lvl === 75
        ? (isCrash ? 'rgba(255, 71, 87, 0.55)' : 'rgba(0, 230, 118, 0.55)')
        : 'rgba(127, 148, 176, 0.25)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#7f94b0';
      ctx.fillText(String(lvl), W - padR + 5, y + 3);
    });

    // Volume Z-Score Spike Bars
    const barW = Math.max(2, Math.min(7, stepX * 0.55));
    zVis.forEach((z, i) => {
      if (z <= 0.5) return;
      const hNorm = Math.min(100, z * 22);
      const x = xOf(i);
      const y = yOf(hNorm);
      const isSpike = z >= 2.0;
      ctx.fillStyle = isSpike
        ? (isCrash ? 'rgba(255, 107, 129, 0.45)' : 'rgba(34, 211, 238, 0.45)')
        : 'rgba(127, 148, 176, 0.16)';
      ctx.fillRect(x - barW / 2, y, barW, yOf(0) - y);
    });

    // Main Composite Score Area + Line
    const mainColor = isCrash ? '#ff4757' : '#00e676';
    const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, isCrash ? 'rgba(255, 71, 87, 0.36)' : 'rgba(0, 230, 118, 0.36)');
    grad.addColorStop(1, isCrash ? 'rgba(255, 71, 87, 0.02)' : 'rgba(0, 230, 118, 0.02)');

    ctx.save();
    ctx.beginPath();
    sVis.forEach((sv, i) => {
      const x = xOf(i), y = yOf(sv);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(xOf(sVis.length - 1), yOf(0));
    ctx.lineTo(xOf(0), yOf(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    sVis.forEach((sv, i) => {
      const x = xOf(i), y = yOf(sv);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = mainColor;
    ctx.lineWidth = 1.9;
    ctx.stroke();
    ctx.restore();

    // Liquidation / Short Squeeze Markers
    lVis.forEach((lv, i) => {
      if (lv >= 50) {
        const x = xOf(i), y = yOf(sVis[i]);
        ctx.fillStyle = isCrash ? '#ffbe0b' : '#22d3ee';
        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Mark active directional divergences (Bearish in Crash, Bullish in Burst)
    const drawDivMarker = (divs, tag, col) => {
      divs.forEach(d => {
        if (d.idx2 < start) return;
        const x = Math.min(W - padR - 6, Math.max(padL + 4, xOfGlobal(d.idx2)));
        ctx.save();
        ctx.strokeStyle = col;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = col;
        ctx.font = 'bold 8px monospace';
        ctx.fillText(tag, Math.max(padL + 2, x - 14), padT + 8);
        ctx.restore();
      });
    };
    drawDivMarker(activeRsiDivs, isCrash ? 'B-RSI' : 'L-RSI', isCrash ? '#ff4757' : '#00e676');
    drawDivMarker(activeVolDivs, isCrash ? 'B-VOL' : 'L-VOL', isCrash ? '#f59e0b' : '#22d3ee');

    // Live right-edge score pill
    const latestVal = sVis[sVis.length - 1] || 0;
    const ly = yOf(latestVal);
    ctx.fillStyle = mainColor;
    ctx.fillRect(W - padR + 2, ly - 7, 40, 14);
    ctx.fillStyle = '#060a11';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(latestVal.toFixed(0) + '%', W - padR + 6, ly + 3);
  }

  // ---- CANVAS 2: INDIVIDUAL RSI (14) + RSI MA (14) + DIRECTIONAL DIVERGENCE SUB-CHART ----
  function drawMiniRsiCanvas(canvas, analysis, mode) {
    if (!canvas || !analysis || !analysis.rsiData) return;
    const isCrash = mode === 'crash';
    const rsiSeries = analysis.rsiData.rsi;
    const maSeries = analysis.rsiData.rsiMA;
    const dirRsiDivs = isCrash ? analysis.divergences.bearRsiDivs : analysis.divergences.bullRsiDivs;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(260, rect.width);
    const H = Math.max(76, rect.height || 86);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060a11';
    ctx.fillRect(0, 0, W, H);

    const padL = 8, padR = 46, padT = 8, padB = 8;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const visCount = Math.min(60, rsiSeries.length);
    const start = rsiSeries.length - visCount;
    const rVis = rsiSeries.slice(start);
    const mVis = maSeries.slice(start);

    const stepX = plotW / Math.max(1, visCount);
    const xOf = i => padL + (i + 0.5) * stepX;
    const xOfGlobal = gIdx => padL + (gIdx - start + 0.5) * stepX;
    const yOf = val => padT + ((100 - Math.max(0, Math.min(100, val))) / 100) * plotH;

    // 30-70 band
    ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
    ctx.fillRect(padL, yOf(70), plotW, yOf(30) - yOf(70));

    ctx.font = '8.5px monospace';
    [70, 50, 30].forEach(lvl => {
      const y = yOf(lvl);
      ctx.strokeStyle = lvl === 50 ? 'rgba(127, 148, 176, 0.22)' : 'rgba(127, 148, 176, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lvl === 70 ? '#ff6b81' : lvl === 30 ? '#2ed573' : '#7f94b0';
      ctx.fillText(String(lvl), W - padR + 5, y + 3);
    });

    // RSI MA (14)
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    let started = false;
    mVis.forEach((v, i) => {
      if (v == null) return;
      const x = xOf(i), y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // RSI (14)
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.65;
    ctx.beginPath();
    started = false;
    rVis.forEach((v, i) => {
      if (v == null) return;
      const x = xOf(i), y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Plot directional RSI Divergence lines (Bearish red for Crash, Bullish green for Burst)
    const divCol = isCrash ? '#ff4757' : '#00e676';
    dirRsiDivs.forEach(d => {
      if (d.idx2 < start || d.ind1 == null || d.ind2 == null) return;
      const x1 = Math.max(padL + 3, xOfGlobal(d.idx1));
      const x2 = Math.min(W - padR - 4, xOfGlobal(d.idx2));
      const y1 = yOf(d.ind1);
      const y2 = yOf(d.ind2);
      ctx.save();
      ctx.strokeStyle = divCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.fillStyle = divCol;
      ctx.beginPath();
      ctx.arc(x2, y2, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Latest RSI tag
    const latestRsi = analysis.rsiData.latestRsi;
    if (latestRsi != null) {
      const yNow = yOf(latestRsi);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(W - padR + 2, yNow - 7, 40, 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(latestRsi.toFixed(1), W - padR + 6, yNow + 3);
    }
  }

  // ---- CANVAS 3: INDIVIDUAL MACD (12, 26, 9) + SIGNAL + HISTOGRAM SUB-CHART ----
  function drawMiniMacdCanvas(canvas, analysis) {
    if (!canvas || !analysis || !analysis.macdData) return;
    const { macd, signal, hist } = analysis.macdData;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(260, rect.width);
    const H = Math.max(76, rect.height || 86);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060a11';
    ctx.fillRect(0, 0, W, H);

    const padL = 8, padR = 46, padT = 8, padB = 8;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const visCount = Math.min(60, macd.length);
    const start = macd.length - visCount;
    const mVis = macd.slice(start);
    const sVis = signal.slice(start);
    const hVis = hist.slice(start);

    let maxAbs = 1;
    for (let i = 0; i < mVis.length; i++) {
      if (mVis[i] != null && Math.abs(mVis[i]) > maxAbs) maxAbs = Math.abs(mVis[i]);
      if (sVis[i] != null && Math.abs(sVis[i]) > maxAbs) maxAbs = Math.abs(sVis[i]);
      if (hVis[i] != null && Math.abs(hVis[i]) > maxAbs) maxAbs = Math.abs(hVis[i]);
    }
    maxAbs *= 1.15;

    const stepX = plotW / Math.max(1, visCount);
    const xOf = i => padL + (i + 0.5) * stepX;
    const yOf = val => padT + ((maxAbs - val) / (2 * maxAbs)) * plotH;
    const yZero = yOf(0);

    // Zero line
    ctx.strokeStyle = 'rgba(127, 148, 176, 0.38)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, yZero);
    ctx.lineTo(W - padR, yZero);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7f94b0';
    ctx.font = '8.5px monospace';
    ctx.fillText('0.0', W - padR + 6, yZero + 3);

    // Histogram bars
    const barW = Math.max(2, Math.min(7, stepX * 0.58));
    hVis.forEach((v, i) => {
      if (v == null) return;
      const x = xOf(i), y = yOf(v);
      ctx.fillStyle = v >= 0 ? 'rgba(0, 230, 118, 0.52)' : 'rgba(255, 71, 87, 0.52)';
      ctx.fillRect(x - barW / 2, Math.min(y, yZero), barW, Math.max(1, Math.abs(y - yZero)));
    });

    // MACD Line (Cyan)
    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    mVis.forEach((v, i) => {
      if (v == null) return;
      const x = xOf(i), y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    // Signal Line (Amber)
    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    started = false;
    sVis.forEach((v, i) => {
      if (v == null) return;
      const x = xOf(i), y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  function renderTelemetryHTML(analysis, mode) {
    const isCrash = mode === 'crash';
    const L = analysis.latest;
    const bools = isCrash ? analysis.crashBools : analysis.burstBools;

    const emaTrend = L.close > L.ema20 && L.ema20 > L.ema50 ? 'BULL' : (L.close < L.ema20 && L.ema20 < L.ema50 ? 'BEAR' : 'MIX');
    const emaCls = emaTrend === 'BULL' ? 'txt-green' : (emaTrend === 'BEAR' ? 'txt-red' : 'txt-amber');
    const obiCls = L.obi >= 0 ? 'txt-green' : 'txt-red';
    const zCls = L.volZ >= 2 ? (isCrash ? 'txt-red' : 'txt-green') : 'txt-cyan';
    const liqVal = isCrash ? L.longLiq : L.shortLiq;
    const liqLabel = isCrash ? 'LONG LIQ' : 'SHORT SQZ';
    const fibTarget = isCrash ? L.fib.crash786 : L.fib.burstExt127;
    const fibLabel = isCrash ? 'FIB .786↓' : 'FIB 1.27↑';

    const chipsHtml = bools.map(b => {
      const activeCls = b.active ? (isCrash ? 'on-red' : 'on-green') : '';
      return `<span class="bool-chip ${activeCls}">${b.label}</span>`;
    }).join('');

    return `
      <div class="det-metrics-grid">
        <span>RSI: <b>${L.rsi.toFixed(1)}</b></span>
        <span>OBI: <b class="${obiCls}">${L.obi >= 0 ? '+' : ''}${L.obi.toFixed(1)}%</b></span>
        <span>VOL Z: <b class="${zCls}">${L.volZ >= 0 ? '+' : ''}${L.volZ.toFixed(2)}σ</b></span>
        <span>${liqLabel}: <b class="${liqVal >= 45 ? (isCrash ? 'txt-red' : 'txt-green') : ''}">${liqVal.toFixed(0)}%</b></span>
        <span>ATR: <b>${L.atr.toFixed(1)} (${L.atrPct.toFixed(2)}%)</b></span>
        <span>ADX: <b>${L.adx.toFixed(1)}</b> (+${L.plusDI.toFixed(0)}/-${L.minusDI.toFixed(0)})</span>
        <span>EMA20/50/200: <b class="${emaCls}">${emaTrend}</b> (${L.ema20.toFixed(0)}/${L.ema50.toFixed(0)}/${L.ema200.toFixed(0)})</span>
        <span>BB %B/BW: <b>${(L.bbPctB * 100).toFixed(0)}% / ${L.bbWidthPct.toFixed(2)}%</b></span>
        <span>OBV: <b class="${L.obvRising ? 'txt-green' : 'txt-red'}">${fmtCompact(L.obv)} ${L.obvRising ? '▲' : '▼'}</b></span>
        <span>STD σ: <b>$${L.stdDev.toFixed(1)}</b></span>
        <span>HV: <b>${L.hvPct.toFixed(1)}%</b></span>
        <span>${fibLabel}: <b class="txt-cyan">${fmtPrice(fibTarget)}</b></span>
      </div>
      <div class="det-bool-row">${chipsHtml}</div>
    `;
  }

  function renderGroup(groupEl, prefix, mode, analysesMap) {
    if (!groupEl) return;
    const isCrash = mode === 'crash';
    DETECTOR_TFS.forEach(tf => {
      const a = analysesMap[tf];
      const badgeEl = document.getElementById(`${prefix}Badge_${tf}`);
      const scoreEl = document.getElementById(`${prefix}Score_${tf}`);
      const canvasEl = document.getElementById(`${prefix}Canvas_${tf}`);
      const rsiReadoutEl = document.getElementById(`${prefix}RsiReadout_${tf}`);
      const rsiCanvasEl = document.getElementById(`${prefix}RsiCanvas_${tf}`);
      const macdReadoutEl = document.getElementById(`${prefix}MacdReadout_${tf}`);
      const macdCanvasEl = document.getElementById(`${prefix}MacdCanvas_${tf}`);
      const teleEl = document.getElementById(`${prefix}Tele_${tf}`);

      if (!a) {
        if (scoreEl) scoreEl.textContent = 'LOADING...';
        return;
      }

      const score = isCrash ? a.latest.crashScore : a.latest.burstScore;
      const delta = isCrash ? a.latest.crashDelta : a.latest.burstDelta;
      const status = classifyStatus(score, mode);
      const dirSym = delta >= 0.3 ? '▲ RISING' : (delta <= -0.3 ? '▼ FALLING' : '● STEADY');
      const dirCls = delta >= 0.3 ? (isCrash ? 'txt-red' : 'txt-green') : 'txt-gray';

      if (badgeEl) {
        badgeEl.className = `det-status-badge ${status.cls}`;
        badgeEl.textContent = status.text;
      }
      if (scoreEl) {
        scoreEl.innerHTML = `SCORE: <strong>${score.toFixed(0)}/100</strong> <span class="${dirCls}">${dirSym}</span>`;
      }

      // 1. Main Detector Canvas
      drawDetectorCanvas(canvasEl, a, mode);

      // 2. Individual RSI + MA + Directional Divergence Sub-Chart
      if (rsiReadoutEl) {
        const rTxt = a.latest.rsi != null ? a.latest.rsi.toFixed(1) : '--';
        const maTxt = a.latest.rsiMA != null ? a.latest.rsiMA.toFixed(1) : '--';
        const divTags = [];
        if (isCrash) {
          if (a.divergences.hasBearRsiDiv) divTags.push('<span class="det-div-pill bear">⚡ BEAR RSI DIV</span>');
          if (a.divergences.hasBearVolDiv) divTags.push('<span class="det-div-pill bear">⚡ BEAR VOL DIV</span>');
        } else {
          if (a.divergences.hasBullRsiDiv) divTags.push('<span class="det-div-pill bull">⚡ BULL RSI DIV</span>');
          if (a.divergences.hasBullVolDiv) divTags.push('<span class="det-div-pill bull">⚡ BULL VOL DIV</span>');
        }
        rsiReadoutEl.innerHTML = `RSI: <b>${rTxt}</b> | MA: <b>${maTxt}</b> ${divTags.join(' ')}`;
      }
      drawMiniRsiCanvas(rsiCanvasEl, a, mode);

      // 3. Individual MACD (12, 26, 9) Sub-Chart
      if (macdReadoutEl) {
        const h = a.latest.macdHist;
        const hCls = h >= 0 ? 'txt-green' : 'txt-red';
        macdReadoutEl.innerHTML = `MACD: <b>${a.latest.macd.toFixed(1)}</b> | SIG: <b>${a.latest.macdSig.toFixed(1)}</b> | HIST: <b class="${hCls}">${h >= 0 ? '+' : ''}${h.toFixed(1)}</b>`;
      }
      drawMiniMacdCanvas(macdCanvasEl, a);

      // 4. Telemetry + Boolean Trigger Chips
      if (teleEl) {
        teleEl.innerHTML = renderTelemetryHTML(a, mode);
      }
    });
  }

  function updateAndRender({ candlesByTf, liveObi, mode, showCrash, showBurst }) {
    const crashGroup = document.getElementById('crashDetectorGroup');
    const burstGroup = document.getElementById('volumeBurstGroup');
    if (crashGroup) crashGroup.style.display = showCrash ? 'block' : 'none';
    if (burstGroup) burstGroup.style.display = showBurst ? 'block' : 'none';
    if (!showCrash && !showBurst) return;

    ensure3mCandles(mode);

    const analyses = {};
    DETECTOR_TFS.forEach(tf => {
      const candles = getCandlesForTf(tf, candlesByTf, mode);
      analyses[tf] = analyzeTimeframe(tf, candles, liveObi);
    });

    if (showCrash) renderGroup(crashGroup, 'crash', 'crash', analyses);
    if (showBurst) renderGroup(burstGroup, 'burst', 'burst', analyses);
  }

  return {
    DETECTOR_TFS,
    updateAndRender
  };
})();
