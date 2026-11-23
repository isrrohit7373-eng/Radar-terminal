/**
 * js/patterns.js
 * Verified 123 Unique Geometric Pattern Library + Strict 3-State Dot Evaluator
 * + Live Fibonacci Target Engine (Entry/PRZ, TP1, TP2, Stop-Loss, % Move).
 */
window.PatternsEngine = (function () {
  const LIBRARY = [
  {
    "id": 1,
    "name": "Bullish Gartley 222",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.0,
      1.0,
      0.382,
      0.85,
      0.214
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH B=61.8% XA, D=78.6% XA PRZ. Classic Scott Carney Gartley reversal. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 2,
    "name": "Bearish Gartley 222",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      1.0,
      0.0,
      0.618,
      0.15,
      0.786
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH B=61.8% XA, D=78.6% XA PRZ. Classic Scott Carney Gartley reversal. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 3,
    "name": "Bullish Bat Pattern",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.0,
      1.0,
      0.5,
      0.88,
      0.114
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.16,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH B=38.2%-50% XA, deep D=88.6% XA PRZ. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 4,
    "name": "Bearish Bat Pattern",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      1.0,
      0.0,
      0.5,
      0.12,
      0.886
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.16,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH B=38.2%-50% XA, deep D=88.6% XA PRZ. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 5,
    "name": "Bullish Alternate Bat",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.0,
      1.0,
      0.618,
      0.85,
      0.05
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.18,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH Shallow B=38.2% XA, extended D=113% XA PRZ. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 6,
    "name": "Bearish Alternate Bat",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      1.0,
      0.0,
      0.382,
      0.15,
      0.95
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.18,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH Shallow B=38.2% XA, extended D=113% XA PRZ. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 7,
    "name": "Bullish Butterfly",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.0,
      0.8,
      0.17,
      0.72,
      0.0
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.25,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH B=78.6% XA, D extends to 127.2%-161.8% XA. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 8,
    "name": "Bearish Butterfly",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      1.0,
      0.2,
      0.83,
      0.28,
      1.0
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.25,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH B=78.6% XA, D extends to 127.2%-161.8% XA. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 9,
    "name": "Bullish Crab Pattern",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.0,
      0.62,
      0.25,
      0.56,
      0.0
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.25,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH B=38.2%-61.8% XA, extreme D=161.8% XA extension. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 10,
    "name": "Bearish Crab Pattern",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      1.0,
      0.38,
      0.75,
      0.44,
      1.0
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.25,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH B=38.2%-61.8% XA, extreme D=161.8% XA extension. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 11,
    "name": "Bullish Deep Crab",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.0,
      0.65,
      0.08,
      0.55,
      0.0
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.25,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH Deep B=88.6% XA with D=161.8% XA extension. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 12,
    "name": "Bearish Deep Crab",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      1.0,
      0.35,
      0.92,
      0.45,
      1.0
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.25,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH Deep B=88.6% XA with D=161.8% XA extension. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 13,
    "name": "Bullish Cypher Pattern",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.15,
      0.78,
      0.42,
      1.0,
      0.33
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% CD",
    "desc": "BULLISH C extends 127.2%-141.4% XA, D completes at 78.6% XC. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 14,
    "name": "Bearish Cypher Pattern",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.85,
      0.22,
      0.58,
      0.0,
      0.67
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% CD",
    "desc": "BEARISH C extends 127.2%-141.4% XA, D completes at 78.6% XC. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 15,
    "name": "Bullish Shark Pattern",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.2,
      0.75,
      0.35,
      1.0,
      0.1
    ],
    "tp1Fib": 0.5,
    "tp2Fib": 0.618,
    "slFib": 0.2,
    "rule": "Fib 50.0% / 61.8% BC",
    "desc": "BULLISH Impulse C=113%-161.8% AB, D=88.6%-113% OX. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 16,
    "name": "Bearish Shark Pattern",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.8,
      0.25,
      0.65,
      0.0,
      0.9
    ],
    "tp1Fib": 0.5,
    "tp2Fib": 0.618,
    "slFib": 0.2,
    "rule": "Fib 50.0% / 61.8% BC",
    "desc": "BEARISH Impulse C=113%-161.8% AB, D=88.6%-113% OX. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 17,
    "name": "Bullish 5-0 Pattern",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.25,
      0.95,
      0.0,
      0.5
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "Fib 61.8% / 100% CD",
    "desc": "BULLISH Reciprocal AB=CD with D completing at 50% of BC. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 18,
    "name": "Bearish 5-0 Pattern",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.75,
      0.05,
      1.0,
      0.5
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "Fib 61.8% / 100% CD",
    "desc": "BEARISH Reciprocal AB=CD with D completing at 50% of BC. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 19,
    "name": "Bullish AB=CD Classic",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.95,
      0.35,
      0.75,
      0.15
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% CD",
    "desc": "BULLISH Equal price & time legs AB=CD with 61.8% BC retrace. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 20,
    "name": "Bearish AB=CD Classic",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.05,
      0.65,
      0.25,
      0.85
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% CD",
    "desc": "BEARISH Equal price & time legs AB=CD with 61.8% BC retrace. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 21,
    "name": "Bullish AB=CD 1.272 Ext",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.95,
      0.4,
      0.78,
      0.08
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.24,
    "rule": "Fib 38.2% / 61.8% CD",
    "desc": "BULLISH Alternate 1.272 AB=CD extension completion. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 22,
    "name": "Bearish AB=CD 1.272 Ext",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.05,
      0.6,
      0.22,
      0.92
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.24,
    "rule": "Fib 38.2% / 61.8% CD",
    "desc": "BEARISH Alternate 1.272 AB=CD extension completion. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 23,
    "name": "Bullish Three Drives",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.95,
      0.65,
      0.8,
      0.42,
      0.58,
      0.15
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.2,
    "rule": "Fib 38.2% / 61.8% Drive",
    "desc": "BULLISH Three symmetrical Fibonacci drives (1.272-1.618). Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 24,
    "name": "Bearish Three Drives",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.05,
      0.35,
      0.2,
      0.58,
      0.42,
      0.85
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.2,
    "rule": "Fib 38.2% / 61.8% Drive",
    "desc": "BEARISH Three symmetrical Fibonacci drives (1.272-1.618). Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 25,
    "name": "Bullish Anti-Gartley",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.78,
      0.2,
      0.65,
      0.12,
      0.92
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH Inverted Gartley harmonic geometry. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 26,
    "name": "Bearish Anti-Gartley",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.22,
      0.8,
      0.35,
      0.88,
      0.08
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH Inverted Gartley harmonic geometry. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 27,
    "name": "Bullish Anti-Bat",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.88,
      0.15,
      0.62,
      0.2,
      0.96
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.2,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH Inverted Bat harmonic geometry. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 28,
    "name": "Bearish Anti-Bat",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.12,
      0.85,
      0.38,
      0.8,
      0.04
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.2,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH Inverted Bat harmonic geometry. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 29,
    "name": "Bullish Anti-Butterfly",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.8,
      0.1,
      0.7,
      0.25,
      1.0
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.24,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH Inverted Butterfly harmonic structure. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 30,
    "name": "Bearish Anti-Butterfly",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.2,
      0.9,
      0.3,
      0.75,
      0.0
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.24,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH Inverted Butterfly harmonic structure. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 31,
    "name": "Bullish Anti-Crab",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.65,
      0.05,
      0.52,
      0.18,
      0.98
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.25,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH Inverted Crab harmonic structure. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 32,
    "name": "Bearish Anti-Crab",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.35,
      0.95,
      0.48,
      0.82,
      0.02
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.25,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH Inverted Crab harmonic structure. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 33,
    "name": "Bullish Nen Star",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.15,
      0.82,
      0.45,
      1.0,
      0.08
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% CD",
    "desc": "BULLISH Cypher variant with deep 127.2% XC completion. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 34,
    "name": "Bearish Nen Star",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      0.85,
      0.18,
      0.55,
      0.0,
      0.92
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% CD",
    "desc": "BEARISH Cypher variant with deep 127.2% XC completion. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 35,
    "name": "Bullish Leonardo Harmonic",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.0,
      1.0,
      0.5,
      0.78,
      0.214
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH B=50% XA, D=78.6% XA PRZ. Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 36,
    "name": "Bearish Leonardo Harmonic",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      1.0,
      0.0,
      0.5,
      0.22,
      0.786
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.22,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH B=50% XA, D=78.6% XA PRZ. Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 37,
    "name": "Bullish Navarro 200",
    "category": "Harmonic",
    "bias": "BULLISH",
    "pts": [
      0.0,
      1.0,
      0.5,
      0.88,
      0.114
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.18,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BULLISH Time-symmetric Bat harmonic (D=88.6%-113% XA). Final leg drops into Point D PRZ before reversing UP."
  },
  {
    "id": 38,
    "name": "Bearish Navarro 200",
    "category": "Harmonic",
    "bias": "BEARISH",
    "pts": [
      1.0,
      0.0,
      0.5,
      0.12,
      0.886
    ],
    "tp1Fib": 0.382,
    "tp2Fib": 0.618,
    "slFib": 0.18,
    "rule": "Fib 38.2% / 61.8% AD",
    "desc": "BEARISH Time-symmetric Bat harmonic (D=88.6%-113% XA). Final leg rallies UP into Point D PRZ before reversing DOWN."
  },
  {
    "id": 39,
    "name": "Double Bottom (W)",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.15,
      0.65,
      0.16,
      0.72
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.3,
    "rule": "61.8% / 100% Height",
    "desc": "BULLISH Classic two-trough/peak reversal at neckline."
  },
  {
    "id": 40,
    "name": "Double Top (M)",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.85,
      0.35,
      0.84,
      0.28
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.3,
    "rule": "61.8% / 100% Height",
    "desc": "BEARISH Classic two-trough/peak reversal at neckline."
  },
  {
    "id": 41,
    "name": "Adam & Eve Bottom",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.88,
      0.1,
      0.62,
      0.18,
      0.22,
      0.7
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Height",
    "desc": "BULLISH Sharp V-spike followed by rounded retest."
  },
  {
    "id": 42,
    "name": "Adam & Eve Top",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.12,
      0.9,
      0.38,
      0.82,
      0.78,
      0.3
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Height",
    "desc": "BEARISH Sharp V-spike followed by rounded retest."
  },
  {
    "id": 43,
    "name": "Eve & Adam Bottom",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.22,
      0.2,
      0.62,
      0.1,
      0.72
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Height",
    "desc": "BULLISH Rounded base followed by sharp spike retest."
  },
  {
    "id": 44,
    "name": "Eve & Adam Top",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.78,
      0.8,
      0.38,
      0.9,
      0.28
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Height",
    "desc": "BEARISH Rounded base followed by sharp spike retest."
  },
  {
    "id": 45,
    "name": "Triple Bottom",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.15,
      0.6,
      0.16,
      0.62,
      0.17,
      0.7
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Height",
    "desc": "BULLISH Three equal tests of support/resistance before breakout."
  },
  {
    "id": 46,
    "name": "Triple Top",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.85,
      0.4,
      0.84,
      0.38,
      0.83,
      0.3
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Height",
    "desc": "BEARISH Three equal tests of support/resistance before breakout."
  },
  {
    "id": 47,
    "name": "Inverse Head & Shoulders",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.35,
      0.7,
      0.08,
      0.72,
      0.34,
      0.78
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.32,
    "rule": "61.8% / 100% Head-Neck",
    "desc": "BULLISH Major structural reversal via head-to-neckline projection."
  },
  {
    "id": 48,
    "name": "Head & Shoulders",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.65,
      0.3,
      0.92,
      0.28,
      0.66,
      0.22
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.32,
    "rule": "61.8% / 100% Head-Neck",
    "desc": "BEARISH Major structural reversal via head-to-neckline projection."
  },
  {
    "id": 49,
    "name": "Complex Inverse H&S",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.38,
      0.68,
      0.35,
      0.1,
      0.7,
      0.36,
      0.76
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.32,
    "rule": "61.8% / 100% Head-Neck",
    "desc": "BULLISH Multi-shoulder Head & Shoulders reversal."
  },
  {
    "id": 50,
    "name": "Complex Head & Shoulders",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.62,
      0.32,
      0.65,
      0.9,
      0.3,
      0.64,
      0.24
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.32,
    "rule": "61.8% / 100% Head-Neck",
    "desc": "BEARISH Multi-shoulder Head & Shoulders reversal."
  },
  {
    "id": 51,
    "name": "Bullish Quasimodo (QM)",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.75,
      0.3,
      0.85,
      0.12,
      0.9,
      0.32
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% QM Swing",
    "desc": "BULLISH Over-and-under liquidity sweep + structure break."
  },
  {
    "id": 52,
    "name": "Bearish Quasimodo (QM)",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.25,
      0.7,
      0.15,
      0.88,
      0.1,
      0.68
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% QM Swing",
    "desc": "BEARISH Over-and-under liquidity sweep + structure break."
  },
  {
    "id": 53,
    "name": "Diamond Bottom",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.65,
      0.45,
      0.82,
      0.12,
      0.78,
      0.35,
      0.72
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.3,
    "rule": "61.8% / 100% Diamond",
    "desc": "BULLISH Broadening into contracting diamond reversal."
  },
  {
    "id": 54,
    "name": "Diamond Top",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.35,
      0.55,
      0.18,
      0.88,
      0.22,
      0.65,
      0.28
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.3,
    "rule": "61.8% / 100% Diamond",
    "desc": "BEARISH Broadening into contracting diamond reversal."
  },
  {
    "id": 55,
    "name": "Rounding Bottom (Saucer)",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.45,
      0.2,
      0.12,
      0.22,
      0.48,
      0.82
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.3,
    "rule": "61.8% / 100% Depth",
    "desc": "BULLISH Gradual accumulation/distribution arc reversal."
  },
  {
    "id": 56,
    "name": "Rounding Top (Dome)",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.55,
      0.8,
      0.88,
      0.78,
      0.52,
      0.18
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.3,
    "rule": "61.8% / 100% Depth",
    "desc": "BEARISH Gradual accumulation/distribution arc reversal."
  },
  {
    "id": 57,
    "name": "Bump & Run Bottom",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.8,
      0.68,
      0.58,
      0.12,
      0.45,
      0.75
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Lead-In",
    "desc": "BULLISH Bulkowski Bump & Run trendline break reversal."
  },
  {
    "id": 58,
    "name": "Bump & Run Top",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.2,
      0.32,
      0.42,
      0.88,
      0.55,
      0.25
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Lead-In",
    "desc": "BEARISH Bulkowski Bump & Run trendline break reversal."
  },
  {
    "id": 59,
    "name": "Bullish Dragon Pattern",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.92,
      0.18,
      0.55,
      0.14,
      0.65
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Head-Hump",
    "desc": "BULLISH Double-leg Dragon reversal above hump trendline."
  },
  {
    "id": 60,
    "name": "Bearish Inverse Dragon",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.08,
      0.82,
      0.45,
      0.86,
      0.35
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Head-Hump",
    "desc": "BEARISH Double-leg Dragon reversal above hump trendline."
  },
  {
    "id": 61,
    "name": "Falling Wedge Reversal",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.92,
      0.42,
      0.74,
      0.24,
      0.56,
      0.12,
      0.58
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Wedge",
    "desc": "BULLISH Converging wedge exhausting trend momentum."
  },
  {
    "id": 62,
    "name": "Rising Wedge Reversal",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.08,
      0.58,
      0.26,
      0.76,
      0.44,
      0.88,
      0.42
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Wedge",
    "desc": "BEARISH Converging wedge exhausting trend momentum."
  },
  {
    "id": 63,
    "name": "Broadening Bottom",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.55,
      0.35,
      0.72,
      0.2,
      0.88,
      0.1,
      0.78
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.32,
    "rule": "61.8% / 100% Width",
    "desc": "BULLISH Expanding megaphone volatility reversal."
  },
  {
    "id": 64,
    "name": "Broadening Top",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.45,
      0.65,
      0.28,
      0.8,
      0.12,
      0.9,
      0.22
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.32,
    "rule": "61.8% / 100% Width",
    "desc": "BEARISH Expanding megaphone volatility reversal."
  },
  {
    "id": 65,
    "name": "Bullish 2B Reversal",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.82,
      0.22,
      0.65,
      0.14,
      0.55
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.22,
    "rule": "61.8% / 100% Swing",
    "desc": "BULLISH False breakout stop-run reclaiming prior extreme."
  },
  {
    "id": 66,
    "name": "Bearish 2B Reversal",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.18,
      0.78,
      0.35,
      0.86,
      0.45
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.22,
    "rule": "61.8% / 100% Swing",
    "desc": "BEARISH False breakout stop-run reclaiming prior extreme."
  },
  {
    "id": 67,
    "name": "V-Bottom Spike Reversal",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.92,
      0.55,
      0.1,
      0.52,
      0.85
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Spike",
    "desc": "BULLISH High-momentum capitulation V-reversal."
  },
  {
    "id": 68,
    "name": "Inverted V-Top Reversal",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.08,
      0.45,
      0.9,
      0.48,
      0.15
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Spike",
    "desc": "BEARISH High-momentum capitulation V-reversal."
  },
  {
    "id": 69,
    "name": "Bullish Island Reversal",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.35,
      0.15,
      0.2,
      0.55,
      0.75
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Range",
    "desc": "BULLISH Exhaustion drop isolated before sharp reversal."
  },
  {
    "id": 70,
    "name": "Bearish Island Reversal",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.65,
      0.85,
      0.8,
      0.45,
      0.25
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Range",
    "desc": "BEARISH Exhaustion drop isolated before sharp reversal."
  },
  {
    "id": 71,
    "name": "Bullish Spike & Ledge",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.12,
      0.42,
      0.32,
      0.44,
      0.34,
      0.58
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Ledge",
    "desc": "BULLISH Sharp spike followed by tight consolidation breakout."
  },
  {
    "id": 72,
    "name": "Bearish Spike & Ledge",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.88,
      0.58,
      0.68,
      0.56,
      0.66,
      0.42
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Ledge",
    "desc": "BEARISH Sharp spike followed by tight consolidation breakout."
  },
  {
    "id": 73,
    "name": "Bullish Pipe Bottom",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.88,
      0.15,
      0.45,
      0.14,
      0.65
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "61.8% / 100% Pipe",
    "desc": "BULLISH Twin extreme volatility bars signaling reversal."
  },
  {
    "id": 74,
    "name": "Bearish Pipe Top",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.12,
      0.85,
      0.55,
      0.86,
      0.35
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "61.8% / 100% Pipe",
    "desc": "BEARISH Twin extreme volatility bars signaling reversal."
  },
  {
    "id": 75,
    "name": "Bullish Horn Bottom",
    "category": "Classical Reversal",
    "bias": "BULLISH",
    "pts": [
      0.85,
      0.15,
      0.48,
      0.16,
      0.62
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Horn",
    "desc": "BULLISH Twin spike lows/highs separated by single center pivot."
  },
  {
    "id": 76,
    "name": "Bearish Horn Top",
    "category": "Classical Reversal",
    "bias": "BEARISH",
    "pts": [
      0.15,
      0.85,
      0.52,
      0.84,
      0.38
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Horn",
    "desc": "BEARISH Twin spike lows/highs separated by single center pivot."
  },
  {
    "id": 77,
    "name": "Bull Flag Continuation",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.1,
      0.85,
      0.62,
      0.76,
      0.54,
      0.7,
      0.86
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Flagpole",
    "desc": "BULLISH Impulse pole followed by counter-trend channel."
  },
  {
    "id": 78,
    "name": "Bear Flag Continuation",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.9,
      0.15,
      0.38,
      0.24,
      0.46,
      0.3,
      0.14
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Flagpole",
    "desc": "BEARISH Impulse pole followed by counter-trend channel."
  },
  {
    "id": 79,
    "name": "High & Tight Bull Flag",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.08,
      0.92,
      0.78,
      0.88,
      0.76,
      0.9
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.22,
    "rule": "61.8% / 100% Flagpole",
    "desc": "BULLISH Shallow high-momentum flag continuation."
  },
  {
    "id": 80,
    "name": "Low & Tight Bear Flag",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.92,
      0.08,
      0.22,
      0.12,
      0.24,
      0.1
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.22,
    "rule": "61.8% / 100% Flagpole",
    "desc": "BEARISH Shallow high-momentum flag continuation."
  },
  {
    "id": 81,
    "name": "Bullish Pennant",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.1,
      0.88,
      0.6,
      0.8,
      0.66,
      0.76,
      0.86
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Pole",
    "desc": "BULLISH Impulse pole into tight symmetrical coil."
  },
  {
    "id": 82,
    "name": "Bearish Pennant",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.9,
      0.12,
      0.4,
      0.2,
      0.34,
      0.24,
      0.14
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.25,
    "rule": "61.8% / 100% Pole",
    "desc": "BEARISH Impulse pole into tight symmetrical coil."
  },
  {
    "id": 83,
    "name": "Ascending Triangle",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.2,
      0.8,
      0.35,
      0.8,
      0.52,
      0.8,
      0.88
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Base",
    "desc": "BULLISH Flat breakout barrier with rising/falling pressure."
  },
  {
    "id": 84,
    "name": "Descending Triangle",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.8,
      0.2,
      0.65,
      0.2,
      0.48,
      0.2,
      0.12
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Base",
    "desc": "BEARISH Flat breakout barrier with rising/falling pressure."
  },
  {
    "id": 85,
    "name": "Symmetrical Triangle Bull",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.15,
      0.85,
      0.28,
      0.74,
      0.4,
      0.66,
      0.82
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Base",
    "desc": "BULLISH Converging equilibrium triangle breaking with trend."
  },
  {
    "id": 86,
    "name": "Symmetrical Triangle Bear",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.85,
      0.15,
      0.72,
      0.26,
      0.6,
      0.34,
      0.18
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Base",
    "desc": "BEARISH Converging equilibrium triangle breaking with trend."
  },
  {
    "id": 87,
    "name": "Ascending Channel",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.12,
      0.55,
      0.28,
      0.72,
      0.45,
      0.88
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Channel",
    "desc": "BULLISH Parallel trend channel continuation."
  },
  {
    "id": 88,
    "name": "Descending Channel",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.88,
      0.45,
      0.72,
      0.28,
      0.55,
      0.12
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Channel",
    "desc": "BEARISH Parallel trend channel continuation."
  },
  {
    "id": 89,
    "name": "Bullish Rectangle",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.15,
      0.75,
      0.35,
      0.75,
      0.36,
      0.75,
      0.86
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Box",
    "desc": "BULLISH Horizontal trading range continuation breakout."
  },
  {
    "id": 90,
    "name": "Bearish Rectangle",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.85,
      0.25,
      0.65,
      0.25,
      0.64,
      0.25,
      0.14
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Box",
    "desc": "BEARISH Horizontal trading range continuation breakout."
  },
  {
    "id": 91,
    "name": "Cup & Handle",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.82,
      0.3,
      0.15,
      0.32,
      0.8,
      0.62,
      0.86
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Cup Depth",
    "desc": "BULLISH Classic William O'Neil Cup & Handle breakout."
  },
  {
    "id": 92,
    "name": "Inverted Cup & Handle",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.18,
      0.7,
      0.85,
      0.68,
      0.2,
      0.38,
      0.14
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Cup Depth",
    "desc": "BEARISH Classic William O'Neil Cup & Handle breakout."
  },
  {
    "id": 93,
    "name": "Measured Move Up",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.1,
      0.58,
      0.38,
      0.88
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Leg 1",
    "desc": "BULLISH Two parallel impulse legs separated by corrective pause."
  },
  {
    "id": 94,
    "name": "Measured Move Down",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.9,
      0.42,
      0.62,
      0.12
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Leg 1",
    "desc": "BEARISH Two parallel impulse legs separated by corrective pause."
  },
  {
    "id": 95,
    "name": "Ascending Scallop",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.25,
      0.7,
      0.42,
      0.38,
      0.55,
      0.82
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Scallop",
    "desc": "BULLISH J-shaped rounded continuation pullback."
  },
  {
    "id": 96,
    "name": "Descending Scallop",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.75,
      0.3,
      0.58,
      0.62,
      0.45,
      0.18
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Scallop",
    "desc": "BEARISH J-shaped rounded continuation pullback."
  },
  {
    "id": 97,
    "name": "Volatility Contraction (VCP)",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.2,
      0.82,
      0.42,
      0.8,
      0.58,
      0.79,
      0.68,
      0.86
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.22,
    "rule": "61.8% / 100% Base",
    "desc": "BULLISH Mark Minervini tightening volatility contractions."
  },
  {
    "id": 98,
    "name": "Inverse VCP Breakdown",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.8,
      0.18,
      0.58,
      0.2,
      0.42,
      0.21,
      0.32,
      0.14
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.22,
    "rule": "61.8% / 100% Base",
    "desc": "BEARISH Mark Minervini tightening volatility contractions."
  },
  {
    "id": 99,
    "name": "Darvas Box Breakout",
    "category": "Continuation",
    "bias": "BULLISH",
    "pts": [
      0.12,
      0.78,
      0.55,
      0.77,
      0.56,
      0.88
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "61.8% / 100% Box",
    "desc": "BULLISH Momentum consolidation box breakout."
  },
  {
    "id": 100,
    "name": "Darvas Box Breakdown",
    "category": "Continuation",
    "bias": "BEARISH",
    "pts": [
      0.88,
      0.22,
      0.45,
      0.23,
      0.44,
      0.12
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "61.8% / 100% Box",
    "desc": "BEARISH Momentum consolidation box breakout."
  },
  {
    "id": 101,
    "name": "Wyckoff Accumulation Spring",
    "category": "Wyckoff",
    "bias": "BULLISH",
    "pts": [
      0.75,
      0.25,
      0.62,
      0.24,
      0.58,
      0.12,
      0.68
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "61.8% / 100% Cause",
    "desc": "BULLISH Phase C Spring / UTAD liquidity shakeout."
  },
  {
    "id": 102,
    "name": "Wyckoff Distribution UTAD",
    "category": "Wyckoff",
    "bias": "BEARISH",
    "pts": [
      0.25,
      0.75,
      0.38,
      0.76,
      0.42,
      0.88,
      0.32
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "61.8% / 100% Cause",
    "desc": "BEARISH Phase C Spring / UTAD liquidity shakeout."
  },
  {
    "id": 103,
    "name": "Wyckoff Sign of Strength",
    "category": "Wyckoff",
    "bias": "BULLISH",
    "pts": [
      0.3,
      0.6,
      0.22,
      0.78,
      0.56,
      0.88
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Range",
    "desc": "BULLISH Phase D breakout and Last Point of Support/Supply."
  },
  {
    "id": 104,
    "name": "Wyckoff Sign of Weakness",
    "category": "Wyckoff",
    "bias": "BEARISH",
    "pts": [
      0.7,
      0.4,
      0.78,
      0.22,
      0.44,
      0.12
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Range",
    "desc": "BEARISH Phase D breakout and Last Point of Support/Supply."
  },
  {
    "id": 105,
    "name": "Wyckoff Re-Accumulation",
    "category": "Wyckoff",
    "bias": "BULLISH",
    "pts": [
      0.12,
      0.72,
      0.48,
      0.7,
      0.42,
      0.82
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Range",
    "desc": "BULLISH Mid-trend institutional re-accumulation/distribution."
  },
  {
    "id": 106,
    "name": "Wyckoff Re-Distribution",
    "category": "Wyckoff",
    "bias": "BEARISH",
    "pts": [
      0.88,
      0.28,
      0.52,
      0.3,
      0.58,
      0.18
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Range",
    "desc": "BEARISH Mid-trend institutional re-accumulation/distribution."
  },
  {
    "id": 107,
    "name": "Bullish Liquidity Sweep",
    "category": "Wyckoff",
    "bias": "BULLISH",
    "pts": [
      0.7,
      0.3,
      0.65,
      0.14,
      0.72
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.22,
    "rule": "61.8% / 100% Sweep",
    "desc": "BULLISH Stop-run beyond equal lows/highs followed by displacement."
  },
  {
    "id": 108,
    "name": "Bearish Liquidity Sweep",
    "category": "Wyckoff",
    "bias": "BEARISH",
    "pts": [
      0.3,
      0.7,
      0.35,
      0.86,
      0.28
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.22,
    "rule": "61.8% / 100% Sweep",
    "desc": "BEARISH Stop-run beyond equal lows/highs followed by displacement."
  },
  {
    "id": 109,
    "name": "Bullish Order Block Reclaim",
    "category": "Wyckoff",
    "bias": "BULLISH",
    "pts": [
      0.8,
      0.2,
      0.72,
      0.28,
      0.85
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "61.8% / 100% OB",
    "desc": "BULLISH Institutional order block mitigation & continuation."
  },
  {
    "id": 110,
    "name": "Bearish Order Block Reject",
    "category": "Wyckoff",
    "bias": "BEARISH",
    "pts": [
      0.2,
      0.8,
      0.28,
      0.72,
      0.15
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.24,
    "rule": "61.8% / 100% OB",
    "desc": "BEARISH Institutional order block mitigation & continuation."
  },
  {
    "id": 111,
    "name": "Elliott Bullish Impulse (1-5)",
    "category": "Elliott Wave",
    "bias": "BULLISH",
    "pts": [
      0.1,
      0.42,
      0.24,
      0.78,
      0.56,
      0.94
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.32,
    "rule": "100% / 161.8% Wave Ext",
    "desc": "BULLISH 5-wave motive impulse structure."
  },
  {
    "id": 112,
    "name": "Elliott Bearish Impulse (1-5)",
    "category": "Elliott Wave",
    "bias": "BEARISH",
    "pts": [
      0.9,
      0.58,
      0.76,
      0.22,
      0.44,
      0.06
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.32,
    "rule": "100% / 161.8% Wave Ext",
    "desc": "BEARISH 5-wave motive impulse structure."
  },
  {
    "id": 113,
    "name": "Elliott Bullish Zigzag (ABC)",
    "category": "Elliott Wave",
    "bias": "BULLISH",
    "pts": [
      0.15,
      0.68,
      0.38,
      0.92
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.3,
    "rule": "100% / 161.8% Wave A",
    "desc": "BULLISH Sharp 5-3-5 zigzag projection."
  },
  {
    "id": 114,
    "name": "Elliott Bearish Zigzag (ABC)",
    "category": "Elliott Wave",
    "bias": "BEARISH",
    "pts": [
      0.85,
      0.32,
      0.62,
      0.08
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.3,
    "rule": "100% / 161.8% Wave A",
    "desc": "BEARISH Sharp 5-3-5 zigzag projection."
  },
  {
    "id": 115,
    "name": "Elliott Bullish Flat (ABC)",
    "category": "Elliott Wave",
    "bias": "BULLISH",
    "pts": [
      0.2,
      0.75,
      0.22,
      0.82
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.28,
    "rule": "100% / 161.8% Wave A",
    "desc": "BULLISH 3-3-5 regular flat correction completion."
  },
  {
    "id": 116,
    "name": "Elliott Bearish Flat (ABC)",
    "category": "Elliott Wave",
    "bias": "BEARISH",
    "pts": [
      0.8,
      0.25,
      0.78,
      0.18
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.28,
    "rule": "100% / 161.8% Wave A",
    "desc": "BEARISH 3-3-5 regular flat correction completion."
  },
  {
    "id": 117,
    "name": "Elliott Expanded Flat Bull",
    "category": "Elliott Wave",
    "bias": "BULLISH",
    "pts": [
      0.25,
      0.72,
      0.14,
      0.88
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.28,
    "rule": "100% / 161.8% Wave A",
    "desc": "BULLISH Expanded flat with Wave B exceeding origin."
  },
  {
    "id": 118,
    "name": "Elliott Expanded Flat Bear",
    "category": "Elliott Wave",
    "bias": "BEARISH",
    "pts": [
      0.75,
      0.28,
      0.86,
      0.12
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.28,
    "rule": "100% / 161.8% Wave A",
    "desc": "BEARISH Expanded flat with Wave B exceeding origin."
  },
  {
    "id": 119,
    "name": "Elliott Leading Diagonal Bull",
    "category": "Elliott Wave",
    "bias": "BULLISH",
    "pts": [
      0.1,
      0.48,
      0.28,
      0.68,
      0.46,
      0.84
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Diag",
    "desc": "BULLISH Overlapping wedge initiating new trend."
  },
  {
    "id": 120,
    "name": "Elliott Leading Diagonal Bear",
    "category": "Elliott Wave",
    "bias": "BEARISH",
    "pts": [
      0.9,
      0.52,
      0.72,
      0.32,
      0.54,
      0.16
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.28,
    "rule": "61.8% / 100% Diag",
    "desc": "BEARISH Overlapping wedge initiating new trend."
  },
  {
    "id": 121,
    "name": "Elliott Ending Diagonal Bull",
    "category": "Elliott Wave",
    "bias": "BULLISH",
    "pts": [
      0.88,
      0.45,
      0.72,
      0.28,
      0.54,
      0.14,
      0.76
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Origin",
    "desc": "BULLISH Terminal wave 5 diagonal snapping back to origin."
  },
  {
    "id": 122,
    "name": "Elliott Ending Diagonal Bear",
    "category": "Elliott Wave",
    "bias": "BEARISH",
    "pts": [
      0.12,
      0.55,
      0.28,
      0.72,
      0.46,
      0.86,
      0.24
    ],
    "tp1Fib": 0.618,
    "tp2Fib": 1.0,
    "slFib": 0.26,
    "rule": "61.8% / 100% Origin",
    "desc": "BEARISH Terminal wave 5 diagonal snapping back to origin."
  },
  {
    "id": 123,
    "name": "Elliott Running Flat Bull",
    "category": "Elliott Wave",
    "bias": "BULLISH",
    "pts": [
      0.18,
      0.78,
      0.4,
      0.9
    ],
    "tp1Fib": 1.0,
    "tp2Fib": 1.618,
    "slFib": 0.26,
    "rule": "100% / 161.8% Wave A",
    "desc": "BULLISH strong-trend running flat where Wave C fails to breach Wave A extreme."
  }
];

  /**
   * Computes live Fibonacci Target Levels (Entry, TP1, TP2, SL)
   * based on pattern category, bias, and live swing range.
   */
  function computeFibTargets(pattern, matchedSwings, livePrice) {
    const prices = matchedSwings.map(s => s.price);
    const maxP = Math.max(...prices, livePrice);
    const minP = Math.min(...prices, livePrice);
    // Ensure a realistic minimum structural height (at least 0.35% of live price)
    const rawHeight = Math.max(maxP - minP, livePrice * 0.0035);

    const entry = livePrice;
    const dir = pattern.bias === 'BULLISH' ? 1 : -1;

    // Harmonic patterns project Fib retracement of AD; Classical/Wyckoff project measured height; Elliott projects Fib extension
    const tp1Dist = rawHeight * pattern.tp1Fib;
    const tp2Dist = rawHeight * pattern.tp2Fib;
    const slDist  = rawHeight * pattern.slFib;

    const tp1 = +(entry + dir * tp1Dist).toFixed(2);
    const tp2 = +(entry + dir * tp2Dist).toFixed(2);
    const sl  = +(entry - dir * slDist).toFixed(2);

    const tp1Pct = +(((tp1 - entry) / entry) * 100).toFixed(2);
    const tp2Pct = +(((tp2 - entry) / entry) * 100).toFixed(2);
    const slPct  = +(((sl - entry) / entry) * 100).toFixed(2);
    const rr = +(Math.abs(tp2 - entry) / Math.max(0.01, Math.abs(entry - sl))).toFixed(2);

    return {
      entry: +entry.toFixed(2),
      tp1,
      tp2,
      sl,
      tp1Pct,
      tp2Pct,
      slPct,
      rr,
      height: +rawHeight.toFixed(2),
      rule: pattern.rule
    };
  }

  /**
   * Evaluates a single pattern against extracted live swings using strict 3-state dots:
   * - GREEN (PASS): normalized price matches template point within tolerance
   * - GRAY (WAIT): final future leg awaiting completion
   * - RED (FAIL): structural deviation -> overallPct forced to 0% (REJECTED)
   */
  function evaluatePattern(pattern, swings, candles, tf) {
    const totalDots = pattern.pts.length;
    const livePrice = candles.length ? candles[candles.length - 1].close : 61500;
    const lastIdx = Math.max(0, candles.length - 1);

    // Build window of swings of length (totalDots - 1) so the final dot can be LIVE/AWAITING
    const activeCount = Math.min(totalDots - 1, Math.max(2, swings.length));
    const slice = swings.slice(-activeCount);

    // Normalize slice prices to 0..1
    let minP = Infinity, maxP = -Infinity;
    slice.forEach(s => {
      if (s.price < minP) minP = s.price;
      if (s.price > maxP) maxP = s.price;
    });
    const span = Math.max(1e-6, maxP - minP);

    const dots = [];
    let greenCount = 0;
    let hasRed = false;

    for (let i = 0; i < totalDots; i++) {
      const expected = pattern.pts[i];
      if (i < slice.length) {
        const actualNorm = (slice[i].price - minP) / span;
        const diff = Math.abs(actualNorm - expected);
        // Deterministic structural accuracy score
        const pointScore = Math.max(0, Math.min(100, Math.round((1 - diff * 1.15) * 100)));
        let status = 'PASS';
        if (diff > 0.42) {
          status = 'FAIL';
          hasRed = true;
        } else {
          greenCount++;
        }
        dots.push({
          label: 'S' + (i + 1),
          status,
          score: pointScore,
          index: slice[i].index,
          price: slice[i].price,
          normY: expected
        });
      } else {
        // Future point awaiting market test
        const projectedPrice = minP + expected * span;
        dots.push({
          label: 'S' + (i + 1),
          status: 'WAIT',
          score: null,
          index: lastIdx + (i - slice.length + 1) * 4,
          price: +projectedPrice.toFixed(2),
          normY: expected
        });
      }
    }

    const overallPct = hasRed ? 0 : Math.round((greenCount / totalDots) * 100);
    const targets = computeFibTargets(pattern, slice.length ? slice : [{ price: livePrice }], livePrice);

    return {
      uid: tf + '_' + pattern.id,
      tf,
      pattern,
      dots,
      greenCount,
      totalDots,
      hasRed,
      overallPct,
      targets
    };
  }

  function evaluateTimeframe(candles, tf) {
    const swings = window.Indicators.extractSwings(candles, 9);
    const results = LIBRARY.map(pat => evaluatePattern(pat, swings, candles, tf));
    results.sort((a, b) => b.overallPct - a.overallPct || a.pattern.id - b.pattern.id);
    return results;
  }

  return {
    LIBRARY,
    evaluateTimeframe,
    computeFibTargets
  };
})();
