(function () {
  'use strict';
  let muted = false, context;
  try { muted = localStorage.getItem('chess-muted') === 'true'; } catch (_) { /* Storage is optional. */ }
  window.ChessSound = {
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('chess-muted', muted); } catch (_) {} return muted; },
    play(kind) {
      if (muted) return;
      try {
        context = context || new (window.AudioContext || window.webkitAudioContext)();
        context.resume();
        const notes = { move: [260], capture: [180, 120], check: [520, 660], castle: [260, 390], end: [330, 440, 660], illegal: [110, 90] }[kind] || [260];
        notes.forEach((frequency, i) => {
          const oscillator = context.createOscillator(), gain = context.createGain();
          const start = context.currentTime + i * 0.075;
          oscillator.type = 'sine'; oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.12, start + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
          oscillator.connect(gain); gain.connect(context.destination);
          oscillator.start(start); oscillator.stop(start + 0.14);
        });
      } catch (_) { /* A silent game remains fully playable. */ }
    }
  };
})();
