/**
 * js/confluenceLab.js
 * Standalone Confluence & Pattern Selection Lab Engine.
 *
 * Combines:
 * 1. 123 Geo Pattern Match %
 * 2. Per-TF Smart Action Matrix + Master Matrix (Instant / 5-Avg / 14-Avg / Blended)
 * 3. Static Support & Resistance Levels (R1, R2, S1, S2)
 * 4. Dynamic Moving Average S/R (Customizable Fast / Slow / Trend EMAs)
 * 5. Momentum & Divergence (RSI vs RSI-MA, MACD Histogram, RSI/Vol Divergence)
 * 6. Customizable Fibonacci Target Engine (TP1, TP2, SL + S/R Buffer + Risk:Reward)
 *
 * Outputs the highest-probability pattern directly to the Main Chart
 * when Auto-Select is enabled, without altering core terminal layout.
 */
window.ConfluenceLab = (function () {
  const STORAGE_KEY = 'radar_v4_confluence_lab_cfg_v1';

  const DEFAULT_CONFIG = {
    autoSelectOnMainChart: true,
    showDynamicMAOnChart: true,
    useFibRefinement: true,
    alignSlToSR: true,
    scoreMode: 'BLENDED', // 'BLENDED' | 'AVG5' | 'AVG14' | 'INSTANT'
    emaFast: 20,
    emaSlow: 50,
    emaTrend: 200,
    wPattern: 30,
    wMatrix: 25,
    wStaticSR: 15,
    wDynamicMA: 15,
    wMomentum: 15,
    tp1Fib: 0.618,
    tp2Fib: 1.0,
    slBufferPct: 0.15,
    minConfluencePct: 50,
    tableTfFilter: 'ACTIVE' // 'ACTIVE' | 'ALL'
  };

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {
      // Ignore storage quota / private mode errors
    }
  }

  const state = {
    config: loadConfig(),
    resultsByTf: {},
    dynamicMAByTf: {},
    masterDecision: null,
    listeners: []
  };

  function onConfigChange(fn) {
    if (typeof fn === 'function') state.listeners.push(fn);
  }

  function notifyChange() {
    saveConfig(state.config);
    state.listeners.forEach(fn => {
      try { fn(state.config); } catch (e) { console.error(e); }
    });
  }

  function resetDefaults() {
    state.config = { ...DEFAULT_CONFIG };
    notifyChange();
  }

  function computeEMA(values, period) {
    const p = Math.max(2, parseInt(period, 10) || 20);
    const out = new Array(values.length).fill(null);
    if (!values.length) return out;
    const k = 2 / (p + 1);
    let ema = null;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (v === null || v === undefined || Number.isNaN(v)) continue;
      ema = ema === null ? v : v * k + ema * (1 - k);
      out[i] = +ema.toFixed(2);
    }
    return out;
  }

  function computeDynamicMA(candles) {
    const cfg = state.config;
    if (!candles || !candles.length) {
      return {
        fastPeriod: cfg.emaFast,
        slowPeriod: cfg.emaSlow,
        trendPeriod: cfg.emaTrend,
        fastSeries: [],
        slowSeries: [],
        trendSeries: [],
        fast: 0,
        slow: 0,
        trend: 0,
        lastClose: 0,
        stackBias: 'NEUTRAL',
        nearestDynamic: null
      };
    }

    const closes = candles.map(c => c.close);
    const lastClose = closes[closes.length - 1];
    const fastSeries = computeEMA(closes, cfg.emaFast);
    const slowSeries = computeEMA(closes, cfg.emaSlow);
    const trendSeries = computeEMA(closes, cfg.emaTrend);

    const fast = fastSeries[fastSeries.length - 1] ?? lastClose;
    const slow = slowSeries[slowSeries.length - 1] ?? lastClose;
    const trend = trendSeries[trendSeries.length - 1] ?? lastClose;

    let stackBias = 'NEUTRAL';
    if (lastClose >= fast && fast >= slow) stackBias = 'BULLISH';
    else if (lastClose <= fast && fast <= slow) stackBias = 'BEARISH';

    const candidates = [
      { label: `EMA${cfg.emaFast}`, price: fast },
      { label: `EMA${cfg.emaSlow}`, price: slow },
      { label: `EMA${cfg.emaTrend}`, price: trend }
    ].map(m => ({
      ...m,
      diffPct: lastClose > 0 ? +(((lastClose - m.price) / lastClose) * 100).toFixed(2) : 0,
      absDiffPct: lastClose > 0 ? Math.abs(((lastClose - m.price) / lastClose) * 100) : 99,
      role: lastClose >= m.price ? 'DYN SUP' : 'DYN RES'
    })).sort((a, b) => a.absDiffPct - b.absDiffPct);

    return {
      fastPeriod: cfg.emaFast,
      slowPeriod: cfg.emaSlow,
      trendPeriod: cfg.emaTrend,
      fastSeries,
      slowSeries,
      trendSeries,
      fast,
      slow,
      trend,
      lastClose,
      stackBias,
      nearestDynamic: candidates[0] || null,
      levels: candidates
    };
  }

  function getSelectedMatrixScore(decision) {
    if (!decision) return 0;
    const mode = state.config.scoreMode;
    const inst = decision.score ?? 0;
    const avg5 = decision.avgScore5 ?? inst;
    const avg14 = decision.avgScore14 ?? inst;

    if (mode === 'AVG5') return avg5;
    if (mode === 'AVG14') return avg14;
    if (mode === 'INSTANT') return inst;
    // Default BLENDED: 30% Instant + 45% 5-Candle Avg + 25% 14-Candle Avg
    return Math.round(inst * 0.30 + avg5 * 0.45 + avg14 * 0.25);
  }

  function scoreMatrixAlignment(bias, tfDecision, masterDecision) {
    const tfScore = getSelectedMatrixScore(tfDecision);
    const mScore = masterDecision ? getSelectedMatrixScore(masterDecision) : tfScore;
    const combined = tfScore * 0.65 + mScore * 0.35; // -100 to +100
    const dir = bias === 'BULLISH' ? 1 : -1;
    const alignedVal = combined * dir; // positive if pattern agrees with matrix

    // Map -60..+60 smoothly to 10..100
    const score = Math.round(Math.max(10, Math.min(100, 55 + (alignedVal / 60) * 45)));
    return { score, tfScore, masterScore: mScore, combined: Math.round(combined) };
  }

  function scoreStaticSR(bias, entryPrice, srLevels, origTargets) {
    if (!srLevels || !srLevels.length || !entryPrice) {
      return { score: 55, note: 'No S/R nearby', nearestSup: null, nearestRes: null };
    }

    const sups = srLevels.filter(l => l.type === 'SUP').sort((a, b) => b.price - a.price);
    const ress = srLevels.filter(l => l.type === 'RES').sort((a, b) => a.price - b.price);
    const nearestSup = sups[0] || null;
    const nearestRes = ress[0] || null;

    let score = 55;
    let note = 'Mid-Range';

    if (bias === 'BULLISH') {
      if (nearestSup) {
        const distSupPct = ((entryPrice - nearestSup.price) / entryPrice) * 100;
        if (distSupPct >= 0 && distSupPct <= 0.45) {
          score += 32;
          note = `Near ${nearestSup.label} Sup (+${distSupPct.toFixed(2)}%)`;
        } else if (distSupPct > 0.45 && distSupPct <= 1.1) {
          score += 18;
          note = `Above ${nearestSup.label} Sup`;
        }
      }
      if (nearestRes) {
        const distResPct = ((nearestRes.price - entryPrice) / entryPrice) * 100;
        if (distResPct >= 0 && distResPct <= 0.25) {
          score -= 22;
          note = `Capped by ${nearestRes.label} Res`;
        } else if (origTargets && origTargets.tp1 && nearestRes.price > origTargets.tp1) {
          score += 10;
        }
      }
    } else {
      if (nearestRes) {
        const distResPct = ((nearestRes.price - entryPrice) / entryPrice) * 100;
        if (distResPct >= 0 && distResPct <= 0.45) {
          score += 32;
          note = `Near ${nearestRes.label} Res (+${distResPct.toFixed(2)}%)`;
        } else if (distResPct > 0.45 && distResPct <= 1.1) {
          score += 18;
          note = `Below ${nearestRes.label} Res`;
        }
      }
      if (nearestSup) {
        const distSupPct = ((entryPrice - nearestSup.price) / entryPrice) * 100;
        if (distSupPct >= 0 && distSupPct <= 0.25) {
          score -= 22;
          note = `Blocked by ${nearestSup.label} Sup`;
        } else if (origTargets && origTargets.tp1 && nearestSup.price < origTargets.tp1) {
          score += 10;
        }
      }
    }

    return {
      score: Math.max(10, Math.min(100, Math.round(score))),
      note,
      nearestSup,
      nearestRes
    };
  }

  function scoreDynamicMA(bias, dynamicMA) {
    if (!dynamicMA || !dynamicMA.lastClose) {
      return { score: 50, note: 'EMA N/A' };
    }
    const { lastClose, fast, slow, trend, fastPeriod, slowPeriod } = dynamicMA;
    let score = 50;
    let note = 'Neutral EMA';

    const distFastPct = ((lastClose - fast) / lastClose) * 100;
    const distSlowPct = ((lastClose - slow) / lastClose) * 100;

    if (bias === 'BULLISH') {
      if (lastClose >= fast) score += 16;
      else score -= 12;
      if (fast >= slow) score += 16;
      else score -= 12;
      if (lastClose >= trend) score += 8;
      else score -= 6;

      if (distFastPct >= -0.15 && distFastPct <= 0.35) {
        score += 12;
        note = `EMA${fastPeriod} Dyn Sup`;
      } else if (distSlowPct >= -0.15 && distSlowPct <= 0.35) {
        score += 10;
        note = `EMA${slowPeriod} Dyn Sup`;
      } else {
        note = fast >= slow ? `EMA${fastPeriod}>${slowPeriod} ▲` : `EMA${fastPeriod}<${slowPeriod} ▼`;
      }
    } else {
      if (lastClose <= fast) score += 16;
      else score -= 12;
      if (fast <= slow) score += 16;
      else score -= 12;
      if (lastClose <= trend) score += 8;
      else score -= 6;

      if (distFastPct <= 0.15 && distFastPct >= -0.35) {
        score += 12;
        note = `EMA${fastPeriod} Dyn Res`;
      } else if (distSlowPct <= 0.15 && distSlowPct >= -0.35) {
        score += 10;
        note = `EMA${slowPeriod} Dyn Res`;
      } else {
        note = fast <= slow ? `EMA${fastPeriod}<${slowPeriod} ▼` : `EMA${fastPeriod}>${slowPeriod} ▲`;
      }
    }

    return { score: Math.max(10, Math.min(100, Math.round(score))), note };
  }

  function scoreMomentum(bias, rsiData, macdData, divergences) {
    let score = 50;
    const isBull = bias === 'BULLISH';
    const parts = [];

    if (rsiData && rsiData.latestRsi !== null && rsiData.latestRsiMA !== null) {
      const rsiBull = rsiData.latestRsi >= rsiData.latestRsiMA;
      if (rsiBull === isBull) {
        score += 18;
        parts.push('RSI✓');
      } else {
        score -= 14;
        parts.push('RSI✗');
      }
    }

    if (macdData) {
      const macdBull = (macdData.latestHist ?? 0) >= 0;
      if (macdBull === isBull) {
        score += 18;
        parts.push('MACD✓');
      } else {
        score -= 14;
        parts.push('MACD✗');
      }
    }

    if (divergences) {
      const lastRsiDiv = divergences.rsiDivs && divergences.rsiDivs[divergences.rsiDivs.length - 1];
      const lastVolDiv = divergences.volDivs && divergences.volDivs[divergences.volDivs.length - 1];
      if (lastRsiDiv) {
        const divMatch = (lastRsiDiv.type === 'BULL' && isBull) || (lastRsiDiv.type === 'BEAR' && !isBull);
        score += divMatch ? 12 : -8;
        if (divMatch) parts.push('RSI-DIV✓');
      }
      if (lastVolDiv) {
        const volMatch = (lastVolDiv.type === 'BULL' && isBull) || (lastVolDiv.type === 'BEAR' && !isBull);
        score += volMatch ? 8 : -6;
        if (volMatch) parts.push('VOL-DIV✓');
      }
    }

    return {
      score: Math.max(10, Math.min(100, Math.round(score))),
      note: parts.join(' ') || 'Neutral'
    };
  }

  function computeRefinedFibTargets(ev, srEval, dynamicMA) {
    const orig = ev.targets;
    const cfg = state.config;
    if (!orig) return orig;
    if (!cfg.useFibRefinement) return orig;

    const isBull = ev.pattern.bias === 'BULLISH';
    const entry = Number(orig.entry) || 0;
    if (!entry) return orig;

    // Base structural range derived from original TP2 distance (or 0.6% fallback)
    const baseSpan = Math.max(entry * 0.0025, Math.abs((orig.tp2 ?? entry) - entry));
    const tp1Mult = Math.max(0.236, Number(cfg.tp1Fib) || 0.618);
    const tp2Mult = Math.max(tp1Mult + 0.15, Number(cfg.tp2Fib) || 1.0);
    const slBuf = Math.max(0.05, Number(cfg.slBufferPct) || 0.15) / 100;

    let tp1 = isBull ? entry + baseSpan * tp1Mult : entry - baseSpan * tp1Mult;
    let tp2 = isBull ? entry + baseSpan * tp2Mult : entry - baseSpan * tp2Mult;

    // SL: start from pattern's SL, optionally align/protect beyond nearest static S/R
    let sl = Number(orig.sl) || (isBull ? entry - baseSpan * 0.5 : entry + baseSpan * 0.5);
    let srNote = `Fib ${tp1Mult}/${tp2Mult}`;

    if (cfg.alignSlToSR && srEval) {
      if (isBull && srEval.nearestSup && srEval.nearestSup.price < entry) {
        const srSl = srEval.nearestSup.price * (1 - slBuf);
        const distPct = ((entry - srSl) / entry) * 100;
        if (distPct >= 0.12 && distPct <= 1.8) {
          sl = srSl;
          srNote = `SL < ${srEval.nearestSup.label} + Fib ${tp1Mult}/${tp2Mult}`;
        }
      } else if (!isBull && srEval.nearestRes && srEval.nearestRes.price > entry) {
        const srSl = srEval.nearestRes.price * (1 + slBuf);
        const distPct = ((srSl - entry) / entry) * 100;
        if (distPct >= 0.12 && distPct <= 1.8) {
          sl = srSl;
          srNote = `SL > ${srEval.nearestRes.label} + Fib ${tp1Mult}/${tp2Mult}`;
        }
      }
    }

    const tp1Pct = +(((tp1 - entry) / entry) * 100).toFixed(2);
    const tp2Pct = +(((tp2 - entry) / entry) * 100).toFixed(2);
    const risk = Math.max(0.01, Math.abs(entry - sl));
    const reward = Math.abs(tp2 - entry);
    const rr = `1:${(reward / risk).toFixed(2)}`;

    return {
      ...orig,
      entry: +entry.toFixed(2),
      tp1: +tp1.toFixed(2),
      tp2: +tp2.toFixed(2),
      sl: +sl.toFixed(2),
      tp1Pct,
      tp2Pct,
      rr,
      rule: `${orig.rule} · LAB ${srNote}`
    };
  }

  function classifyConfluence(pct, bias) {
    if (pct >= 72) return { label: bias === 'BULLISH' ? 'HIGH PROB BUY' : 'HIGH PROB SELL', cls: bias === 'BULLISH' ? 'strong-buy' : 'strong-sell' };
    if (pct >= 58) return { label: bias === 'BULLISH' ? 'CONFIRMED BUY' : 'CONFIRMED SELL', cls: bias === 'BULLISH' ? 'buy' : 'sell' };
    return { label: 'WATCH / WAIT', cls: 'wait' };
  }

  function evaluateTimeframe({ tf, candles, evaluations = [], decision, masterDecision, minMatch = 25 }) {
    const cfg = state.config;
    const srLevels = window.Indicators.computeSRLevels(candles || []);
    const rsiData = window.Indicators.computeRSI(candles || [], 14, 14);
    const macdData = window.Indicators.computeMACD(candles || [], 12, 26, 9);
    const divergences = window.Indicators.detectDivergences(candles || [], rsiData.rsi);
    const dynamicMA = computeDynamicMA(candles || []);

    state.dynamicMAByTf[tf] = dynamicMA;

    const totalW = Math.max(1,
      (Number(cfg.wPattern) || 0) +
      (Number(cfg.wMatrix) || 0) +
      (Number(cfg.wStaticSR) || 0) +
      (Number(cfg.wDynamicMA) || 0) +
      (Number(cfg.wMomentum) || 0)
    );

    const qualified = (evaluations || []).filter(e => !e.hasRed && e.overallPct >= minMatch);
    const ranked = qualified.map(ev => {
      const bias = ev.pattern.bias;
      const entryPrice = (ev.targets && ev.targets.entry) || (candles.length ? candles[candles.length - 1].close : 0);

      const patScore = ev.overallPct;
      const matEval = scoreMatrixAlignment(bias, decision, masterDecision);
      const srEval = scoreStaticSR(bias, entryPrice, srLevels, ev.targets);
      const maEval = scoreDynamicMA(bias, dynamicMA);
      const momEval = scoreMomentum(bias, rsiData, macdData, divergences);

      const weighted = (
        patScore * (Number(cfg.wPattern) || 0) +
        matEval.score * (Number(cfg.wMatrix) || 0) +
        srEval.score * (Number(cfg.wStaticSR) || 0) +
        maEval.score * (Number(cfg.wDynamicMA) || 0) +
        momEval.score * (Number(cfg.wMomentum) || 0)
      ) / totalW;

      const confluencePct = Math.max(1, Math.min(99, Math.round(weighted)));
      const verdict = classifyConfluence(confluencePct, bias);
      const refinedTargets = computeRefinedFibTargets(ev, srEval, dynamicMA);

      return {
        uid: ev.uid,
        tf,
        evalObj: ev,
        confluencePct,
        verdict,
        refinedTargets,
        breakdown: {
          pattern: patScore,
          matrix: matEval.score,
          matrixRaw: matEval.combined,
          staticSR: srEval.score,
          staticSRNote: srEval.note,
          dynamicMA: maEval.score,
          dynamicMANote: maEval.note,
          momentum: momEval.score,
          momentumNote: momEval.note
        }
      };
    }).sort((a, b) => b.confluencePct - a.confluencePct || b.breakdown.pattern - a.breakdown.pattern);

    const bestMatch = ranked.find(r => r.confluencePct >= cfg.minConfluencePct) || ranked[0] || null;

    const result = {
      tf,
      ranked,
      bestMatch,
      dynamicMA,
      srLevels,
      decision,
      qualifiedCount: ranked.length
    };
    state.resultsByTf[tf] = result;
    return result;
  }

  function evaluateAll({ candlesByTf, evaluationsByTf, decisionsByTf, minMatch = 25 }) {
    const master = window.Indicators.computeMasterMatrix(decisionsByTf || {});
    state.masterDecision = master;
    const tfs = Object.keys(candlesByTf || {});
    tfs.forEach(tf => {
      evaluateTimeframe({
        tf,
        candles: candlesByTf[tf] || [],
        evaluations: (evaluationsByTf && evaluationsByTf[tf]) || [],
        decision: decisionsByTf ? decisionsByTf[tf] : null,
        masterDecision: master,
        minMatch
      });
    });
    return state.resultsByTf;
  }

  function getBestPatternForChart(tf) {
    if (!state.config.autoSelectOnMainChart) return null;
    const res = state.resultsByTf[tf];
    if (!res || !res.bestMatch) return null;

    const item = res.bestMatch;
    return {
      ...item.evalObj,
      targets: state.config.useFibRefinement ? item.refinedTargets : item.evalObj.targets,
      confluenceMeta: {
        confluencePct: item.confluencePct,
        verdict: item.verdict,
        breakdown: item.breakdown,
        scoreMode: state.config.scoreMode
      }
    };
  }

  function getDynamicMA(tf) {
    return state.dynamicMAByTf[tf] || null;
  }

  function fmt(p) {
    return window.ChartRenderer ? window.ChartRenderer.fmtPrice(p) : ('$' + Number(p || 0).toFixed(2));
  }

  function renderLabTab(containerEl, { activeTf, onPin, onInspect, onSwitchTf }) {
    if (!containerEl) return;
    const cfg = state.config;
    const tfs = ['1m', '5m', '15m', '4h'];
    const totalW = (Number(cfg.wPattern) || 0) + (Number(cfg.wMatrix) || 0) + (Number(cfg.wStaticSR) || 0) + (Number(cfg.wDynamicMA) || 0) + (Number(cfg.wMomentum) || 0);

    // Build Top Multi-TF Best Picks Cards
    const tfPickCardsHtml = tfs.map(tf => {
      const res = state.resultsByTf[tf];
      const best = res && res.bestMatch;
      const ma = res && res.dynamicMA;
      const isAct = tf === activeTf ? ' active' : '';

      if (!best) {
        return `
          <div class="clab-pick-card${isAct}" data-clab-tf="${tf}">
            <div class="clab-pick-top">
              <span class="tf-mini">${tf.toUpperCase()}</span>
              <span class="decision-pill sm wait">NO MATCH</span>
            </div>
            <div class="clab-pick-name txt-gray">No pattern above min match</div>
            <div class="clab-pick-meta">Lower MIN MATCH slider or wait for setup.</div>
          </div>
        `;
      }

      const p = best.evalObj.pattern;
      const t = best.refinedTargets;
      const isBear = p.bias === 'BEARISH';
      const dirSym = isBear ? '▼' : '▲';
      const cls = isBear ? 'txt-red' : 'txt-green';

      return `
        <div class="clab-pick-card${isAct}" data-clab-tf="${tf}">
          <div class="clab-pick-top">
            <div class="p-badges">
              <span class="tf-mini">${tf.toUpperCase()}</span>
              <span class="bias-badge ${p.bias}">${p.bias}</span>
            </div>
            <span class="decision-pill sm ${best.verdict.cls}">${best.confluencePct}% · ${best.verdict.label}</span>
          </div>
          <div class="clab-pick-name">#${p.id} ${p.name}</div>
          <div class="clab-pick-sub">
            <span>Pat: <strong>${best.breakdown.pattern}%</strong></span> ·
            <span>Mat: <strong>${best.breakdown.matrix}%</strong></span> ·
            <span>S/R: <strong>${best.breakdown.staticSR}%</strong></span> ·
            <span>MA: <strong>${best.breakdown.dynamicMA}%</strong></span>
          </div>
          <div class="clab-pick-fib">
            <span>Entry: <strong>${fmt(t.entry)}</strong></span>
            <span class="${cls}">${dirSym} TP1: <strong>${fmt(t.tp1)}</strong></span>
            <span class="${cls}">${dirSym} TP2: <strong>${fmt(t.tp2)}</strong></span>
            <span class="txt-amber">SL: <strong>${fmt(t.sl)}</strong> (${t.rr})</span>
          </div>
          <div class="clab-pick-ma">
            EMA${cfg.emaFast}: ${ma ? fmt(ma.fast) : '--'} · EMA${cfg.emaSlow}: ${ma ? fmt(ma.slow) : '--'} · ${best.breakdown.staticSRNote}
          </div>
        </div>
      `;
    }).join('');

    // Build Ranked Leaderboard Rows
    let rows = [];
    if (cfg.tableTfFilter === 'ALL') {
      tfs.forEach(tf => {
        if (state.resultsByTf[tf]) rows = rows.concat(state.resultsByTf[tf].ranked);
      });
      rows.sort((a, b) => b.confluencePct - a.confluencePct);
    } else {
      rows = (state.resultsByTf[activeTf] && state.resultsByTf[activeTf].ranked) || [];
    }
    const topRows = rows.slice(0, 20);

    const tableRowsHtml = topRows.length
      ? topRows.map((item, idx) => {
          const p = item.evalObj.pattern;
          const t = item.refinedTargets;
          const isBear = p.bias === 'BEARISH';
          const cls = isBear ? 'txt-red' : 'txt-green';
          const dirSym = isBear ? '▼' : '▲';
          const b = item.breakdown;

          return `
            <tr class="${idx === 0 ? 'clab-top-row' : ''}">
              <td><strong>#${idx + 1}</strong></td>
              <td><span class="tf-mini">${item.tf.toUpperCase()}</span></td>
              <td>
                <div class="clab-pat-cell">
                  <strong>#${p.id} ${p.name}</strong>
                  <span class="bias-badge ${p.bias}">${p.bias}</span>
                </div>
              </td>
              <td><span class="decision-pill sm ${item.verdict.cls}">${item.confluencePct}%</span></td>
              <td>${b.pattern}%</td>
              <td>${b.matrix}% <small class="txt-gray">(${b.matrixRaw >= 0 ? '+' : ''}${b.matrixRaw})</small></td>
              <td>${b.staticSR}% <small class="txt-gray">${b.staticSRNote}</small></td>
              <td>${b.dynamicMA}% <small class="txt-gray">${b.dynamicMANote}</small></td>
              <td>${b.momentum}% <small class="txt-gray">${b.momentumNote}</small></td>
              <td>
                <div class="clab-fib-cell">
                  <span>E: ${fmt(t.entry)}</span>
                  <span class="${cls}">${dirSym}TP1: ${fmt(t.tp1)} (${t.tp1Pct}%)</span>
                  <span class="${cls}">${dirSym}TP2: ${fmt(t.tp2)} (${t.tp2Pct}%)</span>
                  <span class="txt-amber">SL: ${fmt(t.sl)} · ${t.rr}</span>
                </div>
              </td>
              <td>
                <div class="clab-row-btns">
                  <button class="btn-sm" data-clab-inspect="${item.uid}" data-clab-tf="${item.tf}">INSPECT</button>
                  <button class="btn-sm primary" data-clab-pin="${item.uid}" data-clab-tf="${item.tf}">PIN</button>
                </div>
              </td>
            </tr>
          `;
        }).join('')
      : `<tr><td colspan="11" class="txt-gray" style="text-align:center;padding:18px;">No qualified patterns found for current filter. Try adjusting MIN MATCH on Main Terminal.</td></tr>`;

    containerEl.innerHTML = `
      <section class="card clab-header-card">
        <div class="clab-head-row">
          <div>
            <div class="clab-title-line">
              <span class="badge-tag">CONFLUENCE LAB ENGINE</span>
              <h2>कन्फ्लुएंस लैब · MASTER PATTERN SELECTOR + DYNAMIC MA + STATIC S/R + FIB TARGETS</h2>
            </div>
            <p class="formula-note">
              Filters all 123 Geo Patterns using Smart Matrix (${cfg.scoreMode}), Static S/R (R1/R2/S1/S2), Dynamic Moving Averages (EMA ${cfg.emaFast}/${cfg.emaSlow}/${cfg.emaTrend}), Momentum/Divergence &amp; Fibonacci TP1/TP2/SL Engine. Top-ranked pick auto-syncs to the Main Chart.
            </p>
          </div>
          <div class="clab-head-actions">
            <button class="toggle-chip ${cfg.autoSelectOnMainChart ? 'active' : ''}" id="clabAutoToggle">
              AUTO-SELECT ON MAIN CHART: ${cfg.autoSelectOnMainChart ? 'ON' : 'OFF'}
            </button>
            <button class="toggle-chip ${cfg.showDynamicMAOnChart ? 'active' : ''}" id="clabMaChartToggle">
              PLOT EMA S/R ON CHART: ${cfg.showDynamicMAOnChart ? 'ON' : 'OFF'}
            </button>
            <button class="toggle-chip ${cfg.useFibRefinement ? 'active' : ''}" id="clabFibToggle">
              LAB FIB TP/SL: ${cfg.useFibRefinement ? 'ON' : 'OFF'}
            </button>
            <button class="btn-sm" id="clabResetBtn">↻ RESET DEFAULTS</button>
          </div>
        </div>

        <div class="clab-picks-grid">
          ${tfPickCardsHtml}
        </div>
      </section>

      <section class="card clab-controls-card">
        <div class="clab-section-title">
          <span class="badge-tag">CUSTOMIZATION ENGINE</span>
          <strong>WEIGHTING, SCORE BASIS, DYNAMIC MOVING AVERAGE S/R &amp; FIBONACCI TARGET RULES</strong>
          <span class="pct-pill">TOTAL WEIGHT: ${totalW}%</span>
        </div>

        <div class="clab-controls-grid">
          <!-- Box 1: Matrix Score Basis & Dynamic MAs -->
          <div class="clab-ctrl-box">
            <h4>1. Matrix Score Basis &amp; Dynamic MA S/R</h4>
            <div class="clab-field">
              <label>Matrix Score Mode:</label>
              <div class="btn-group" id="clabScoreModes">
                <button class="f-btn ${cfg.scoreMode === 'BLENDED' ? 'active' : ''}" data-sm="BLENDED">BLENDED (INST+5+14)</button>
                <button class="f-btn ${cfg.scoreMode === 'AVG5' ? 'active' : ''}" data-sm="AVG5">5-CANDLE AVG</button>
                <button class="f-btn ${cfg.scoreMode === 'AVG14' ? 'active' : ''}" data-sm="AVG14">14-CANDLE AVG</button>
                <button class="f-btn ${cfg.scoreMode === 'INSTANT' ? 'active' : ''}" data-sm="INSTANT">INSTANT</button>
              </div>
            </div>
            <div class="clab-inline-inputs">
              <label>EMA Fast <input type="number" id="clabEmaFast" min="5" max="100" value="${cfg.emaFast}" /></label>
              <label>EMA Slow <input type="number" id="clabEmaSlow" min="10" max="200" value="${cfg.emaSlow}" /></label>
              <label>EMA Trend <input type="number" id="clabEmaTrend" min="50" max="400" value="${cfg.emaTrend}" /></label>
            </div>
            <div class="clab-field" style="margin-top:8px;">
              <label>Min Confluence % Threshold: <strong>${cfg.minConfluencePct}%</strong></label>
              <input type="range" id="clabMinConf" min="20" max="90" step="5" value="${cfg.minConfluencePct}" />
            </div>
          </div>

          <!-- Box 2: Confluence Weights -->
          <div class="clab-ctrl-box">
            <h4>2. Confluence Pillar Weights</h4>
            <div class="clab-slider-row">
              <span>123 Pattern Match: <strong>${cfg.wPattern}%</strong></span>
              <input type="range" data-wkey="wPattern" min="0" max="60" step="5" value="${cfg.wPattern}" />
            </div>
            <div class="clab-slider-row">
              <span>Smart &amp; Master Matrix: <strong>${cfg.wMatrix}%</strong></span>
              <input type="range" data-wkey="wMatrix" min="0" max="60" step="5" value="${cfg.wMatrix}" />
            </div>
            <div class="clab-slider-row">
              <span>Static S/R (R1/R2/S1/S2): <strong>${cfg.wStaticSR}%</strong></span>
              <input type="range" data-wkey="wStaticSR" min="0" max="50" step="5" value="${cfg.wStaticSR}" />
            </div>
            <div class="clab-slider-row">
              <span>Dynamic MA S/R (EMA): <strong>${cfg.wDynamicMA}%</strong></span>
              <input type="range" data-wkey="wDynamicMA" min="0" max="50" step="5" value="${cfg.wDynamicMA}" />
            </div>
            <div class="clab-slider-row">
              <span>Momentum (RSI/MACD/Div): <strong>${cfg.wMomentum}%</strong></span>
              <input type="range" data-wkey="wMomentum" min="0" max="50" step="5" value="${cfg.wMomentum}" />
            </div>
          </div>

          <!-- Box 3: Fibonacci Target & SL Refinement -->
          <div class="clab-ctrl-box">
            <h4>3. Fibonacci TP1 / TP2 &amp; Stop-Loss Engine</h4>
            <div class="clab-inline-inputs">
              <label>TP1 Fib Ratio
                <select id="clabTp1Fib">
                  <option value="0.382" ${cfg.tp1Fib === 0.382 ? 'selected' : ''}>0.382 (Conservative)</option>
                  <option value="0.5" ${cfg.tp1Fib === 0.5 ? 'selected' : ''}>0.500 (Mid)</option>
                  <option value="0.618" ${cfg.tp1Fib === 0.618 ? 'selected' : ''}>0.618 (Golden)</option>
                </select>
              </label>
              <label>TP2 Fib Ratio
                <select id="clabTp2Fib">
                  <option value="0.786" ${cfg.tp2Fib === 0.786 ? 'selected' : ''}>0.786</option>
                  <option value="1" ${cfg.tp2Fib === 1 ? 'selected' : ''}>1.000 (Full Measure)</option>
                  <option value="1.272" ${cfg.tp2Fib === 1.272 ? 'selected' : ''}>1.272 (Extension)</option>
                  <option value="1.618" ${cfg.tp2Fib === 1.618 ? 'selected' : ''}>1.618 (Golden Ext)</option>
                </select>
              </label>
              <label>SL S/R Buffer %
                <input type="number" id="clabSlBuf" min="0.05" max="1.0" step="0.05" value="${cfg.slBufferPct}" />
              </label>
            </div>
            <div class="clab-field" style="margin-top:10px;">
              <button class="toggle-chip ${cfg.alignSlToSR ? 'active' : ''}" id="clabAlignSlToggle">
                PROTECT SL BEYOND STATIC S/R: ${cfg.alignSlToSR ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="card clab-table-card">
        <div class="clab-table-head">
          <div class="clab-title-line">
            <span class="badge-tag">RANKED OUTCOME</span>
            <strong>TOP CONFLUENCE-FILTERED PATTERNS (${cfg.tableTfFilter === 'ALL' ? 'ALL TIMEFRAMES' : activeTf.toUpperCase()})</strong>
          </div>
          <div class="btn-group" id="clabTableScope">
            <button class="f-btn ${cfg.tableTfFilter === 'ACTIVE' ? 'active' : ''}" data-scope="ACTIVE">ACTIVE TF (${activeTf.toUpperCase()})</button>
            <button class="f-btn ${cfg.tableTfFilter === 'ALL' ? 'active' : ''}" data-scope="ALL">ALL TIMEFRAMES</button>
          </div>
        </div>
        <div class="matrix-table-wrap">
          <table class="matrix-table clab-table">
            <thead>
              <tr>
                <th>RANK</th>
                <th>TF</th>
                <th>PATTERN</th>
                <th>CONFLUENCE</th>
                <th>PAT %</th>
                <th>MATRIX</th>
                <th>STATIC S/R</th>
                <th>DYNAMIC MA</th>
                <th>MOMENTUM</th>
                <th>REFINED FIB TARGETS (TP1 / TP2 / SL)</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
            </tbody>
          </table>
        </div>
      </section>
    `;

    // Bind interactive controls
    const bindClick = (sel, fn) => {
      const el = containerEl.querySelector(sel);
      if (el) el.addEventListener('click', fn);
    };

    bindClick('#clabAutoToggle', () => {
      cfg.autoSelectOnMainChart = !cfg.autoSelectOnMainChart;
      notifyChange();
    });
    bindClick('#clabMaChartToggle', () => {
      cfg.showDynamicMAOnChart = !cfg.showDynamicMAOnChart;
      notifyChange();
    });
    bindClick('#clabFibToggle', () => {
      cfg.useFibRefinement = !cfg.useFibRefinement;
      notifyChange();
    });
    bindClick('#clabAlignSlToggle', () => {
      cfg.alignSlToSR = !cfg.alignSlToSR;
      notifyChange();
    });
    bindClick('#clabResetBtn', () => resetDefaults());

    containerEl.querySelectorAll('#clabScoreModes .f-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        cfg.scoreMode = btn.dataset.sm;
        notifyChange();
      });
    });

    containerEl.querySelectorAll('#clabTableScope .f-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        cfg.tableTfFilter = btn.dataset.scope;
        notifyChange();
      });
    });

    const bindNum = (sel, key, isFloat = false) => {
      const el = containerEl.querySelector(sel);
      if (!el) return;
      el.addEventListener('change', () => {
        const val = isFloat ? parseFloat(el.value) : parseInt(el.value, 10);
        if (!Number.isNaN(val)) {
          cfg[key] = val;
          notifyChange();
        }
      });
    };
    bindNum('#clabEmaFast', 'emaFast', false);
    bindNum('#clabEmaSlow', 'emaSlow', false);
    bindNum('#clabEmaTrend', 'emaTrend', false);
    bindNum('#clabTp1Fib', 'tp1Fib', true);
    bindNum('#clabTp2Fib', 'tp2Fib', true);
    bindNum('#clabSlBuf', 'slBufferPct', true);

    const minConfEl = containerEl.querySelector('#clabMinConf');
    if (minConfEl) {
      minConfEl.addEventListener('change', () => {
        cfg.minConfluencePct = parseInt(minConfEl.value, 10) || 50;
        notifyChange();
      });
    }

    containerEl.querySelectorAll('input[data-wkey]').forEach(inp => {
      inp.addEventListener('change', () => {
        cfg[inp.dataset.wkey] = parseInt(inp.value, 10) || 0;
        notifyChange();
      });
    });

    // Pick card clicks -> switch active TF
    containerEl.querySelectorAll('.clab-pick-card').forEach(card => {
      card.addEventListener('click', () => {
        if (onSwitchTf) onSwitchTf(card.dataset.clabTf);
      });
    });

    // Table INSPECT & PIN buttons
    containerEl.querySelectorAll('[data-clab-inspect]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const tf = btn.dataset.clabTf;
        const uid = btn.dataset.clabInspect;
        const found = state.resultsByTf[tf] && state.resultsByTf[tf].ranked.find(r => r.uid === uid);
        if (found && onInspect) {
          onInspect({
            ...found.evalObj,
            targets: cfg.useFibRefinement ? found.refinedTargets : found.evalObj.targets
          });
        }
      });
    });

    containerEl.querySelectorAll('[data-clab-pin]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const tf = btn.dataset.clabTf;
        const uid = btn.dataset.clabPin;
        const found = state.resultsByTf[tf] && state.resultsByTf[tf].ranked.find(r => r.uid === uid);
        if (found && onPin) {
          onPin({
            ...found.evalObj,
            targets: cfg.useFibRefinement ? found.refinedTargets : found.evalObj.targets
          });
        }
      });
    });
  }

  return {
    state,
    get config() { return state.config; },
    onConfigChange,
    resetDefaults,
    computeDynamicMA,
    evaluateTimeframe,
    evaluateAll,
    getBestPatternForChart,
    getDynamicMA,
    renderLabTab
  };
})();
