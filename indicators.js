/**
 * js/indicators.js
 * Computes VWAP, VPVR (Volume Profile), Support/Resistance Zones,
 * and Swing Pivot Extraction for the 123 Geo Pattern Engine.
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

  /**
   * Extract normalized swing pivots from recent candles for 123 Geo pattern matching.
   */
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

    // Always append current live candle close as latest structural anchor
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

  return {
    computeVWAP,
    computeVPVR,
    computeSRLevels,
    extractSwings
  };
})();
