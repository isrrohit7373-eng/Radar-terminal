/**
 * js/indicators.js
 * Computes VWAP, VPVR (Volume Profile), Support/Resistance Zones,
 * Swing Pivot Extraction, RSI + RSI Moving Average, MACD (12,26,9),
 * and RSI / Volume-Price Divergence Detection.
 */
window.Indicators = (function () {

  function computeVWAP(candles) {
    let cumPV = 0;
    let cumV = 0;
    const series = [];
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      const typical = (c.high + c.low + c.close) / 3;
      cumPV += typical * c.volume;
      cumV += c.volume;
      series.push(cumV > 0 ? +(cumPV / cumV).toFixed(2) : c.close);
    }
    return { series, latest: series[series.length - 1] || 0 };
  }

  function computeVPVR(candles, bins = 28) {
    if (!candles || !candles.length) return { buckets: [], maxVol: 1, poc: 0 };
    let minP = Infinity, maxP = -Infinity;
    candles.forEach(c => {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
    });
    const range = Math.max(1, maxP - minP);
    const step = range / bins;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      priceLow: minP + i * step,
      priceHigh: minP + (i + 1) * step,
      priceMid: minP + (i + 0.5) * step,
      buyVol: 0,
      sellVol: 0,
      totalVol: 0
    }));

    candles.forEach(c => {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor(((c.close - minP) / range) * bins)));
      buckets[idx].buyVol += c.buyVol;
      buckets[idx].sellVol += c.sellVol;
      buckets[idx].totalVol += c.volume;
    });

    let maxVol = 1;
    let poc = (minP + maxP) / 2;
    buckets.forEach(b => {
      if (b.totalVol > maxVol) {
        maxVol = b.totalVol;
        poc = b.priceMid;
      }
    });
    return { buckets, maxVol, poc: +poc.toFixed(2) };
  }

  function computeSRLevels(candles) {
    if (!candles || candles.length < 15) return [];
    const lastClose = candles[candles.length - 1].close;
    const highs = [];
    const lows = [];
    for (let i = 2; i < candles.length - 2; i++) {
      if (candles[i].high >= candles[i - 1].high && candles[i].high >= candles[i + 1].high &&
          candles[i].high >= candles[i - 2].high && candles[i].high >= candles[i + 2].high) {
        highs.push(candles[i].high);
      }
      if (candles[i].low <= candles[i - 1].low && candles[i].low <= candles[i + 1].low &&
          candles[i].low <= candles[i - 2].low && candles[i].low <= candles[i + 2].low) {
        lows.push(candles[i].low);
      }
    }

    const resAbove = highs.filter(p => p > lastClose).sort((a, b) => a - b);
    const supBelow = lows.filter(p => p < lastClose).sort((a, b) => b - a);
    const levels = [];

    if (resAbove[0]) levels.push({ label: 'R1', type: 'RES', price: +resAbove[0].toFixed(2), strength: 96 });
    if (resAbove[resAbove.length - 1] && resAbove.length > 1) {
      levels.push({ label: 'R2', type: 'RES', price: +resAbove[resAbove.length - 1].toFixed(2), strength: 99 });
    }
    if (supBelow[0]) levels.push({ label: 'S1', type: 'SUP', price: +supBelow[0].toFixed(2), strength: 95 });
    if (supBelow[supBelow.length - 1] && supBelow.length > 1) {
      levels.push({ label: 'S2', type: 'SUP', price: +supBelow[supBelow.length - 1].toFixed(2), strength: 99 });
    }
    return levels;
  }

  function extractSwings(candles, maxSwings = 9) {
    if (!candles || candles.length < 12) return [];
    const windowCandles = candles.slice(-65);
    const offset = candles.length - windowCandles.length;
    const pivots = [];

    for (let i = 2; i < windowCandles.length - 2; i++) {
      const c = windowCandles[i];
      const isHigh = c.high >= windowCandles[i - 1].high && c.high >= windowCandles[i + 1].high &&
                     c.high >= windowCandles[i - 2].high && c.high >= windowCandles[i + 2].high;
      const isLow = c.low <= windowCandles[i - 1].low && c.low <= windowCandles[i + 1].low &&
                    c.low <= windowCandles[i - 2].low && c.low <= windowCandles[i + 2].low;
      if (isHigh) {
        if (!pivots.length || pivots[pivots.length - 1].type === 'L') {
          pivots.push({ index: offset + i, price: c.high, type: 'H' });
        } else if (c.high > pivots[pivots.length - 1].price) {
          pivots[pivots.length - 1] = { index: offset + i, price: c.high, type: 'H' };
        }
      } else if (isLow) {
        if (!pivots.length || pivots[pivots.length - 1].type === 'H') {
          pivots.push({ index: offset + i, price: c.low, type: 'L' });
        } else if (c.low < pivots[pivots.length - 1].price) {
          pivots[pivots.length - 1] = { index: offset + i, price: c.low, type: 'L' };
        }
      }
    }

    const lastIdx = candles.length - 1;
    const lastClose = candles[lastIdx].close;
    if (!pivots.length || pivots[pivots.length - 1].index < lastIdx) {
      const prev = pivots[pivots.length - 1];
      pivots.push({
        index: lastIdx,
        price: lastClose,
        type: prev && lastClose >= prev.price ? 'H' : 'L'
      });
    }

    return pivots.slice(-maxSwings);
  }

  function computeEMA(values, period) {
    const out = new Array(values.length).fill(null);
    if (!values.length) return out;
    const k = 2 / (period + 1);
    let ema = null;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      if (ema === null) {
        ema = v;
      } else {
        ema = v * k + ema * (1 - k);
      }
      out[i] = +ema.toFixed(4);
    }
    return out;
  }

  function computeSMA(values, period) {
    const out = new Array(values.length).fill(null);
    for (let i = 0; i < values.length; i++) {
      if (i < period - 1) continue;
      let sum = 0;
      let cnt = 0;
      for (let j = i - period + 1; j <= i; j++) {
        if (values[j] !== null && values[j] !== undefined && !Number.isNaN(values[j])) {
          sum += values[j];
          cnt++;
        }
      }
      if (cnt === period) out[i] = +(sum / period).toFixed(2);
    }
    return out;
  }

  function computeRSI(candles, period = 14, maPeriod = 14) {
    const n = candles ? candles.length : 0;
    const rsi = new Array(n).fill(null);
    if (n <= period) return { rsi, rsiMA: new Array(n).fill(null), latestRsi: null, latestRsiMA: null };

    let gainSum = 0;
    let lossSum = 0;
    for (let i = 1; i <= period; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      if (diff >= 0) gainSum += diff;
      else lossSum += Math.abs(diff);
    }

    let avgGain = gainSum / period;
    let avgLoss = lossSum / period;
    rsi[period] = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);

    for (let i = period + 1; i < n; i++) {
      const diff = candles[i].close - candles[i - 1].close;
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      rsi[i] = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2);
    }

    const rsiMA = computeSMA(rsi, maPeriod);
    return {
      rsi,
      rsiMA,
      latestRsi: rsi[n - 1],
      latestRsiMA: rsiMA[n - 1]
    };
  }

  function computeMACD(candles, fast = 12, slow = 26, signalPeriod = 9) {
    const n = candles ? candles.length : 0;
    if (!n) return { macd: [], signal: [], hist: [], latestMacd: 0, latestSignal: 0, latestHist: 0 };
    const closes = candles.map(c => c.close);
    const emaFast = computeEMA(closes, fast);
    const emaSlow = computeEMA(closes, slow);
    const macd = closes.map((_, i) =>
      emaFast[i] !== null && emaSlow[i] !== null ? +(emaFast[i] - emaSlow[i]).toFixed(2) : null
    );
    const signal = computeEMA(macd, signalPeriod).map(v => (v !== null ? +v.toFixed(2) : null));
    const hist = macd.map((m, i) =>
      m !== null && signal[i] !== null ? +(m - signal[i]).toFixed(2) : null
    );
    return {
      macd,
      signal,
      hist,
      latestMacd: macd[n - 1] || 0,
      latestSignal: signal[n - 1] || 0,
      latestHist: hist[n - 1] || 0
    };
  }

  function detectDivergences(candles, rsiSeries) {
    const rsiDivs = [];
    const volDivs = [];
    if (!candles || candles.length < 20) return { rsiDivs, volDivs };

    const swingHighs = [];
    const swingLows = [];
    const start = Math.max(2, candles.length - 70);

    for (let i = start; i < candles.length - 2; i++) {
      const c = candles[i];
      if (c.high >= candles[i - 1].high && c.high >= candles[i + 1].high &&
          c.high >= candles[i - 2].high && c.high >= candles[i + 2].high) {
        swingHighs.push({ idx: i, price: c.high, vol: c.volume, rsi: rsiSeries[i] });
      }
      if (c.low <= candles[i - 1].low && c.low <= candles[i + 1].low &&
          c.low <= candles[i - 2].low && c.low <= candles[i + 2].low) {
        swingLows.push({ idx: i, price: c.low, vol: c.volume, rsi: rsiSeries[i] });
      }
    }

    for (let k = 1; k < swingHighs.length; k++) {
      const p1 = swingHighs[k - 1];
      const p2 = swingHighs[k];
      if (p2.idx - p1.idx < 4) continue;

      if (p2.price > p1.price && p1.rsi !== null && p2.rsi !== null && p2.rsi < p1.rsi - 2) {
        rsiDivs.push({
          type: 'BEAR', source: 'RSI',
          idx1: p1.idx, idx2: p2.idx,
          price1: p1.price, price2: p2.price,
          ind1: p1.rsi, ind2: p2.rsi,
          label: 'BEAR RSI DIV'
        });
      }

      if (p2.price > p1.price && p2.vol < p1.vol * 0.85) {
        volDivs.push({
          type: 'BEAR', source: 'VOL',
          idx1: p1.idx, idx2: p2.idx,
          price1: p1.price, price2: p2.price,
          ind1: p1.vol, ind2: p2.vol,
          label: 'BEAR VOL DIV'
        });
      }
    }

    for (let k = 1; k < swingLows.length; k++) {
      const p1 = swingLows[k - 1];
      const p2 = swingLows[k];
      if (p2.idx - p1.idx < 4) continue;

      if (p2.price < p1.price && p1.rsi !== null && p2.rsi !== null && p2.rsi > p1.rsi + 2) {
        rsiDivs.push({
          type: 'BULL', source: 'RSI',
          idx1: p1.idx, idx2: p2.idx,
          price1: p1.price, price2: p2.price,
          ind1: p1.rsi, ind2: p2.rsi,
          label: 'BULL RSI DIV'
        });
      }

      if (p2.price < p1.price && p2.vol < p1.vol * 0.85) {
        volDivs.push({
          type: 'BULL', source: 'VOL',
          idx1: p1.idx, idx2: p2.idx,
          price1: p1.price, price2: p2.price,
          ind1: p1.vol, ind2: p2.vol,
          label: 'BULL VOL DIV'
        });
      }
    }

    return {
      rsiDivs: rsiDivs.slice(-3),
      volDivs: volDivs.slice(-3)
    };
  }

  return {
    computeVWAP,
    computeVPVR,
    computeSRLevels,
    extractSwings,
    computeRSI,
    computeMACD,
    detectDivergences
  };
})();
