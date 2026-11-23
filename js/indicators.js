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


  function computeOBIProfile(candles, windowSize = 5) {
    if (!candles || !candles.length) {
      return { instant: 0, avg5: 0, posAvg: 0, negAvg: 0, trend: 'NEUTRAL', series: [] };
    }
    const slice = candles.slice(-Math.max(1, windowSize));
    const series = slice.map(c => {
      const buy = Number(c.buyVol) || 0;
      const sell = Number(c.sellVol) || 0;
      const total = buy + sell;
      if (total <= 0) return 0;
      return +(((buy - sell) / total) * 100).toFixed(1);
    });

    const instant = series[series.length - 1] || 0;
    const sumAll = series.reduce((acc, v) => acc + v, 0);
    const avg5 = +(sumAll / series.length).toFixed(1);

    const posVals = series.filter(v => v > 0);
    const negVals = series.filter(v => v < 0);
    const posAvg = posVals.length ? +(posVals.reduce((a, b) => a + b, 0) / posVals.length).toFixed(1) : 0;
    const negAvg = negVals.length ? +(negVals.reduce((a, b) => a + b, 0) / negVals.length).toFixed(1) : 0;

    let trend = 'NEUTRAL';
    if (avg5 >= 5) trend = 'BULLISH';
    else if (avg5 <= -5) trend = 'BEARISH';

    return { instant, avg5, posAvg, negAvg, trend, series };
  }

  function computeTrendFilter(candles) {
    if (!candles || !candles.length) {
      return { vwap: 0, priceAboveVwap: false, vwapDiffPct: 0, emaFast: 0, emaSlow: 0, emaBull: false, trend: 'NEUTRAL', aligned: false };
    }
    const lastClose = candles[candles.length - 1].close;
    const vwapObj = computeVWAP(candles);
    const vwap = vwapObj.latest || lastClose;
    const priceAboveVwap = lastClose >= vwap;
    const vwapDiffPct = vwap > 0 ? +(((lastClose - vwap) / vwap) * 100).toFixed(2) : 0;

    const closes = candles.map(c => c.close);
    const ema20Arr = computeEMA(closes, 20);
    const ema50Arr = computeEMA(closes, 50);
    const emaFast = ema20Arr[ema20Arr.length - 1] ?? lastClose;
    const emaSlow = ema50Arr[ema50Arr.length - 1] ?? lastClose;
    const emaBull = emaFast >= emaSlow;

    const aligned = (priceAboveVwap && emaBull) || (!priceAboveVwap && !emaBull);
    let trend = 'NEUTRAL';
    if (priceAboveVwap && emaBull) trend = 'BULLISH';
    else if (!priceAboveVwap && !emaBull) trend = 'BEARISH';

    return { vwap, priceAboveVwap, vwapDiffPct, emaFast, emaSlow, emaBull, trend, aligned };
  }

  function classifyScoreAction(score, strongThresh = 45, mildThresh = 18) {
    if (score >= strongThresh) return { action: 'STRONG BUY', actionClass: 'strong-buy' };
    if (score >= mildThresh) return { action: 'BUY', actionClass: 'buy' };
    if (score <= -strongThresh) return { action: 'STRONG SELL', actionClass: 'strong-sell' };
    if (score <= -mildThresh) return { action: 'SELL', actionClass: 'sell' };
    return { action: 'WAIT', actionClass: 'wait' };
  }

  function computeSmartDecision({ tf, candles, evaluations = [], minMatch = 25, liveObi = null }) {
    const obi = computeOBIProfile(candles, 5);
    const effectiveInstant = (liveObi !== null && !Number.isNaN(Number(liveObi))) ? +Number(liveObi).toFixed(1) : obi.instant;
    const trend = computeTrendFilter(candles);
    const vwapObj = computeVWAP(candles || []);
    const closes = (candles || []).map(c => c.close);
    const ema20Arr = computeEMA(closes, 20);
    const ema50Arr = computeEMA(closes, 50);
    const rsiData = computeRSI(candles, 14, 14);
    const macdData = computeMACD(candles, 12, 26, 9);
    const divs = detectDivergences(candles, rsiData.rsi);

    const qualified = (evaluations || []).filter(e => !e.hasRed && e.overallPct >= minMatch);
    const bullPats = qualified.filter(e => e.pattern.bias === 'BULLISH');
    const bearPats = qualified.filter(e => e.pattern.bias === 'BEARISH');
    const bullCount = bullPats.length;
    const bearCount = bearPats.length;
    const bullAvgStr = bullCount ? Math.round(bullPats.reduce((s, e) => s + e.overallPct, 0) / bullCount) : 0;
    const bearAvgStr = bearCount ? Math.round(bearPats.reduce((s, e) => s + e.overallPct, 0) / bearCount) : 0;

    // Pillar 1: OBI Pressure (-25 to +25) — weighted 70% on 5-period smoothed avg, 30% on instant
    const blendedObi = obi.avg5 * 0.7 + effectiveInstant * 0.3;
    const obiScore = Math.max(-25, Math.min(25, (blendedObi / 40) * 25));

    // Pillar 2: VWAP & EMA Trend Filter (-25 to +25)
    let trendScore = 0;
    trendScore += trend.priceAboveVwap ? 15 : -15;
    trendScore += trend.emaBull ? 10 : -10;

    // Pillar 3: Momentum (RSI vs MA + MACD Hist + Divergence) (-25 to +25)
    let momScore = 0;
    const rsiBull = rsiData.latestRsi !== null && rsiData.latestRsiMA !== null ? rsiData.latestRsi >= rsiData.latestRsiMA : null;
    if (rsiBull === true) momScore += 10;
    else if (rsiBull === false) momScore -= 10;

    const macdBull = macdData.latestHist >= 0;
    momScore += macdBull ? 10 : -10;

    const lastRsiDiv = divs.rsiDivs[divs.rsiDivs.length - 1];
    if (lastRsiDiv) momScore += lastRsiDiv.type === 'BULL' ? 5 : -5;
    momScore = Math.max(-25, Math.min(25, momScore));

    // Pillar 4: Qualified Patterns Count & Strength (-25 to +25)
    const bullWeight = bullCount * (bullAvgStr / 100);
    const bearWeight = bearCount * (bearAvgStr / 100);
    const totalWeight = bullWeight + bearWeight;
    const patScore = totalWeight > 0 ? ((bullWeight - bearWeight) / totalWeight) * 25 : 0;

    const totalScore = Math.round(obiScore + trendScore + momScore + patScore);
    const confidence = Math.min(99, Math.max(10, Math.abs(totalScore)));
    const { action, actionClass } = classifyScoreAction(totalScore, 45, 18);

    // Historical Per-Candle Scores for Last 5 & Last 14 Candles (from fetched Binance candles)
    const n = candles ? candles.length : 0;
    const candleObiAll = (candles || []).map(c => {
      const buy = Number(c.buyVol) || 0;
      const sell = Number(c.sellVol) || 0;
      const tot = buy + sell;
      return tot > 0 ? ((buy - sell) / tot) * 100 : 0;
    });

    const histStart = Math.max(0, n - 14);
    const scoreHistory = [];
    for (let i = histStart; i < n; i++) {
      if (i === n - 1) {
        scoreHistory.push(totalScore);
        continue;
      }
      // Rolling 5-candle OBI avg ending at candle i
      const wStart = Math.max(0, i - 4);
      let sumObi = 0;
      for (let k = wStart; k <= i; k++) sumObi += candleObiAll[k];
      const avg5AtI = sumObi / (i - wStart + 1);
      const instAtI = candleObiAll[i];
      const blendedAtI = avg5AtI * 0.7 + instAtI * 0.3;
      const obiS = Math.max(-25, Math.min(25, (blendedAtI / 40) * 25));

      // VWAP & EMA trend at candle i
      const cClose = candles[i].close;
      const vAtI = vwapObj.series[i] ?? cClose;
      const e20 = ema20Arr[i] ?? cClose;
      const e50 = ema50Arr[i] ?? cClose;
      const trS = (cClose >= vAtI ? 15 : -15) + (e20 >= e50 ? 10 : -10);

      // Momentum (RSI vs MA + MACD Hist) at candle i
      let mS = 0;
      const rI = rsiData.rsi[i];
      const rMaI = rsiData.rsiMA[i];
      if (rI !== null && rI !== undefined && rMaI !== null && rMaI !== undefined) {
        mS += rI >= rMaI ? 10 : -10;
      }
      const hI = macdData.hist[i];
      if (hI !== null && hI !== undefined) {
        mS += hI >= 0 ? 10 : -10;
      }
      mS = Math.max(-25, Math.min(25, mS));

      scoreHistory.push(Math.round(obiS + trS + mS + patScore));
    }

    const last5Scores = scoreHistory.slice(-5);
    const avgScore5 = last5Scores.length
      ? Math.round(last5Scores.reduce((s, v) => s + v, 0) / last5Scores.length)
      : totalScore;
    const avgScore14 = scoreHistory.length
      ? Math.round(scoreHistory.reduce((s, v) => s + v, 0) / scoreHistory.length)
      : totalScore;

    const avg5Meta = classifyScoreAction(avgScore5, 45, 18);
    const avg14Meta = classifyScoreAction(avgScore14, 45, 18);

    return {
      tf,
      action,
      actionClass,
      score: totalScore,
      avgScore5,
      avgScore14,
      avg5Action: avg5Meta.action,
      avg5Class: avg5Meta.actionClass,
      avg14Action: avg14Meta.action,
      avg14Class: avg14Meta.actionClass,
      confidence,
      obi: { ...obi, instant: effectiveInstant },
      trend,
      rsi: { val: rsiData.latestRsi, ma: rsiData.latestRsiMA, bull: rsiBull },
      macd: { hist: macdData.latestHist, bull: macdBull },
      patterns: {
        total: bullCount + bearCount,
        bullCount,
        bearCount,
        bullAvgStr,
        bearAvgStr,
        dominantBias: bullWeight > bearWeight ? 'BULLISH' : bearWeight > bullWeight ? 'BEARISH' : 'NEUTRAL'
      },
      pillars: {
        obiScore: Math.round(obiScore),
        trendScore: Math.round(trendScore),
        momScore: Math.round(momScore),
        patScore: Math.round(patScore)
      }
    };
  }

  function computeMasterMatrix(decisionsMap) {
    const weights = { '1m': 0.15, '5m': 0.20, '15m': 0.30, '4h': 0.35 };
    const tfs = Object.keys(decisionsMap);
    let weightedScore = 0;
    let weightedAvg5 = 0;
    let weightedAvg14 = 0;
    let totalW = 0;
    let vwapBullCount = 0;
    let vwapBearCount = 0;

    tfs.forEach(tf => {
      const d = decisionsMap[tf];
      if (!d) return;
      const w = weights[tf] || 0.25;
      weightedScore += d.score * w;
      weightedAvg5 += (d.avgScore5 ?? d.score) * w;
      weightedAvg14 += (d.avgScore14 ?? d.score) * w;
      totalW += w;
      if (d.trend.priceAboveVwap) vwapBullCount++;
      else vwapBearCount++;
    });

    const masterScore = totalW > 0 ? Math.round(weightedScore / totalW) : 0;
    const masterAvgScore5 = totalW > 0 ? Math.round(weightedAvg5 / totalW) : 0;
    const masterAvgScore14 = totalW > 0 ? Math.round(weightedAvg14 / totalW) : 0;
    let action = 'WAIT';
    let actionClass = 'wait';
    if (masterScore >= 42) { action = 'STRONG BUY'; actionClass = 'strong-buy'; }
    else if (masterScore >= 16) { action = 'BUY'; actionClass = 'buy'; }
    else if (masterScore <= -42) { action = 'STRONG SELL'; actionClass = 'strong-sell'; }
    else if (masterScore <= -16) { action = 'SELL'; actionClass = 'sell'; }

    const totalTfs = tfs.length || 4;
    let vwapAlignmentLabel = `MIXED (${vwapBullCount}B / ${vwapBearCount}S)`;
    let vwapAlignmentClass = 'neutral';
    if (vwapBullCount === totalTfs) {
      vwapAlignmentLabel = `ALL ${totalTfs}/${totalTfs} ABOVE VWAP (BULLISH)`;
      vwapAlignmentClass = 'bull';
    } else if (vwapBearCount === totalTfs) {
      vwapAlignmentLabel = `ALL ${totalTfs}/${totalTfs} BELOW VWAP (BEARISH)`;
      vwapAlignmentClass = 'bear';
    } else if (vwapBullCount >= totalTfs - 1) {
      vwapAlignmentLabel = `${vwapBullCount}/${totalTfs} ABOVE VWAP (MOSTLY BULL)`;
      vwapAlignmentClass = 'bull';
    } else if (vwapBearCount >= totalTfs - 1) {
      vwapAlignmentLabel = `${vwapBearCount}/${totalTfs} BELOW VWAP (MOSTLY BEAR)`;
      vwapAlignmentClass = 'bear';
    }

    return {
      action,
      actionClass,
      score: masterScore,
      avgScore5: masterAvgScore5,
      avgScore14: masterAvgScore14,
      confidence: Math.min(99, Math.max(10, Math.abs(masterScore))),
      vwapBullCount,
      vwapBearCount,
      vwapAlignmentLabel,
      vwapAlignmentClass
    };
  }


  function detectMacdSlopeSignals(candles, macdData, cfg = {}) {
    const signals = [];
    if (!candles || !candles.length || !macdData || !macdData.macd) return signals;

    const gapPct = cfg.gapPct != null ? cfg.gapPct : 18;        // % of recent max |hist| for "About to Cross"
    const slopeMin = cfg.slopeMin != null ? cfg.slopeMin : 1.2; // Slope / Angle sensitivity
    const { macd, signal, hist } = macdData;
    const n = candles.length;

    // Normalize against recent 50-bar max |hist| so thresholds adapt across 1m, 5m, 15m, 4h
    const lookback = Math.min(50, n);
    let maxHist = 1;
    for (let i = n - lookback; i < n; i++) {
      if (hist[i] != null && Math.abs(hist[i]) > maxHist) maxHist = Math.abs(hist[i]);
    }
    const gapLimit = maxHist * (gapPct / 100);
    const slopeLimit = maxHist * (slopeMin / 100) * 8;

    let lastSignalIdx = -3;
    for (let i = 2; i < n; i++) {
      const m0 = macd[i], m1 = macd[i - 1];
      const s0 = signal[i], s1 = signal[i - 1];
      const h0 = hist[i], h1 = hist[i - 1];
      if (m0 == null || m1 == null || s0 == null || s1 == null || h0 == null || h1 == null) continue;

      const macdSlope = m0 - m1;
      const sigSlope = s0 - s1;
      const narrowing = Math.abs(h0) < Math.abs(h1);

      // 1. Confirmed Crossover
      if (h1 <= 0 && h0 > 0) {
        signals.push({ idx: i, type: 'BULL', kind: 'CROSS', label: 'X▲', price: candles[i].high });
        lastSignalIdx = i;
        continue;
      }
      if (h1 >= 0 && h0 < 0) {
        signals.push({ idx: i, type: 'BEAR', kind: 'CROSS', label: 'X▼', price: candles[i].high });
        lastSignalIdx = i;
        continue;
      }

      if (i - lastSignalIdx < 2) continue;

      // 2. Early Crossover ("About to Happen" via narrowing gap + steep angle)
      if (h0 < 0 && narrowing && Math.abs(h0) <= gapLimit && macdSlope > slopeLimit) {
        signals.push({ idx: i, type: 'BULL', kind: 'PRE', label: 'PRE▲', price: candles[i].high });
        lastSignalIdx = i;
        continue;
      }
      if (h0 > 0 && narrowing && Math.abs(h0) <= gapLimit && macdSlope < -slopeLimit) {
        signals.push({ idx: i, type: 'BEAR', kind: 'PRE', label: 'PRE▼', price: candles[i].high });
        lastSignalIdx = i;
        continue;
      }

      // 3. Dual-Line Sharp Inclination (Both MACD & Signal inclining together)
      if (macdSlope > slopeLimit * 1.35 && sigSlope > slopeLimit * 0.65 && h0 > 0) {
        signals.push({ idx: i, type: 'BULL', kind: 'SLOPE', label: '▲▲', price: candles[i].high });
        lastSignalIdx = i;
      } else if (macdSlope < -slopeLimit * 1.35 && sigSlope < -slopeLimit * 0.65 && h0 < 0) {
        signals.push({ idx: i, type: 'BEAR', kind: 'SLOPE', label: '▼▼', price: candles[i].high });
        lastSignalIdx = i;
      }
    }
    return signals;
  }

  return {
    computeVWAP,
    computeVPVR,
    computeSRLevels,
    extractSwings,
    computeRSI,
    computeMACD,
    detectMacdSlopeSignals,
    detectDivergences,
    computeOBIProfile,
    computeTrendFilter,
    computeSmartDecision,
    computeMasterMatrix
  };
})();
