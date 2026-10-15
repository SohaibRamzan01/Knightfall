# Knightfall ♞

A modern chess game that runs in the browser and on Android.

**[⬇ Download the Android APK](https://github.com/SohaibRamzan01/Knightfall/releases/latest/download/Knightfall.apk)**

## Features

- Full chess rules: castling, en passant, promotion (with piece picker), check, checkmate, stalemate, threefold repetition, fifty-move rule, insufficient material
- Computer opponent with 4 levels (Beginner, Casual, Club, Master) or 2-player local mode
- Chess clocks (Unlimited, 3+2, 5+0, 10+0, 15+10)
- Click or drag to move, legal-move hints, smooth animations, synthesized sounds
- Move list with position review, undo, resign, draw offers, copy PGN
- Dark and light themes, 4 board styles, works on phones

## Play in the browser

No install or build needed: open `index.html` in any modern browser.

## Tests

```bash
npm test
```

## Android build

Every push to `main` builds an APK with GitHub Actions (Capacitor) and publishes it as a GitHub Release.
The link above always points to the newest build.
