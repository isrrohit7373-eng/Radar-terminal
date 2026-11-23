/**
 * js/chartRenderer.js
 * Renders:
 * 1. Main Candlestick Chart + VPVR + VWAP + S/R + Candle Delta + 123 Geo Pattern
 *    + Shaded Red/Green Fibonacci Target Zone with Directional Arrow & Live Prices.
 * 2. Pattern Library Card Sparklines (with projected direction arrow).
 * 3. Pattern Inspector Modal Chart.
 */
window.ChartRenderer = (function () {

  // Smooth Zoom & Pan viewport state for Main Chart (synced with RSI & MACD panes)
  const viewState = {
    visibleCount: 72,
    rightOffset: 0,
    minVisible: 20,
    maxVisible: 200,
    defaultVisible: 72,
    lastTotalCandles: 72
  };

  function getViewWindow(totalCandles) {
    const n = totalCandles || 0;
    viewState.lastTotalCandles = n;
    if (!n) return { visibleCount: 0, startIdx: 0, endIdx: 0, rightOffset: 0 };
    const minV = Math.min(viewState.minVisible, n);
    const maxV = Math.min(viewState.maxVisible, n);
    const visCount = Math.max(minV, Math.min(maxV, Math.round(viewState.visibleCount)));
    const maxOffset = Math.max(0, n - visCount);
    const rOff = Math.max(0, Math.min(maxOffset, Math.round(viewState.rightOffset)));
    viewState.rightOffset = rOff;
    const endIdx = n - rOff;
    const startIdx = Math.max(0, endIdx - visCount);
    return { visibleCount: endIdx - startIdx, startIdx, endIdx, rightOffset: rOff };
  }

  function updateZoomHud() {
    const statusEl = document.getElementById('chartZoomStatus');
    const resetEl = document.getElementById('btnResetZoom');
    const isDefault = Math.round(viewState.visibleCount) === viewState.defaultVisible && Math.round(viewState.rightOffset) === 0;
    if (statusEl) {
      const bars = Math.round(Math.min(viewState.lastTotalCandles || viewState.visibleCount, viewState.visibleCount));
      const panTxt = Math.round(viewState.rightOffset) > 0 ? `-${Math.round(viewState.rightOffset)} BARS` : 'LIVE';
      statusEl.textContent = `${bars} BARS · ${panTxt}`;
    }
    if (resetEl) {
      resetEl.style.display = isDefault ? 'none' : 'inline-block';
    }
  }

  function resetView(onUpdate) {
    viewState.visibleCount = viewState.defaultVisible;
    viewState.rightOffset = 0;
    updateZoomHud();
    if (typeof onUpdate === 'function') onUpdate();
  }

  function bindZoomPan(canvas, onUpdate) {
    if (!canvas || canvas.dataset.zoomPanBound === '1') return;
    canvas.dataset.zoomPanBound = '1';

    let rafId = null;
    const scheduleRedraw = () => {
      updateZoomHud();
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (typeof onUpdate === 'function') onUpdate();
      });
    };

    // Inertia animation for smooth iPad touch swipe
    let inertiaId = null;
    const stopInertia = () => {
      if (inertiaId) {
        cancelAnimationFrame(inertiaId);
        inertiaId = null;
      }
    };

    const clampViewport = () => {
      const n = Math.max(viewState.minVisible, viewState.lastTotalCandles || 72);
      const minV = Math.min(viewState.minVisible, n);
      const maxV = Math.min(viewState.maxVisible, n);
      viewState.visibleCount = Math.max(minV, Math.min(maxV, viewState.visibleCount));
      const maxOff = Math.max(0, n - Math.round(viewState.visibleCount));
      viewState.rightOffset = Math.max(0, Math.min(maxOff, viewState.rightOffset));
    };

    const getPxPerBar = () => {
      const rect = canvas.getBoundingClientRect();
      const plotW = Math.max(120, rect.width - 108);
      const slots = viewState.visibleCount + (viewState.rightOffset === 0 ? 18 : 2);
      return plotW / Math.max(10, slots);
    };

    // --- TOUCH (iPad Pinch-to-Zoom + 1-Finger Pan + Double-Tap Reset) ---
    let touchMode = null; // 'pan' | 'pinch'
    let startX = 0;
    let startRightOffset = 0;
    let lastX = 0;
    let lastTime = 0;
    let velocityBarsPerFrame = 0;
    let pinchStartDist = 0;
    let pinchStartVis = 72;
    let pinchStartOffset = 0;
    let lastTapTime = 0;

    const getTouchDist = (t1, t2) => Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    canvas.addEventListener('touchstart', e => {
      stopInertia();
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - lastTapTime < 280) {
          e.preventDefault();
          lastTapTime = 0;
          resetView(onUpdate);
          return;
        }
        lastTapTime = now;
        touchMode = 'pan';
        startX = e.touches[0].clientX;
        lastX = startX;
        lastTime = performance.now();
        velocityBarsPerFrame = 0;
        startRightOffset = viewState.rightOffset;
      } else if (e.touches.length === 2) {
        e.preventDefault();
        touchMode = 'pinch';
        pinchStartDist = Math.max(10, getTouchDist(e.touches[0], e.touches[1]));
        pinchStartVis = viewState.visibleCount;
        pinchStartOffset = viewState.rightOffset;
      }
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      if (touchMode === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const curX = e.touches[0].clientX;
        const now = performance.now();
        const dx = curX - startX;
        const pxPerBar = getPxPerBar();
        const deltaBars = dx / Math.max(2, pxPerBar);
        viewState.rightOffset = startRightOffset + deltaBars;
        clampViewport();

        const dt = Math.max(4, now - lastTime);
        const stepBars = (curX - lastX) / Math.max(2, pxPerBar);
        velocityBarsPerFrame = (stepBars / dt) * 16;
        lastX = curX;
        lastTime = now;
        scheduleRedraw();
      } else if (touchMode === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const curDist = Math.max(10, getTouchDist(e.touches[0], e.touches[1]));
        const scale = pinchStartDist / curDist; // pinch out -> fewer bars (zoom in)
        const nextVis = pinchStartVis * scale;
        const deltaVis = nextVis - pinchStartVis;
        viewState.visibleCount = nextVis;
        // Keep center anchor balanced while zooming
        viewState.rightOffset = Math.max(0, pinchStartOffset - deltaVis * 0.35);
        clampViewport();
        scheduleRedraw();
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      if (e.touches.length === 0) {
        if (touchMode === 'pan' && Math.abs(velocityBarsPerFrame) > 0.15) {
          let v = Math.max(-8, Math.min(8, velocityBarsPerFrame));
          const step = () => {
            v *= 0.90;
            if (Math.abs(v) < 0.05) {
              inertiaId = null;
              return;
            }
            viewState.rightOffset += v;
            clampViewport();
            scheduleRedraw();
            inertiaId = requestAnimationFrame(step);
          };
          inertiaId = requestAnimationFrame(step);
        }
        touchMode = null;
      } else if (e.touches.length === 1) {
        // Transition smoothly from pinch back to 1-finger pan
        touchMode = 'pan';
        startX = e.touches[0].clientX;
        lastX = startX;
        startRightOffset = viewState.rightOffset;
        velocityBarsPerFrame = 0;
      }
    }, { passive: true });

    // --- DESKTOP MOUSE WHEEL / TRACKPAD PINCH ZOOM ---
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      stopInertia();
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && !e.ctrlKey) {
        // Horizontal two-finger trackpad scroll -> pan
        const pxPerBar = getPxPerBar();
        viewState.rightOffset -= (e.deltaX / Math.max(2, pxPerBar)) * 0.6;
      } else {
        const factor = e.deltaY > 0 ? 1.12 : 0.89;
        viewState.visibleCount *= factor;
      }
      clampViewport();
      scheduleRedraw();
    }, { passive: false });

    // --- DESKTOP MOUSE DRAG PAN ---
    let dragging = false;
    let dragStartX = 0;
    let dragStartOff = 0;

    canvas.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      stopInertia();
      dragging = true;
      dragStartX = e.clientX;
      dragStartOff = viewState.rightOffset;
      canvas.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - dragStartX;
      const pxPerBar = getPxPerBar();
      viewState.rightOffset = dragStartOff + dx / Math.max(2, pxPerBar);
      clampViewport();
      scheduleRedraw();
    });

    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      canvas.classList.remove('is-dragging');
    });

    canvas.addEventListener('dblclick', () => resetView(onUpdate));
    updateZoomHud();
  }


  function fmtPrice(p) {
    return '$' + Number(p).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function drawArrow(ctx, x1, y1, x2, y2, color, width = 2.5) {
    const headLen = 10;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMainChart(canvas, opts) {
    const { candles, vwap, vpvr, srLevels, activeMatch, layers } = opts;
    if (!canvas || !candles || !candles.length) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(300, rect.width);
    const H = Math.max(260, rect.height);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#060a11';
    ctx.fillRect(0, 0, W, H);

    const padL = 12;
    const padR = 96;   // Right price axis
    const padT = 20;
    const padB = 26;
    const vw = getViewWindow(candles.length);
    const visibleCount = vw.visibleCount;
    const startIdx = vw.startIdx;
    const endIdx = vw.endIdx;
    const forecastSlots = vw.rightOffset === 0 ? 18 : 2; // Extra space on right when live
    const vis = candles.slice(startIdx, endIdx);
    const vwapVis = vwap && vwap.series ? vwap.series.slice(startIdx, endIdx) : [];
    updateZoomHud();

    // Compute Y price bounds including Fib Targets if active
    let minP = Infinity, maxP = -Infinity;
    vis.forEach(c => {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
    });

    if (layers.fib && activeMatch && activeMatch.targets && vw.rightOffset === 0) {
      const t = activeMatch.targets;
      minP = Math.min(minP, t.tp1, t.tp2, t.sl);
      maxP = Math.max(maxP, t.tp1, t.tp2, t.sl);
    }

    const pricePad = Math.max(10, (maxP - minP) * 0.08);
    minP -= pricePad;
    maxP += pricePad;

    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const stepX = plotW / (visibleCount + forecastSlots);

    const xOfVis = i => padL + (i + 0.5) * stepX;
    const xOfGlobal = gIdx => padL + (gIdx - startIdx + 0.5) * stepX;
    const yOf = p => padT + ((maxP - p) / Math.max(1e-6, maxP - minP)) * plotH;

    // 1. Subtle Grid + Right Axis Labels
    ctx.strokeStyle = 'rgba(30, 45, 68, 0.45)';
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = '#7f94b0';
    const gridRows = 6;
    for (let r = 0; r <= gridRows; r++) {
      const p = minP + ((maxP - minP) * r) / gridRows;
      const y = yOf(p);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.fillText(p.toFixed(1), W - padR + 8, y + 3);
    }

    // 2. VPVR Histogram (right edge of plot area)
    if (layers.vpvr && vpvr && vpvr.buckets.length) {
      const maxBarW = Math.min(95, plotW * 0.16);
      const binH = Math.max(2, plotH / vpvr.buckets.length - 1);
      vpvr.buckets.forEach(b => {
        const y = yOf(b.priceMid) - binH / 2;
        const totW = (b.totalVol / vpvr.maxVol) * maxBarW;
        const buyW = (b.buyVol / Math.max(0.0001, b.totalVol)) * totW;
        const sellW = totW - buyW;
        const rightX = W - padR;

        ctx.fillStyle = 'rgba(0, 230, 118, 0.24)';
        ctx.fillRect(rightX - totW, y, buyW, binH);
        ctx.fillStyle = 'rgba(255, 71, 87, 0.24)';
        ctx.fillRect(rightX - sellW, y, sellW, binH);
      });
    }

    // 3. Support / Resistance Horizontal Levels
    if (layers.sr && srLevels && srLevels.length) {
      srLevels.forEach(lvl => {
        if (lvl.price < minP || lvl.price > maxP) return;
        const y = yOf(lvl.price);
        const isRes = lvl.type === 'RES';
        ctx.save();
        ctx.strokeStyle = isRes ? 'rgba(255, 71, 87, 0.55)' : 'rgba(0, 230, 118, 0.55)';
        ctx.fillStyle = isRes ? 'rgba(255, 71, 87, 0.12)' : 'rgba(0, 230, 118, 0.12)';
        ctx.fillRect(padL, y - 5, plotW, 10);
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = isRes ? '#ff6b81' : '#2ed573';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`${lvl.label} $${lvl.price.toFixed(0)} · ${lvl.strength}%`, padL + 6, y - 7);
        ctx.restore();
      });
    }

    // 4. Candlesticks + Optional Delta Markers
    const candleW = Math.max(3, Math.min(11, stepX * 0.68));
    vis.forEach((c, i) => {
      const x = xOfVis(i);
      const yO = yOf(c.open);
      const yC = yOf(c.close);
      const yH = yOf(c.high);
      const yL = yOf(c.low);
      const up = c.close >= c.open;
      const color = up ? '#00e676' : '#ff4757';

      // Wick
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, yH);
      ctx.lineTo(x, yL);
      ctx.stroke();

      // Body
      const top = Math.min(yO, yC);
      const h = Math.max(1.5, Math.abs(yC - yO));
      ctx.fillStyle = color;
      ctx.fillRect(x - candleW / 2, top, candleW, h);

      // Delta tag on significant candles
      if (layers.delta && i % 7 === 0) {
        ctx.font = '9px monospace';
        ctx.fillStyle = c.delta >= 0 ? 'rgba(0,230,118,0.8)' : 'rgba(255,71,87,0.8)';
        const dTxt = (c.delta >= 0 ? '+' : '') + c.delta.toFixed(0);
        ctx.fillText(dTxt, x - 9, up ? yH - 4 : yL + 10);
      }
    });

    // 5. VWAP Line
    if (layers.vwap && vwapVis.length) {
      ctx.save();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      vwapVis.forEach((v, i) => {
        const x = xOfVis(i);
        const y = yOf(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 5B. DYNAMIC MOVING AVERAGE S/R OVERLAY (from Confluence Lab)
    if (layers.emaSr && opts.dynamicMA && opts.dynamicMA.fastSeries && opts.dynamicMA.fastSeries.length) {
      const drawEmaLine = (series, color, dash, labelTxt) => {
        const sub = series.slice(startIdx, endIdx);
        if (!sub.length) return;
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.35;
        if (dash) ctx.setLineDash(dash);
        ctx.beginPath();
        let started = false;
        let lastX = 0, lastY = 0;
        sub.forEach((v, i) => {
          if (v === null || v === undefined) return;
          const x = xOfVis(i);
          const y = yOf(v);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
          lastX = x; lastY = y;
        });
        ctx.stroke();
        ctx.setLineDash([]);
        if (started && labelTxt) {
          ctx.fillStyle = color;
          ctx.font = 'bold 9px monospace';
          ctx.fillText(labelTxt, Math.min(W - padR - 42, lastX + 4), lastY + 3);
        }
        ctx.restore();
      };
      drawEmaLine(opts.dynamicMA.fastSeries, '#38bdf8', null, `E${opts.dynamicMA.fastPeriod}`);
      drawEmaLine(opts.dynamicMA.slowSeries, '#c084fc', [4, 3], `E${opts.dynamicMA.slowPeriod}`);
      drawEmaLine(opts.dynamicMA.trendSeries, 'rgba(248, 250, 252, 0.45)', [2, 4], `E${opts.dynamicMA.trendPeriod}`);
    }

    // 6. 123 GEO PATTERN OVERLAY
    if (layers.geo && activeMatch && activeMatch.dots.length) {
      ctx.save();
      ctx.strokeStyle = activeMatch.pattern.bias === 'BULLISH' ? '#22d3ee' : '#f472b6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      activeMatch.dots.forEach(d => {
        const x = Math.min(W - padR - 14, Math.max(padL + 6, xOfGlobal(d.index)));
        const y = yOf(d.price);
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      activeMatch.dots.forEach(d => {
        const x = Math.min(W - padR - 14, Math.max(padL + 6, xOfGlobal(d.index)));
        const y = yOf(d.price);
        const fill = d.status === 'PASS' ? '#00e676' : d.status === 'FAIL' ? '#ff4757' : '#94a3b8';

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = '#060a11';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#0d1420';
        const tag = d.status === 'WAIT' ? `${d.label} WAIT` : `${d.label} ${d.score}%`;
        const tw = ctx.measureText(tag).width + 8;
        ctx.fillRect(x - tw / 2, y - 22, tw, 14);
        ctx.strokeStyle = fill;
        ctx.lineWidth = 1;
        ctx.strokeRect(x - tw / 2, y - 22, tw, 14);
        ctx.fillStyle = fill;
        ctx.font = 'bold 9px monospace';
        ctx.fillText(tag, x - tw / 2 + 4, y - 12);
      });
      ctx.restore();
    }

    // 7. LIVE FIBONACCI TARGET ZONE (RED AREA + RED DOWN ARROW / GREEN AREA + GREEN UP ARROW)
    if (layers.fib && activeMatch && activeMatch.targets && vw.rightOffset === 0) {
      const t = activeMatch.targets;
      const isBear = activeMatch.pattern.bias === 'BEARISH';
      const mainColor = isBear ? '#ff4757' : '#00e676';
      const fillZone = isBear ? 'rgba(255, 71, 87, 0.16)' : 'rgba(0, 230, 118, 0.16)';
      const fillDeep = isBear ? 'rgba(255, 71, 87, 0.26)' : 'rgba(0, 230, 118, 0.26)';

      const xStart = xOfVis(vis.length - 1);
      const xEnd = W - padR - 8;
      const zoneW = Math.max(50, xEnd - xStart);

      const yEntry = yOf(t.entry);
      const yTp1 = yOf(t.tp1);
      const yTp2 = yOf(t.tp2);
      const ySl = yOf(t.sl);

      ctx.save();

      // Shaded Target Area (Entry -> TP2)
      ctx.fillStyle = fillZone;
      ctx.fillRect(xStart, Math.min(yEntry, yTp2), zoneW, Math.abs(yTp2 - yEntry));

      // Stronger shaded core between TP1 -> TP2
      ctx.fillStyle = fillDeep;
      ctx.fillRect(xStart, Math.min(yTp1, yTp2), zoneW, Math.abs(yTp2 - yTp1));

      // Border around target box
      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(xStart, Math.min(yEntry, yTp2), zoneW, Math.abs(yTp2 - yEntry));

      // TP1 Horizontal Dashed Line
      ctx.beginPath();
      ctx.moveTo(xStart, yTp1);
      ctx.lineTo(xEnd, yTp1);
      ctx.stroke();

      // Stop-Loss Line
      ctx.strokeStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(xStart, ySl);
      ctx.lineTo(xEnd, ySl);
      ctx.stroke();
      ctx.setLineDash([]);

      // Bold Directional Arrow (Red Downward for Bearish, Green Upward for Bullish)
      const arrowX = xStart + Math.min(26, zoneW * 0.22);
      drawArrow(ctx, arrowX, yEntry, arrowX, yTp2, mainColor, 3);

      // Price & Percentage Labels
      const dirSym = isBear ? '▼' : '▲';
      const labelX = arrowX + 10;

      ctx.font = 'bold 10px monospace';
      // TP1 Pill
      ctx.fillStyle = '#080e18';
      ctx.fillRect(labelX - 3, yTp1 - 11, Math.min(zoneW - 22, 165), 14);
      ctx.fillStyle = mainColor;
      ctx.fillText(`${dirSym} TP1 ${fmtPrice(t.tp1)} (${t.tp1Pct > 0 ? '+' : ''}${t.tp1Pct}%)`, labelX, yTp1);

      // TP2 Pill
      const tp2LabelY = isBear ? yTp2 + 12 : yTp2 - 4;
      ctx.fillStyle = '#080e18';
      ctx.fillRect(labelX - 3, tp2LabelY - 11, Math.min(zoneW - 22, 165), 14);
      ctx.fillStyle = mainColor;
      ctx.fillText(`${dirSym} TP2 ${fmtPrice(t.tp2)} (${t.tp2Pct > 0 ? '+' : ''}${t.tp2Pct}%)`, labelX, tp2LabelY);

      // SL Label
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(`SL ${fmtPrice(t.sl)}`, labelX, isBear ? ySl - 4 : ySl + 11);

      ctx.restore();
    }


    // 7B. DIVERGENCE OVERLAYS ON MAIN CHART (RSI DIV & VOLUME-PRICE DIV)
    if (opts.divergences) {
      const drawDivSet = (list, isVol) => {
        list.forEach(d => {
          if (d.idx2 < startIdx) return;
          const x1 = Math.max(padL + 4, xOfGlobal(d.idx1));
          const x2 = Math.min(W - padR - 6, xOfGlobal(d.idx2));
          const y1 = yOf(d.price1);
          const y2 = yOf(d.price2);
          const isBull = d.type === 'BULL';
          const col = isVol
            ? (isBull ? '#22d3ee' : '#f59e0b')
            : (isBull ? '#00e676' : '#ff4757');

          ctx.save();
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.setLineDash(isVol ? [3, 3] : [6, 3]);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.font = 'bold 9px monospace';
          const tw = ctx.measureText(d.label).width + 8;
          const badgeY = isBull ? Math.min(H - padB - 14, y2 + 12) : Math.max(padT + 12, y2 - 16);
          ctx.fillStyle = '#080e18';
          ctx.fillRect(x2 - tw / 2, badgeY - 10, tw, 13);
          ctx.strokeStyle = col;
          ctx.lineWidth = 1;
          ctx.strokeRect(x2 - tw / 2, badgeY - 10, tw, 13);
          ctx.fillStyle = col;
          ctx.fillText(d.label, x2 - tw / 2 + 4, badgeY);
          ctx.restore();
        });
      };
      if (layers.rsiDiv && opts.divergences.rsiDivs) drawDivSet(opts.divergences.rsiDivs, false);
      if (layers.volDiv && opts.divergences.volDivs) drawDivSet(opts.divergences.volDivs, true);
    }

    // 8. Live Current Price Line & Tag on Right Axis
    const lastPrice = vis[vis.length - 1].close;
    const yNow = yOf(lastPrice);
    ctx.save();
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, yNow);
    ctx.lineTo(W - padR, yNow);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(W - padR + 2, yNow - 9, padR - 4, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(lastPrice.toFixed(1), W - padR + 7, yNow + 3);
    ctx.restore();
  }

  /**
   * Renders mini pattern sparkline inside each 123 Pattern Library card
   * including a projected target arrow (Green UP / Red DOWN).
   */
  function drawMiniPattern(canvas, evalObj) {
    if (!canvas || !evalObj) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 260;
    const H = canvas.clientHeight || 82;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const dots = evalObj.dots;
    const isBear = evalObj.pattern.bias === 'BEARISH';
    const padX = 16;
    const padY = 14;
    const usableW = W - padX * 2 - 36; // Reserve right 36px for target arrow
    const usableH = H - padY * 2;

    const coords = dots.map((d, i) => ({
      x: padX + (i / Math.max(1, dots.length - 1)) * usableW,
      y: padY + (1 - d.normY) * usableH,
      status: d.status
    }));

    // Connecting line
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    coords.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Dots
    coords.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.status === 'PASS' ? '#00e676' : p.status === 'FAIL' ? '#ff4757' : '#64748b';
      ctx.fill();
    });

    // Projected Target Arrow from last point
    const last = coords[coords.length - 1];
    const targetColor = isBear ? '#ff4757' : '#00e676';
    const arrowEndY = isBear ? Math.min(H - 8, last.y + 28) : Math.max(8, last.y - 28);
    drawArrow(ctx, last.x + 6, last.y, W - 12, arrowEndY, targetColor, 2);
  }

  /**
   * Renders detailed pattern + Fib target zone in Inspector Modal.
   */
  function drawModalPattern(canvas, evalObj) {
    if (!canvas || !evalObj) return;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 660;
    const H = 210;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#060a11';
    ctx.fillRect(0, 0, W, H);

    const dots = evalObj.dots;
    const t = evalObj.targets;
    const isBear = evalObj.pattern.bias === 'BEARISH';
    const targetColor = isBear ? '#ff4757' : '#00e676';

    const padX = 36;
    const padY = 28;
    const structW = W * 0.62;
    const usableH = H - padY * 2;

    const coords = dots.map((d, i) => ({
      x: padX + (i / Math.max(1, dots.length - 1)) * structW,
      y: padY + (1 - d.normY) * usableH,
      ...d
    }));

    // Structure Line
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    coords.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Points + Labels
    coords.forEach(p => {
      const col = p.status === 'PASS' ? '#00e676' : p.status === 'FAIL' ? '#ff4757' : '#94a3b8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.fillStyle = '#e2ecf8';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(p.label, p.x - 6, p.y - 10);
    });

    // Target Projection Zone on Right
    const last = coords[coords.length - 1];
    const zoneX = last.x + 14;
    const zoneW = W - zoneX - 18;
    const tp2Y = isBear ? H - 24 : 24;
    const tp1Y = last.y + (tp2Y - last.y) * 0.55;

    ctx.fillStyle = isBear ? 'rgba(255, 71, 87, 0.18)' : 'rgba(0, 230, 118, 0.18)';
    ctx.fillRect(zoneX, Math.min(last.y, tp2Y), zoneW, Math.abs(tp2Y - last.y));

    drawArrow(ctx, zoneX + 18, last.y, zoneX + 18, tp2Y, targetColor, 3);

    ctx.font = 'bold 11px monospace';
    ctx.fillStyle = targetColor;
    const sym = isBear ? '▼' : '▲';
    ctx.fillText(`${sym} TP1: ${fmtPrice(t.tp1)} (${t.tp1Pct}%)`, zoneX + 34, tp1Y);
    ctx.fillText(`${sym} TP2: ${fmtPrice(t.tp2)} (${t.tp2Pct}%)`, zoneX + 34, tp2Y + (isBear ? -4 : 12));
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`SL: ${fmtPrice(t.sl)}`, zoneX + 34, isBear ? Math.max(18, last.y - 14) : Math.min(H - 12, last.y + 18));
  }


  function drawRsiPane(canvas, opts) {
    const { candles, rsiData, divergences, showDiv } = opts;
    if (!canvas || !candles || !candles.length || !rsiData) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(300, rect.width);
    const H = Math.max(110, rect.height || 135);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060a11';
    ctx.fillRect(0, 0, W, H);

    const padL = 12, padR = 96, padT = 12, padB = 14;
    const vw = getViewWindow(candles.length);
    const visibleCount = vw.visibleCount;
    const startIdx = vw.startIdx;
    const endIdx = vw.endIdx;
    const forecastSlots = vw.rightOffset === 0 ? 18 : 2;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const stepX = plotW / (visibleCount + forecastSlots);

    const xOfVis = i => padL + (i + 0.5) * stepX;
    const xOfGlobal = gIdx => padL + (gIdx - startIdx + 0.5) * stepX;
    const yOf = val => padT + ((100 - Math.max(0, Math.min(100, val))) / 100) * plotH;

    ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
    ctx.fillRect(padL, yOf(70), plotW, yOf(30) - yOf(70));

    ctx.font = '10px monospace';
    [70, 50, 30].forEach(lvl => {
      const y = yOf(lvl);
      ctx.strokeStyle = lvl === 50 ? 'rgba(127, 148, 176, 0.25)' : 'rgba(127, 148, 176, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(W - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = lvl === 70 ? '#ff6b81' : lvl === 30 ? '#2ed573' : '#7f94b0';
      ctx.fillText(String(lvl), W - padR + 8, y + 3);
    });

    const rsiVis = rsiData.rsi.slice(startIdx, endIdx);
    const maVis = rsiData.rsiMA.slice(startIdx, endIdx);

    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    maVis.forEach((v, i) => {
      if (v === null) return;
      const x = xOfVis(i), y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    started = false;
    rsiVis.forEach((v, i) => {
      if (v === null) return;
      const x = xOfVis(i), y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    if (showDiv && divergences && divergences.rsiDivs) {
      divergences.rsiDivs.forEach(d => {
        if (d.idx2 < startIdx || d.ind1 === null || d.ind2 === null) return;
        const x1 = Math.max(padL + 4, xOfGlobal(d.idx1));
        const x2 = Math.min(W - padR - 6, xOfGlobal(d.idx2));
        const y1 = yOf(d.ind1);
        const y2 = yOf(d.ind2);
        const col = d.type === 'BULL' ? '#00e676' : '#ff4757';
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x2, y2, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    }

    if (rsiData.latestRsi !== null) {
      const yNow = yOf(rsiData.latestRsi);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(W - padR + 2, yNow - 8, 46, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(rsiData.latestRsi.toFixed(1), W - padR + 7, yNow + 3);
    }
  }

  function drawMacdPane(canvas, opts) {
    const { candles, macdData } = opts;
    if (!canvas || !candles || !candles.length || !macdData) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.max(300, rect.width);
    const H = Math.max(110, rect.height || 135);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060a11';
    ctx.fillRect(0, 0, W, H);

    const padL = 12, padR = 96, padT = 12, padB = 14;
    const vw = getViewWindow(candles.length);
    const visibleCount = vw.visibleCount;
    const startIdx = vw.startIdx;
    const endIdx = vw.endIdx;
    const forecastSlots = vw.rightOffset === 0 ? 18 : 2;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const stepX = plotW / (visibleCount + forecastSlots);

    const mVis = macdData.macd.slice(startIdx, endIdx);
    const sVis = macdData.signal.slice(startIdx, endIdx);
    const hVis = macdData.hist.slice(startIdx, endIdx);

    let maxAbs = 1;
    [...mVis, ...sVis, ...hVis].forEach(v => {
      if (v !== null && Math.abs(v) > maxAbs) maxAbs = Math.abs(v);
    });
    maxAbs *= 1.15;

    const xOfVis = i => padL + (i + 0.5) * stepX;
    const yOf = val => padT + ((maxAbs - val) / (2 * maxAbs)) * plotH;
    const yZero = yOf(0);

    ctx.strokeStyle = 'rgba(127, 148, 176, 0.4)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, yZero);
    ctx.lineTo(W - padR, yZero);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#7f94b0';
    ctx.font = '10px monospace';
    ctx.fillText('0.0', W - padR + 8, yZero + 3);

    const barW = Math.max(2, Math.min(8, stepX * 0.6));
    hVis.forEach((v, i) => {
      if (v === null) return;
      const x = xOfVis(i);
      const y = yOf(v);
      ctx.fillStyle = v >= 0 ? 'rgba(0, 230, 118, 0.5)' : 'rgba(255, 71, 87, 0.5)';
      ctx.fillRect(x - barW / 2, Math.min(y, yZero), barW, Math.max(1, Math.abs(y - yZero)));
    });

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    mVis.forEach((v, i) => {
      if (v === null) return;
      const x = xOfVis(i), y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    started = false;
    sVis.forEach((v, i) => {
      if (v === null) return;
      const x = xOfVis(i), y = yOf(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  return {
    drawMainChart,
    drawRsiPane,
    drawMacdPane,
    drawMiniPattern,
    drawModalPattern,
    bindZoomPan,
    resetView,
    fmtPrice
  };
})();
