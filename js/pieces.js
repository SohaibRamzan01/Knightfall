(function () {
  'use strict';
  const shapes = {
    p: '<circle cx="24" cy="12" r="6"/><path d="M20 18h8l-1 9 6 10H15l6-10z"/>',
    r: '<path d="M13 7h6v6h3V7h4v6h3V7h6v12l-5 4 2 14H16l2-14-5-4z"/><path class="detail" d="M17 19h14M18 25h12"/>',
    n: '<path d="M14 36c0-9 4-12 12-17l-5-2-7 6-5-5 8-11 5 1 5-5 1 7c10 5 10 15 8 26z"/><path class="detail" d="M27 14c7 5 6 12 3 18M17 14l3-2"/><circle class="eye" cx="23" cy="12" r="1.2"/>',
    b: '<path d="M24 5c-4 4-10 9-8 14 1 4 5 5 6 8l-7 10h18l-7-10c1-3 5-4 6-8 2-5-4-10-8-14z"/><path class="detail" d="M25 10l-5 9M18 29h12"/>',
    q: '<path d="M12 15l6 5 6-10 6 10 6-5-5 21H17z"/><circle cx="11" cy="12" r="3"/><circle cx="24" cy="7" r="3"/><circle cx="37" cy="12" r="3"/><path class="detail" d="M17 27h14M17 32h14"/>',
    k: '<path d="M22 4h4v5h5v4h-5v5h-4v-5h-5V9h5z"/><path d="M24 20c-8-9-17-2-12 6l6 10h12l6-10c5-8-4-15-12-6z"/><path class="detail" d="M17 29h14M18 33h12"/>'
  };
  window.PIECE_SVG = {};
  for (const color of ['w', 'b']) for (const type of Object.keys(shapes)) {
    const fill = color === 'w' ? '#f5f0df' : '#26313a';
    const stroke = color === 'w' ? '#26313a' : '#e4e6dc';
    window.PIECE_SVG[color + type] = `<svg viewBox="0 0 48 48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${shapes[type]}<path d="M15 36h18l3 5H12z"/><path d="M12 41h24v3H12z"/></g><style>.detail{fill:none}.eye{fill:${stroke};stroke:none}</style></svg>`;
  }
})();
