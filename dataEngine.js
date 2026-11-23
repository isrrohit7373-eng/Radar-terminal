/**
 * js/dataEngine.js
 * Handles live Binance REST API klines + orderbook OBI for 1m, 5m, 15m, 4h
 * with seamless Simulation fallback when offline or in Simulation Mode.
 */
window.DataEngine = (function () {
  const TIMEFRAMES = ['1m', '5m', '15m', '4h'];
  const TF_MS = { '1m': 60000, '5m': 300000, '15m': 900000, '4h': 14400000 };

  const state = {
    mode: 'LIVE', // 'LIVE' | 'SIMULATION'
    connected: false,
    candles: { '1m': [], '5m': [], '15m': [], '4h': [] },
    ticker: { price: 61500, change: 420, changePct: 0.69 },
    obi: 0,
    lastUpdate: 0
  };

  function generateSimCandles(tf, count = 110, basePrice = 61500) {
    const arr = [];
    const stepMs = TF_MS[tf];
    const now = Date.now();
    let price = basePrice * (0.985 + Math.random() * 0.015);
    const volScale = tf === '4h' ? 0.0085 : tf === '15m' ? 0.0032 : tf === '5m' ? 0.0020 : 0.0011;

    for (let i = count - 1; i >= 0; i--) {
      const t = now - i * stepMs;
      // Combine sine waves + random walk so realistic geometric swings form
      const wave = Math.sin(i * 0.28) * volScale * 0.65 + Math.cos(i * 0.11) * volScale * 0.45;
      const noise = (Math.random() - 0.495) * volScale;
      const open = price;
      const close = Math.max(1000, open * (1 + wave + noise));
      const wickUp = Math.random() * volScale * 0.55 * open;
      const wickDn = Math.random() * volScale * 0.55 * open;
      const high = Math.max(open, close) + wickUp;
      const low = Math.min(open, close) - wickDn;
      const volume = +(12 + Math.random() * 65 * (tf === '4h' ? 12 : tf === '15m' ? 4 : 1)).toFixed(2);
      const buyRatio = close >= open ? 0.52 + Math.random() * 0.25 : 0.23 + Math.random() * 0.25;
      const buyVol = +(volume * buyRatio).toFixed(2);
      const sellVol = +(volume - buyVol).toFixed(2);

      arr.push({
        time: t, open: +open.toFixed(2), high: +high.toFixed(2),
        low: +low.toFixed(2), close: +close.toFixed(2),
        volume, buyVol, sellVol, delta: +(buyVol - sellVol).toFixed(2)
      });
      price = close;
    }
    return arr;
  }

  function tickSimulation() {
    TIMEFRAMES.forEach(tf => {
      if (!state.candles[tf] || state.candles[tf].length < 40) {
        state.candles[tf] = generateSimCandles(tf, 110, state.ticker.price);
      }
      const list = state.candles[tf];
      const last = list[list.length - 1];
      const scale = tf === '1m' ? 0.00055 : tf === '5m' ? 0.0008 : tf === '15m' ? 0.0011 : 0.0018;
      const drift = (Math.random() - 0.498) * scale * last.close;
      const nextClose = +(last.close + drift).toFixed(2);
      last.close = nextClose;
      last.high = Math.max(last.high, nextClose);
      last.low = Math.min(last.low, nextClose);
      const addVol = +(Math.random() * 2.5).toFixed(2);
      last.volume = +(last.volume + addVol).toFixed(2);
      if (drift >= 0) last.buyVol = +(last.buyVol + addVol).toFixed(2);
      else last.sellVol = +(last.sellVol + addVol).toFixed(2);
      last.delta = +(last.buyVol - last.sellVol).toFixed(2);
    });

    const latest1m = state.candles['1m'][state.candles['1m'].length - 1];
    const first1m = state.candles['1m'][0];
    state.ticker.price = latest1m.close;
    state.ticker.change = +(latest1m.close - first1m.open).toFixed(2);
    state.ticker.changePct = +(((latest1m.close - first1m.open) / first1m.open) * 100).toFixed(2);
    state.obi = +((Math.random() - 0.48) * 35).toFixed(1);
    state.lastUpdate = Date.now();
  }

  async function fetchBinanceKlines(tf) {
    const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${tf}&limit=110`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Binance klines HTTP ' + res.status);
    const raw = await res.json();
    return raw.map(k => {
      const open = parseFloat(k[1]);
      const high = parseFloat(k[2]);
      const low = parseFloat(k[3]);
      const close = parseFloat(k[4]);
      const volume = parseFloat(k[5]);
      const buyVol = parseFloat(k[9]);
      const sellVol = Math.max(0, volume - buyVol);
      return {
        time: k[0], open, high, low, close,
        volume: +volume.toFixed(2),
        buyVol: +buyVol.toFixed(2),
        sellVol: +sellVol.toFixed(2),
        delta: +(buyVol - sellVol).toFixed(2)
      };
    });
  }

  async function fetchBinanceTickerAndObi() {
    const [tRes, dRes] = await Promise.all([
      fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT'),
      fetch('https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=20')
    ]);
    if (tRes.ok) {
      const t = await tRes.json();
      state.ticker.price = parseFloat(t.lastPrice);
      state.ticker.change = parseFloat(t.priceChange);
      state.ticker.changePct = parseFloat(t.priceChangePercent);
    }
    if (dRes.ok) {
      const d = await dRes.json();
      const bidSum = d.bids.reduce((a, b) => a + parseFloat(b[1]), 0);
      const askSum = d.asks.reduce((a, b) => a + parseFloat(b[1]), 0);
      state.obi = +(((bidSum - askSum) / Math.max(0.0001, bidSum + askSum)) * 100).toFixed(1);
    }
  }

  async function refreshAll() {
    if (state.mode === 'SIMULATION') {
      tickSimulation();
      state.connected = false;
      return state;
    }
    try {
      const results = await Promise.all(TIMEFRAMES.map(tf => fetchBinanceKlines(tf)));
      TIMEFRAMES.forEach((tf, i) => { state.candles[tf] = results[i]; });
      await fetchBinanceTickerAndObi();
      state.connected = true;
      state.lastUpdate = Date.now();
    } catch (err) {
      // Automatic fallback to simulation so dashboard never breaks
      state.mode = 'SIMULATION';
      state.connected = false;
      tickSimulation();
    }
    return state;
  }

  function setMode(mode) {
    state.mode = mode;
    if (mode === 'SIMULATION') {
      TIMEFRAMES.forEach(tf => {
        if (!state.candles[tf].length) state.candles[tf] = generateSimCandles(tf, 110);
      });
    }
  }

  return {
    TIMEFRAMES,
    state,
    refreshAll,
    setMode,
    tickSimulation
  };
})();
