/**
 * js/app.js
 * Main Application Controller connecting DataEngine, Indicators,
 * 123 PatternsEngine (with live Fib targets), and ChartRenderer.
 */
(function () {
  const AppState = {
    activeTab: 'terminal',
    activeTf: '1m',
    dashMinMatch: 25,
    libTf: 'ALL',
    libBias: 'BOTH',
    libMinMatch: 25,
    libSearch: '',
    hideRejected: true,
    visibleCards: 24,
    pinnedUid: null,
    sonarOn: true,
    layers: { vpvr: true, vwap: true, delta: true, obi: true, sr: true, emaSr: true, geo: true, fib: true, rsiDiv: true, volDiv: true, rsi: true, macd: true },
    evaluations: { '1m': [], '5m': [], '15m': [], '4h': [] },
    decisions: {},
    inspectedObj: null
  };

  const $ = id => document.getElementById(id);

  function fmt(p) {
    return window.ChartRenderer.fmtPrice(p);
  }

  function runAllEvaluations() {
    window.DataEngine.TIMEFRAMES.forEach(tf => {
      const candles = window.DataEngine.state.candles[tf] || [];
      AppState.evaluations[tf] = window.PatternsEngine.evaluateTimeframe(candles, tf);
    });
    runSmartDecisions();
  }

  function runSmartDecisions() {
    const st = window.DataEngine.state;
    const nextDecisions = {};
    window.DataEngine.TIMEFRAMES.forEach(tf => {
      const candles = st.candles[tf] || [];
      nextDecisions[tf] = window.Indicators.computeSmartDecision({
        tf,
        candles,
        evaluations: AppState.evaluations[tf] || [],
        minMatch: AppState.dashMinMatch,
        liveObi: tf === AppState.activeTf ? st.obi : null
      });
    });
    AppState.decisions = nextDecisions;
    if (window.ConfluenceLab) {
      window.ConfluenceLab.evaluateAll({
        candlesByTf: st.candles,
        evaluationsByTf: AppState.evaluations,
        decisionsByTf: AppState.decisions,
        minMatch: AppState.dashMinMatch
      });
    }
  }

  function fmtSignedPct(val) {
    const num = Number(val) || 0;
    return `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;
  }

  function getActivePatternForChart() {
    if (AppState.pinnedUid) {
      for (const tf of window.DataEngine.TIMEFRAMES) {
        const found = AppState.evaluations[tf].find(e => e.uid === AppState.pinnedUid);
        if (found) return found;
      }
    }
    if (window.ConfluenceLab) {
      const labBest = window.ConfluenceLab.getBestPatternForChart(AppState.activeTf);
      if (labBest) return labBest;
    }
    const list = AppState.evaluations[AppState.activeTf] || [];
    return list.find(e => !e.hasRed && e.overallPct >= AppState.dashMinMatch) || list[0] || null;
  }

  function renderHeader() {
    const st = window.DataEngine.state;
    const candles = st.candles[AppState.activeTf] || [];
    const vwap = window.Indicators.computeVWAP(candles);

    $('livePrice').textContent = fmt(st.ticker.price);
    const sign = st.ticker.change >= 0 ? '+' : '';
    const chEl = $('priceChange');
    chEl.textContent = `${sign}$${st.ticker.change.toFixed(2)} (${sign}${st.ticker.changePct.toFixed(2)}%)`;
    chEl.className = 'price-change ' + (st.ticker.change >= 0 ? 'pos' : 'neg');

    $('headerVwap').textContent = fmt(vwap.latest || st.ticker.price);
    const obiEl = $('headerObi');
    obiEl.textContent = `${st.obi >= 0 ? '+' : ''}${st.obi}%`;
    obiEl.style.color = st.obi >= 0 ? '#00e676' : '#ff4757';

    const dot = $('connDot');
    const pill = $('connStatus');
    if (st.connected && st.mode === 'LIVE') {
      dot.className = 'pulse-dot';
      pill.className = 'status-pill live';
      pill.textContent = 'LIVE (REST BINANCE)';
    } else {
      dot.className = 'pulse-dot sim';
      pill.className = 'status-pill sim';
      pill.textContent = 'SIMULATION MODE';
    }

    $('btnLiveMode').classList.toggle('active', st.mode === 'LIVE');
    $('btnSimMode').classList.toggle('active', st.mode === 'SIMULATION');
  }

  function renderBiasStripAndSummary() {
    const grid = $('tfSummaryGrid');
    grid.innerHTML = '';

    const labels = { '1m': '1-MINUTE (1m)', '5m': '5-MINUTE (5m)', '15m': '15-MINUTE (15m)', '4h': '4-HOUR (4h)' };

    window.DataEngine.TIMEFRAMES.forEach(tf => {
      const d = AppState.decisions[tf];
      const bull = d ? d.patterns.bullCount : 0;
      const bear = d ? d.patterns.bearCount : 0;
      const tot = bull + bear;
      const bullStr = d && bull ? ` (${d.patterns.bullAvgStr}%)` : '';
      const bearStr = d && bear ? ` (${d.patterns.bearAvgStr}%)` : '';

      // Update top bias strip
      const pill = document.querySelector(`[data-tf-bias="${tf}"]`);
      if (pill) {
        const biasTxt = d
          ? (d.score >= 18 ? 'BULLISH' : d.score <= -18 ? 'BEARISH' : 'NEUTRAL')
          : (bull > bear ? 'BULLISH' : bear > bull ? 'BEARISH' : 'NEUTRAL');
        pill.textContent = `${tf}: ${biasTxt}`;
        pill.className = 'bias-pill ' + biasTxt.toLowerCase();
      }

      const instObi = d ? d.obi.instant : 0;
      const avgObi = d ? d.obi.avg5 : 0;
      const posAvg = d ? d.obi.posAvg : 0;
      const negAvg = d ? d.obi.negAvg : 0;
      const instCls = instObi >= 0 ? 'txt-green' : 'txt-red';
      const avgCls = avgObi >= 0 ? 'txt-green' : 'txt-red';
      const vwapAbove = d ? d.trend.priceAboveVwap : true;
      const actionTxt = d ? d.action : 'WAIT';
      const actionCls = d ? d.actionClass : 'wait';

      // Render dashboard summary card with CENTER OBI CHIP + Per-TF Decision Pill
      const card = document.createElement('div');
      card.className = 'tf-card' + (tf === AppState.activeTf ? ' active' : '');
      card.innerHTML = `
        <div class="tf-card-top">
          <span>${labels[tf]}</span>
          <span class="tf-tot">TOT: ${tot}</span>
        </div>
        <div class="tf-obi-center">
          <div class="tf-obi-row">
            <span class="obi-chip-lbl">OBI INST</span>
            <strong class="${instCls}">${fmtSignedPct(instObi)}</strong>
            <span class="obi-sep">|</span>
            <span class="obi-chip-lbl">AVG(5)</span>
            <strong class="${avgCls}">${fmtSignedPct(avgObi)}</strong>
          </div>
          <div class="tf-obi-split">
            <span class="txt-green">+AVG: ${fmtSignedPct(posAvg)}</span>
            <span class="txt-red">-AVG: ${fmtSignedPct(negAvg)}</span>
          </div>
        </div>
        <div class="tf-card-counts">
          <span class="txt-green">BULL: ${bull}<small class="str-dim">${bullStr}</small></span>
          <span class="txt-red">BEAR: ${bear}<small class="str-dim">${bearStr}</small></span>
        </div>
        <div class="tf-card-footer">
          <span class="mini-vwap ${vwapAbove ? 'bull' : 'bear'}">VWAP ${vwapAbove ? '▲' : '▼'}</span>
          <span class="decision-pill sm ${actionCls}">${actionTxt}</span>
        </div>
      `;
      card.addEventListener('click', () => switchTimeframe(tf));
      grid.appendChild(card);
    });
  }

  function fmtSignedScore(val) {
    const num = Math.round(Number(val) || 0);
    return `${num >= 0 ? '+' : ''}${num}`;
  }

  function scoreColorCls(val) {
    return val >= 18 ? 'txt-green' : val <= -18 ? 'txt-red' : 'txt-amber';
  }

  function renderSmartActionMatrix() {
    const tbody = $('smartMatrixBody');
    if (!tbody) return;

    const master = window.Indicators.computeMasterMatrix(AppState.decisions);
    const vwapEl = $('masterVwapAlign');
    if (vwapEl) {
      vwapEl.textContent = `VWAP ALIGN: ${master.vwapAlignmentLabel}`;
      vwapEl.className = `vwap-align-pill ${master.vwapAlignmentClass}`;
    }

    const masterAvgEl = $('masterAvgPill');
    if (masterAvgEl) {
      const a5 = master.avgScore5 ?? master.score;
      const a14 = master.avgScore14 ?? master.score;
      masterAvgEl.innerHTML = `AVG(5): <strong class="${scoreColorCls(a5)}">${fmtSignedScore(a5)}</strong> · AVG(14): <strong class="${scoreColorCls(a14)}">${fmtSignedScore(a14)}</strong>`;
    }

    const masterEl = $('masterDecisionPill');
    if (masterEl) {
      masterEl.textContent = `MASTER: ${master.action} (${fmtSignedScore(master.score)})`;
      masterEl.className = `decision-pill ${master.actionClass}`;
    }

    tbody.innerHTML = '';
    window.DataEngine.TIMEFRAMES.forEach(tf => {
      const d = AppState.decisions[tf];
      if (!d) return;

      const instCls = d.obi.instant >= 0 ? 'txt-green' : 'txt-red';
      const avgCls = d.obi.avg5 >= 0 ? 'txt-green' : 'txt-red';
      const vwapCls = d.trend.priceAboveVwap ? 'txt-green' : 'txt-red';
      const emaCls = d.trend.emaBull ? 'txt-green' : 'txt-red';
      const rsiTxt = d.rsi.val !== null ? d.rsi.val.toFixed(1) : '--';
      const rsiCls = d.rsi.bull === true ? 'txt-green' : d.rsi.bull === false ? 'txt-red' : 'txt-gray';
      const macdCls = d.macd.bull ? 'txt-green' : 'txt-red';
      const scoreCls = scoreColorCls(d.score);
      const avg5Val = d.avgScore5 ?? d.score;
      const avg14Val = d.avgScore14 ?? d.score;

      const tr = document.createElement('tr');
      tr.className = tf === AppState.activeTf ? 'active-row' : '';
      tr.innerHTML = `
        <td><strong>${tf.toUpperCase()}</strong></td>
        <td><span class="decision-pill sm ${d.actionClass}">${d.action}</span></td>
        <td><span class="${instCls}">${fmtSignedPct(d.obi.instant)}</span> / <strong class="${avgCls}">${fmtSignedPct(d.obi.avg5)}</strong></td>
        <td><span class="txt-green">${fmtSignedPct(d.obi.posAvg)}</span> · <span class="txt-red">${fmtSignedPct(d.obi.negAvg)}</span></td>
        <td><span class="${vwapCls}">${d.trend.priceAboveVwap ? '▲ ABOVE' : '▼ BELOW'} (${fmtSignedPct(d.trend.vwapDiffPct)})</span> · <span class="${emaCls}">EMA ${d.trend.emaBull ? '▲' : '▼'}</span></td>
        <td><span class="${rsiCls}">RSI ${rsiTxt} ${d.rsi.bull === true ? '▲' : d.rsi.bull === false ? '▼' : ''}</span> · <span class="${macdCls}">MACD ${d.macd.bull ? '▲' : '▼'}</span></td>
        <td><span class="txt-green">${d.patterns.bullCount}B (${d.patterns.bullAvgStr}%)</span> / <span class="txt-red">${d.patterns.bearCount}S (${d.patterns.bearAvgStr}%)</span></td>
        <td><strong class="${scoreCls}">${fmtSignedScore(d.score)}</strong></td>
        <td><span class="avg-score-chip ${d.avg5Class || 'wait'}">${fmtSignedScore(avg5Val)}</span></td>
        <td><span class="avg-score-chip ${d.avg14Class || 'wait'}">${fmtSignedScore(avg14Val)}</span></td>
      `;
      tr.addEventListener('click', () => switchTimeframe(tf));
      tbody.appendChild(tr);
    });
  }

  function renderMainChartSection() {
    const candles = window.DataEngine.state.candles[AppState.activeTf] || [];
    if (!candles.length) return;

    const vwap = window.Indicators.computeVWAP(candles);
    const vpvr = window.Indicators.computeVPVR(candles);
    const srLevels = window.Indicators.computeSRLevels(candles);
    const activeMatch = getActivePatternForChart();
    const last = candles[candles.length - 1];
    const obi = window.DataEngine.state.obi;

    $('ohlcLeft').textContent = `${AppState.activeTf} | O: ${last.open.toFixed(1)}  H: ${last.high.toFixed(1)}  L: ${last.low.toFixed(1)}  C: ${last.close.toFixed(1)} | VOL: ${last.volume}`;
    $('ohlcRight').textContent = `BUY: ${last.buyVol}  SELL: ${last.sellVol} | NET Δ: ${last.delta >= 0 ? '+' : ''}${last.delta} | OBI: ${obi >= 0 ? '+' : ''}${obi}%`;

    const obiBadge = $('obiFloatingBadge');
    obiBadge.style.display = AppState.layers.obi ? 'block' : 'none';
    obiBadge.textContent = `OBI PRESSURE: ${obi >= 0 ? '+' : ''}${obi}%`;
    obiBadge.style.color = obi >= 0 ? '#00e676' : '#ff4757';

    const rsiData = window.Indicators.computeRSI(candles, 14, 14);
    const macdData = window.Indicators.computeMACD(candles, 12, 26, 9);
    const divergences = window.Indicators.detectDivergences(candles, rsiData.rsi);

    const dynamicMA = window.ConfluenceLab ? window.ConfluenceLab.getDynamicMA(AppState.activeTf) : null;
    const effectiveLayers = {
      ...AppState.layers,
      emaSr: AppState.layers.emaSr && (!window.ConfluenceLab || window.ConfluenceLab.config.showDynamicMAOnChart)
    };

    window.ChartRenderer.drawMainChart($('mainChartCanvas'), {
      candles, vwap, vpvr, srLevels, activeMatch, layers: effectiveLayers, divergences, dynamicMA
    });

    const rsiWrap = $('rsiPaneWrap');
    if (rsiWrap) {
      rsiWrap.style.display = AppState.layers.rsi ? 'block' : 'none';
      if (AppState.layers.rsi) {
        const rVal = rsiData.latestRsi !== null ? rsiData.latestRsi.toFixed(1) : '--';
        const mVal = rsiData.latestRsiMA !== null ? rsiData.latestRsiMA.toFixed(1) : '--';
        $('rsiReadout').textContent = `RSI(14): ${rVal} | RSI-MA(14): ${mVal}`;
        window.ChartRenderer.drawRsiPane($('rsiCanvas'), {
          candles, rsiData, divergences, showDiv: AppState.layers.rsiDiv
        });
      }
    }

    const macdWrap = $('macdPaneWrap');
    if (macdWrap) {
      macdWrap.style.display = AppState.layers.macd ? 'block' : 'none';
      if (AppState.layers.macd) {
        $('macdReadout').textContent = `MACD: ${macdData.latestMacd.toFixed(2)} | SIG: ${macdData.latestSignal.toFixed(2)} | HIST: ${macdData.latestHist >= 0 ? '+' : ''}${macdData.latestHist.toFixed(2)}`;
        window.ChartRenderer.drawMacdPane($('macdCanvas'), { candles, macdData });
      }
    }

    const strip = $('divAlertStrip');
    if (strip) {
      const pills = ['<span class="badge-tag">MOMENTUM &amp; DIVERGENCE</span>'];
      if (rsiData.latestRsi !== null && rsiData.latestRsiMA !== null) {
        const rsiBull = rsiData.latestRsi >= rsiData.latestRsiMA;
        pills.push(`<span class="div-pill ${rsiBull ? 'bull' : 'bear'}">RSI ${rsiData.latestRsi.toFixed(1)} ${rsiBull ? '▲ >' : '▼ <'} MA ${rsiData.latestRsiMA.toFixed(1)}</span>`);
      }
      const macdBull = macdData.latestHist >= 0;
      pills.push(`<span class="div-pill ${macdBull ? 'bull' : 'bear'}">MACD HIST ${macdData.latestHist >= 0 ? '+' : ''}${macdData.latestHist.toFixed(2)}</span>`);

      const latestRsiDiv = divergences.rsiDivs[divergences.rsiDivs.length - 1];
      const latestVolDiv = divergences.volDivs[divergences.volDivs.length - 1];
      if (latestRsiDiv) {
        pills.push(`<span class="div-pill ${latestRsiDiv.type === 'BULL' ? 'bull' : 'bear'}">⚡ ${latestRsiDiv.label}</span>`);
      }
      if (latestVolDiv) {
        pills.push(`<span class="div-pill ${latestVolDiv.type === 'BULL' ? 'bull' : 'bear'}">⚡ ${latestVolDiv.label}</span>`);
      }
      if (!latestRsiDiv && !latestVolDiv) {
        pills.push('<span class="div-pill info">No Active Divergence on Current Window</span>');
      }
      strip.innerHTML = pills.join('');
    }

    // Update Active Pattern Footer Bar
    if (activeMatch) {
      const p = activeMatch.pattern;
      const t = activeMatch.targets;
      const isBear = p.bias === 'BEARISH';
      const dirSym = isBear ? '▼' : '▲';
      const cls = isBear ? 'txt-red' : 'txt-green';

      const confBadge = activeMatch.confluenceMeta
        ? ` <span class="decision-pill sm ${activeMatch.confluenceMeta.verdict.cls}">LAB ${activeMatch.confluenceMeta.confluencePct}%</span>`
        : '';
      $('apName').innerHTML = `<strong>#${p.id} ${p.name}</strong> <span class="bias-badge ${p.bias}">${p.bias}</span> <span class="tf-mini">${activeMatch.tf}</span>${confBadge}`;
      $('apFibSummary').innerHTML = `
        <span class="ap-fib-chip">Entry: <strong>${fmt(t.entry)}</strong></span>
        <span class="ap-fib-chip ${cls}">${dirSym} TP1: <strong>${fmt(t.tp1)}</strong> (${t.tp1Pct}%)</span>
        <span class="ap-fib-chip ${cls}">${dirSym} TP2: <strong>${fmt(t.tp2)}</strong> (${t.tp2Pct}%)</span>
        <span class="ap-fib-chip txt-amber">SL: <strong>${fmt(t.sl)}</strong></span>
      `;
      $('apScore').textContent = `${activeMatch.greenCount}/${activeMatch.totalDots} PASS · ${activeMatch.overallPct}%`;
      $('btnUnpin').style.display = AppState.pinnedUid ? 'inline-block' : 'none';
    }
  }

  function getFilteredLibraryList() {
    let items = [];
    const tfs = AppState.libTf === 'ALL' ? window.DataEngine.TIMEFRAMES : [AppState.libTf];
    tfs.forEach(tf => { items = items.concat(AppState.evaluations[tf] || []); });

    const q = AppState.libSearch.trim().toLowerCase();
    return items.filter(e => {
      if (AppState.libBias !== 'BOTH' && e.pattern.bias !== AppState.libBias) return false;
      if (AppState.hideRejected && e.hasRed) return false;
      if (e.overallPct < AppState.libMinMatch) return false;
      if (q && !e.pattern.name.toLowerCase().includes(q) && !e.pattern.category.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => b.overallPct - a.overallPct || a.pattern.id - b.pattern.id);
  }

  function renderPatternLibrary() {
    const list = getFilteredLibraryList();
    const bullCnt = list.filter(e => e.pattern.bias === 'BULLISH').length;
    const bearCnt = list.filter(e => e.pattern.bias === 'BEARISH').length;

    $('cntTotal').textContent = list.length;
    $('cntBull').textContent = bullCnt;
    $('cntBear').textContent = bearCnt;

    const grid = $('patternGrid');
    grid.innerHTML = '';

    const slice = list.slice(0, AppState.visibleCards);
    slice.forEach(ev => {
      const p = ev.pattern;
      const t = ev.targets;
      const isBear = p.bias === 'BEARISH';
      const dirSym = isBear ? '▼' : '▲';
      const targetCls = isBear ? 'txt-red' : 'txt-green';

      const card = document.createElement('div');
      card.className = 'p-card';
      card.innerHTML = `
        <div class="p-card-head">
          <div class="p-badges">
            <span class="tf-mini">${ev.tf}</span>
            <span class="bias-badge ${p.bias}">${p.bias}</span>
            <span class="p-id">#${p.id}</span>
          </div>
          <span class="p-pct ${ev.overallPct === 0 ? 'zero' : ''}">${ev.overallPct}%</span>
        </div>
        <div class="p-name">${p.name}</div>
        <div class="p-meta">
          <span>${p.category} · ${t.rule}</span>
          <span class="txt-green">${ev.greenCount}/${ev.totalDots} GREEN</span>
        </div>
        <div class="p-spark-wrap"><canvas></canvas></div>
        <div class="p-fib-box">
          <div class="p-fib-item"><span>ENTRY / PRZ</span><strong>${fmt(t.entry)}</strong></div>
          <div class="p-fib-item"><span>${dirSym} TP1 (${t.tp1Pct}%)</span><strong class="${targetCls}">${fmt(t.tp1)}</strong></div>
          <div class="p-fib-item"><span>${dirSym} TP2 (${t.tp2Pct}%)</span><strong class="${targetCls}">${fmt(t.tp2)}</strong></div>
        </div>
        <div class="p-dots-row">
          ${ev.dots.map(d => {
            const cls = d.status === 'PASS' ? 'pass' : d.status === 'FAIL' ? 'fail' : 'wait';
            const txt = d.status === 'WAIT' ? `${d.label} WAIT` : `${d.label} ${d.score}%`;
            return `<span class="dot-chip ${cls}">${txt}</span>`;
          }).join('')}
        </div>
        <div class="p-actions">
          <button class="inspect">INSPECT</button>
          <button class="pin">PIN TO CHART</button>
        </div>
      `;

      grid.appendChild(card);
      const miniCanvas = card.querySelector('canvas');
      window.ChartRenderer.drawMiniPattern(miniCanvas, ev);

      card.querySelector('.inspect').addEventListener('click', () => openInspectModal(ev));
      card.querySelector('.pin').addEventListener('click', () => pinPatternToChart(ev));
    });

    const loadBtn = $('btnLoadMore');
    loadBtn.style.display = list.length > AppState.visibleCards ? 'inline-block' : 'none';
  }

  function openInspectModal(ev) {
    if (!ev) return;
    AppState.inspectedObj = ev;
    const p = ev.pattern;
    const t = ev.targets;
    const isBear = p.bias === 'BEARISH';
    const cls = isBear ? 'txt-red' : 'txt-green';

    $('mCategory').textContent = `${p.category.toUpperCase()} · ${ev.tf}`;
    const bEl = $('mBias');
    bEl.textContent = p.bias;
    bEl.className = 'bias-badge ' + p.bias;
    $('mTitle').textContent = `#${p.id} ${p.name} (${ev.overallPct}% Match)`;

    $('mFibGrid').innerHTML = `
      <div class="m-fib-card"><span>ENTRY / PRZ</span><strong>${fmt(t.entry)}</strong></div>
      <div class="m-fib-card"><span>TP1 (${t.tp1Pct}%)</span><strong class="${cls}">${fmt(t.tp1)}</strong></div>
      <div class="m-fib-card"><span>TP2 (${t.tp2Pct}%)</span><strong class="${cls}">${fmt(t.tp2)}</strong></div>
      <div class="m-fib-card"><span>STOP LOSS (R:R ${t.rr})</span><strong class="txt-amber">${fmt(t.sl)}</strong></div>
    `;
    $('mDesc').innerHTML = `<strong>Verified Rule (${t.rule}):</strong> ${p.desc}`;
    $('mPoints').innerHTML = ev.dots.map(d => {
      const c = d.status === 'PASS' ? 'pass' : d.status === 'FAIL' ? 'fail' : 'wait';
      return `<span class="dot-chip ${c}">${d.label}: ${d.status === 'WAIT' ? 'AWAITING' : d.score + '%'} (${fmt(d.price)})</span>`;
    }).join('');

    $('inspectModal').style.display = 'flex';
    window.ChartRenderer.drawModalPattern($('modalCanvas'), ev);
  }

  function closeInspectModal() {
    $('inspectModal').style.display = 'none';
  }

  function pinPatternToChart(ev) {
    AppState.pinnedUid = ev.uid;
    AppState.activeTf = ev.tf;
    switchTab('terminal');
    syncTfButtons();
    renderAll();
  }

  function renderConfluenceLab() {
    if (!window.ConfluenceLab) return;
    window.ConfluenceLab.renderLabTab($('tab-confluence'), {
      activeTf: AppState.activeTf,
      onPin: ev => pinPatternToChart(ev),
      onInspect: ev => openInspectModal(ev),
      onSwitchTf: tf => switchTimeframe(tf)
    });
  }

  function switchTab(tabName) {
    AppState.activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabName));
    if (tabName === 'terminal') renderMainChartSection();
    if (tabName === 'library') renderPatternLibrary();
    if (tabName === 'confluence') renderConfluenceLab();
  }

  function syncTfButtons() {
    document.querySelectorAll('#mainTfButtons .tf-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tf === AppState.activeTf);
    });
  }

  function switchTimeframe(tf) {
    AppState.activeTf = tf;
    syncTfButtons();
    renderAll();
  }

  function renderAll() {
    runSmartDecisions();
    renderHeader();
    renderBiasStripAndSummary();
    renderSmartActionMatrix();
    if (AppState.activeTab === 'terminal') renderMainChartSection();
    if (AppState.activeTab === 'library') renderPatternLibrary();
    if (AppState.activeTab === 'confluence') renderConfluenceLab();
  }

  async function refreshCycle() {
    await window.DataEngine.refreshAll();
    runAllEvaluations();
    renderAll();
  }

  function bindEvents() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Timeframe buttons
    document.querySelectorAll('#mainTfButtons .tf-btn').forEach(btn => {
      btn.addEventListener('click', () => switchTimeframe(btn.dataset.tf));
    });

    // Live / Sim / Retry / Sonar
    $('btnLiveMode').addEventListener('click', () => {
      window.DataEngine.setMode('LIVE');
      refreshCycle();
    });
    $('btnSimMode').addEventListener('click', () => {
      window.DataEngine.setMode('SIMULATION');
      refreshCycle();
    });
    $('btnRetry').addEventListener('click', () => refreshCycle());
    $('btnSonar').addEventListener('click', function () {
      AppState.sonarOn = !AppState.sonarOn;
      this.classList.toggle('active', AppState.sonarOn);
      this.textContent = AppState.sonarOn ? 'SONAR ON' : 'SONAR OFF';
    });

    // Dashboard Min Match slider
    $('dashMinMatch').addEventListener('input', e => {
      AppState.dashMinMatch = parseInt(e.target.value, 10);
      $('dashMinMatchVal').textContent = AppState.dashMinMatch + '%+';
      runSmartDecisions();
      renderBiasStripAndSummary();
      renderSmartActionMatrix();
      renderMainChartSection();
    });

    // Chart Layer toggles
    document.querySelectorAll('.layer-toggles .toggle-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.layer;
        AppState.layers[key] = !AppState.layers[key];
        btn.classList.toggle('active', AppState.layers[key]);
        renderMainChartSection();
      });
    });

    // Active Pattern Bar buttons
    $('btnInspectActive').addEventListener('click', () => openInspectModal(getActivePatternForChart()));
    $('btnUnpin').addEventListener('click', () => {
      AppState.pinnedUid = null;
      renderMainChartSection();
    });

    // Library Filters
    document.querySelectorAll('#libTfFilter .f-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#libTfFilter .f-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.libTf = btn.dataset.ltf;
        AppState.visibleCards = 24;
        renderPatternLibrary();
      });
    });

    document.querySelectorAll('#libBiasFilter .f-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#libBiasFilter .f-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        AppState.libBias = btn.dataset.bias;
        AppState.visibleCards = 24;
        renderPatternLibrary();
      });
    });

    $('libSearch').addEventListener('input', e => {
      AppState.libSearch = e.target.value;
      AppState.visibleCards = 24;
      renderPatternLibrary();
    });

    $('libMinMatch').addEventListener('input', e => {
      AppState.libMinMatch = parseInt(e.target.value, 10);
      $('libMinMatchVal').textContent = AppState.libMinMatch + '%+';
      document.querySelectorAll('.q-pct').forEach(b => b.classList.toggle('active', parseInt(b.dataset.pct, 10) === AppState.libMinMatch));
      renderPatternLibrary();
    });

    document.querySelectorAll('.q-pct').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.pct, 10);
        AppState.libMinMatch = val;
        $('libMinMatch').value = val;
        $('libMinMatchVal').textContent = val + '%+';
        document.querySelectorAll('.q-pct').forEach(b => b.classList.toggle('active', b === btn));
        renderPatternLibrary();
      });
    });

    $('btnHideRejected').addEventListener('click', function () {
      AppState.hideRejected = !AppState.hideRejected;
      this.classList.toggle('active', AppState.hideRejected);
      this.textContent = `HIDE REJECTED (0%): ${AppState.hideRejected ? 'ON' : 'OFF'}`;
      renderPatternLibrary();
    });

    $('btnLoadMore').addEventListener('click', () => {
      AppState.visibleCards += 24;
      renderPatternLibrary();
    });

    // Modal events
    $('mClose').addEventListener('click', closeInspectModal);
    $('mCloseBtn').addEventListener('click', closeInspectModal);
    $('mPinBtn').addEventListener('click', () => {
      if (AppState.inspectedObj) pinPatternToChart(AppState.inspectedObj);
      closeInspectModal();
    });
    $('inspectModal').addEventListener('click', e => {
      if (e.target.id === 'inspectModal') closeInspectModal();
    });

    window.addEventListener('resize', () => {
      if (AppState.activeTab === 'terminal') renderMainChartSection();
    });
  }

  // Boot
  if (window.ConfluenceLab) {
    window.ConfluenceLab.onConfigChange(() => renderAll());
  }
  bindEvents();
  refreshCycle();
  setInterval(() => {
    if (AppState.sonarOn) refreshCycle();
  }, 5000);
})();
