# BTC/USDT // RADAR TERMINAL v4 (Modular Architecture)

## Folder Structure
- `index.html` — Core layout (Main Terminal, 123 Pattern Library, Formula Lab, Inspector Modal)
- `css/styles.css` — Dark terminal theme and responsive grid styling
- `js/dataEngine.js` — Live Binance REST API (1m, 5m, 15m, 4h klines + Orderbook OBI) with Simulation fallback
- `js/indicators.js` — VWAP, VPVR (Buy/Sell Volume Profile), S/R Levels, and Swing Pivot extractor
- `js/patterns.js` — **123 verified, strictly unique patterns** (Harmonics, Classical Reversal, Continuation, Wyckoff, Elliott Wave) + Strict 3-State Dot Evaluator + Live Fibonacci Target Engine (Entry/PRZ, TP1, TP2, Stop-Loss)
- `js/chartRenderer.js` — Main Candlestick Chart renderer with shaded Red/Green Fibonacci Target Zones, directional arrows, and live target prices
- `js/app.js` — UI controller, filters, pinning, and auto-refresh loop

## How to Run / Deploy
1. **Local:** Unzip the folder and double-click `index.html` in Chrome, Safari, or Edge.
2. **GitHub Pages / Netlify:** Upload the unzipped folder directly to a GitHub repository (enable GitHub Pages on `main`) or drag-and-drop the folder into Netlify Drop.
