(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const { Chess } = window.ChessEngine;
  const names = { w: 'White', b: 'Black' }, levels = ['', 'Beginner', 'Casual', 'Club', 'Master'];
  const material = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let chess, positions, clockHistory, times, selected = null, hints = [], flipped = false;
  let mode = 'ai', human = 'w', level = 3, initialTime = 0, increment = 0;
  let review = null, result = null, thinking = false, busy = false, timer = null, generation = 0;
  let lastTick = performance.now(), drag = null, confirmation = null;
  const squares = new Map();
  function store(key, value) { try { localStorage.setItem(key, value); } catch (_) {} }
  function read(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; } }
  document.documentElement.dataset.theme = read('chess-theme', 'dark');
  document.documentElement.dataset.board = read('chess-board', 'green');
  $('board-theme').value = document.documentElement.dataset.board;
  document.querySelector('.brand-icon').innerHTML = PIECE_SVG.wn;
  document.querySelector('.result-piece').innerHTML = PIECE_SVG.wk;
  function view() { return review === null ? chess : new Chess(positions[review]); }
  function canPlay() { return !result && !thinking && !busy && review === null && (mode === 'local' || chess.turn() === human); }
  function squareAt(index) {
    const row = Math.floor(index / 8), col = index % 8;
    return 'abcdefgh'[flipped ? 7 - col : col] + (flipped ? row + 1 : 8 - row);
  }
  function renderBoard() {
    const position = view(), history = chess.history({ verbose: true });
    const ply = review === null ? history.length : review, last = history[ply - 1];
    const checkSquare = position.inCheck() ? position.kingSquare(position.turn()) : null;
    squares.clear(); $('board').replaceChildren();
    for (let i = 0; i < 64; i++) {
      const square = squareAt(i), piece = position.get(square), row = Math.floor(i / 8), col = i % 8;
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.square = square;
      button.className = 'square' + ((Number(square[1]) + square.charCodeAt(0)) % 2 === 0 ? ' dark' : '');
      button.setAttribute('aria-label', square + (piece ? ' ' + names[piece.color] + ' ' + ({p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}[piece.type]) : ' empty'));
      if (last && (last.from === square || last.to === square)) button.classList.add('last');
      if (selected === square) button.classList.add('selected');
      if (checkSquare === square) button.classList.add('check');
      if (hints.some(m => m.to === square)) { button.classList.add('hint'); if (piece || hints.some(m => m.to === square && m.captured)) button.classList.add('capture-hint'); }
      if (piece) button.innerHTML = '<span class="piece">' + PIECE_SVG[piece.color + piece.type] + '</span>';
      if (row === 7) button.insertAdjacentHTML('beforeend', '<span class="coordinate file">' + square[0] + '</span>');
      if (col === 0) button.insertAdjacentHTML('beforeend', '<span class="coordinate rank">' + square[1] + '</span>');
      button.addEventListener('click', () => { if (!drag) selectSquare(square); });
      button.addEventListener('pointerdown', event => beginDrag(event, square));
      squares.set(square, button); $('board').append(button);
    }
  }
  function captures(position, color) {
    const counts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    for (const row of position.board()) for (const p of row) if (p && p.color !== color && p.type !== 'k') counts[p.type]--;
    let html = '';
    for (const type of ['q', 'r', 'b', 'n', 'p']) for (let i = 0; i < counts[type]; i++) html += PIECE_SVG[(color === 'w' ? 'b' : 'w') + type];
    return html;
  }
  function renderPlayers() {
    const position = view();
    let balance = 0;
    for (const row of position.board()) for (const p of row) if (p) balance += material[p.type] * (p.color === 'w' ? 1 : -1);
    for (const [id, color] of [['top-player', flipped ? 'w' : 'b'], ['bottom-player', flipped ? 'b' : 'w']]) {
      const computer = mode === 'ai' && color !== human;
      const label = computer ? 'Computer' : mode === 'ai' ? 'You' : names[color];
      const advantage = balance * (color === 'w' ? 1 : -1);
      $(id).innerHTML = '<div class="avatar">' + PIECE_SVG[color + (computer ? 'n' : 'k')] + '</div><div class="player-info"><div class="player-name">' + label + '<span class="player-label">' + (computer ? levels[level] : names[color] + ' pieces') + '</span></div><div class="captured">' + captures(position, color) + (advantage > 0 ? '<span class="advantage">+' + advantage + '</span>' : '') + '</div></div><div id="clock-' + color + '" class="clock"></div>';
    }
    renderClocks();
  }
  function renderClocks() {
    if (!chess) return;
    const clockTimes = review === null ? times : clockHistory[review];
    for (const color of ['w', 'b']) {
      const element = $('clock-' + color);
      if (!element) continue;
      const seconds = Math.max(0, Math.ceil(clockTimes[color] / 1000));
      element.textContent = initialTime ? Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') : '\u221e';
      element.className = 'clock' + (!result && review === null && chess.turn() === color ? ' active' : '') + (initialTime && seconds < 20 ? ' low' : '');
      element.setAttribute('aria-label', names[color] + ' clock ' + element.textContent);
    }
  }
  function renderPanel() {
    const history = chess.history({ verbose: true }), ply = review === null ? history.length : review;
    $('status').textContent = result ? result.title : review !== null ? 'Position after move ' + Math.ceil(review / 2) : thinking ? 'Computer is thinking…' : names[chess.turn()] + ' to move' + (chess.inCheck() ? ' · Check' : '');
    $('status-dot').classList.toggle('thinking', thinking);
    $('game-info').textContent = (mode === 'ai' ? 'vs Computer · ' + levels[level] : '2 Players · local') + ' · ' + (initialTime ? initialTime / 60 + '+' + increment : 'Unlimited');
    $('review-banner').hidden = review === null;
    $('move-count').textContent = history.length + ' played';
    $('move-list').replaceChildren();
    if (!history.length) $('move-list').innerHTML = '<p class="empty">The story starts with your first move.</p>';
    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement('div'); row.className = 'move-row';
      row.innerHTML = '<span class="move-number">' + (i / 2 + 1) + '.</span>';
      for (let j = i; j < Math.min(i + 2, history.length); j++) {
        const button = document.createElement('button'); button.textContent = history[j].san;
        button.classList.toggle('current', j + 1 === ply); button.setAttribute('aria-label', 'Review move ' + (j + 1) + ': ' + history[j].san);
        button.onclick = () => reviewPosition(j + 1); row.append(button);
      }
      $('move-list').append(row);
    }
    if (review === null) $('move-list').scrollTop = $('move-list').scrollHeight;
    else $('move-list').querySelector('.current')?.scrollIntoView({ block: 'nearest' });
    $('undo').disabled = !history.length || busy || review !== null;
    $('resign').disabled = !!result || review !== null;
    $('draw').hidden = mode !== 'local'; $('draw').disabled = !!result || review !== null;
    $('previous').disabled = ply === 0; $('next').disabled = review === null;
    $('sound').textContent = ChessSound.muted ? 'Sound off' : 'Sound on';
    $('theme').textContent = document.documentElement.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
  function render() { renderBoard(); renderPlayers(); renderPanel(); }
  function clearSelection() { selected = null; hints = []; $('promotion').hidden = true; }
  function selectSquare(square) {
    if (!canPlay() || !$('promotion').hidden) return;
    if (selected && hints.some(m => m.to === square)) { attemptMove(selected, square); return; }
    const p = chess.get(square);
    if (p && p.color === chess.turn()) {
      if (selected === square) clearSelection();
      else { selected = square; hints = chess.moves({ square, verbose: true }); }
    } else { if (selected) ChessSound.play('illegal'); clearSelection(); }
    renderBoard();
  }
  function beginDrag(event, square) {
    if (event.button !== 0 || !canPlay() || !$('promotion').hidden) return;
    const piece = chess.get(square);
    if (!piece || piece.color !== chess.turn()) return;
    drag = { square, x: event.clientX, y: event.clientY, moved: false, piece, pointer: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  document.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    if (!drag.moved) {
      drag.moved = true; selected = drag.square; hints = chess.moves({ square: selected, verbose: true }); renderBoard();
      drag.element = document.createElement('div'); drag.element.className = 'drag-piece';
      drag.element.innerHTML = PIECE_SVG[drag.piece.color + drag.piece.type];
      drag.size = $('board').getBoundingClientRect().width / 8;
      drag.element.style.width = drag.element.style.height = drag.size + 'px'; document.body.append(drag.element);
      squares.get(drag.square).querySelector('.piece').classList.add('drag-origin');
    }
    drag.element.style.left = event.clientX - drag.size / 2 + 'px'; drag.element.style.top = event.clientY - drag.size / 2 + 'px';
  });
  document.addEventListener('pointerup', event => {
    if (!drag) return;
    const current = drag;
    if (current.moved) {
      current.element.remove();
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-square]');
      if (target && hints.some(m => m.to === target.dataset.square)) attemptMove(current.square, target.dataset.square);
      else { clearSelection(); renderBoard(); ChessSound.play('illegal'); }
      // Keep the drag marker through the synthetic click following pointerup.
      setTimeout(() => { if (drag === current) drag = null; }, 0);
    } else drag = null;
  });
  document.addEventListener('pointercancel', () => { if (drag) { drag.element?.remove(); drag = null; clearSelection(); renderBoard(); } });
  function attemptMove(from, to) {
    const moves = chess.moves({ square: from, verbose: true }).filter(m => m.to === to);
    if (!moves.length) { ChessSound.play('illegal'); return; }
    if (moves[0].promotion) {
      const picker = $('promotion'), boardRect = $('board').getBoundingClientRect(), rect = squares.get(to).getBoundingClientRect();
      picker.replaceChildren(); picker.style.left = (rect.left - boardRect.left) + 'px';
      picker.style.top = Math.min(rect.top - boardRect.top, boardRect.height / 2) + 'px'; picker.hidden = false;
      for (const type of ['q', 'r', 'b', 'n']) {
        const button = document.createElement('button'); button.innerHTML = PIECE_SVG[chess.turn() + type]; button.setAttribute('aria-label', 'Promote to ' + ({ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[type]));
        button.onclick = () => playMove({ from, to, promotion: type }); picker.append(button);
      }
      picker.firstChild.focus();
    } else playMove({ from, to });
  }
  function animateMove(move, reverse) {
    if (reducedMotion.matches) return Promise.resolve();
    const pairs = [[reverse ? move.to : move.from, reverse ? move.from : move.to]];
    if (move.flags === 'k' || move.flags === 'q') {
      const rank = move.color === 'w' ? '1' : '8';
      const from = (move.flags === 'k' ? 'h' : 'a') + rank, to = (move.flags === 'k' ? 'f' : 'd') + rank;
      pairs.push(reverse ? [to, from] : [from, to]);
    }
    const animations = Promise.all(pairs.map(([from, to]) => {
      const a = squares.get(from).getBoundingClientRect(), b = squares.get(to).getBoundingClientRect();
      const piece = squares.get(to).querySelector('.piece');
      if (!piece || !piece.animate) return Promise.resolve();
      return piece.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'translate(0, 0)' }], { duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' }).finished.catch(() => {});
    }));
    // Throttled frames (background tab) can stall .finished; never lock input on it.
    return Promise.race([animations, new Promise(resolve => setTimeout(resolve, 220))]);
  }
  function tick() {
    const now = performance.now(), elapsed = now - lastTick; lastTick = now;
    if (!chess || !initialTime || result) return;
    // Clocks start once White has made the first move.
    if (!chess.history().length) return;
    // Reviewing a position never pauses a live clock.
    times[chess.turn()] -= elapsed;
    if (times[chess.turn()] <= 0) { times[chess.turn()] = 0; finish(names[chess.turn() === 'w' ? 'b' : 'w'] + ' wins', 'Timeout', chess.turn() === 'w' ? 'b' : 'w'); }
    renderClocks();
  }
  async function playMove(input) {
    if (result || busy || review !== null) return;
    tick(); if (result) return;
    const move = chess.move(input); if (!move) return;
    thinking = false; clearSelection();
    if (initialTime) times[move.color] += increment * 1000;
    positions.push(chess.fen()); clockHistory.push({ ...times });
    render(); ChessSound.play(chess.inCheck() ? 'check' : move.flags === 'k' || move.flags === 'q' ? 'castle' : move.captured ? 'capture' : 'move');
    // The slide is cosmetic: the board stays playable while it runs.
    animateMove(move, false);
    checkEnd(); renderPanel(); scheduleAI();
  }
  function scheduleAI() {
    if (mode !== 'ai' || chess.turn() === human || result || review !== null || busy || document.querySelector('dialog[open]')) return;
    thinking = true; renderPanel(); const token = generation;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (token !== generation || result || review !== null || document.querySelector('dialog[open]')) {
        thinking = false; renderPanel(); return;
      }
      const move = ChessAI.findBestMove(chess, { level });
      tick(); if (token !== generation || result) return;
      thinking = false;
      if (move) playMove(move); else { checkEnd(); renderPanel(); }
    }, 260); // let the previous slide finish and the "thinking" state paint first
  }
  function checkEnd() {
    if (result) return;
    if (chess.isCheckmate()) { const winner = chess.turn() === 'w' ? 'b' : 'w'; finish(names[winner] + ' wins', 'Checkmate', winner); }
    else if (chess.isStalemate()) finish('Draw', 'Stalemate');
    else if (chess.isThreefoldRepetition()) finish('Draw', 'Threefold repetition');
    else if (chess.isFiftyMoveRule()) finish('Draw', 'Fifty-move rule');
    else if (chess.isInsufficientMaterial()) finish('Draw', 'Insufficient material');
  }
  function finish(title, reason, winner) {
    if (result) return;
    result = { title, reason, winner }; thinking = false; clearTimeout(timer); clearSelection();
    $('result-title').textContent = title; $('result-description').textContent = reason + '. A game worth coming back to.';
    ChessSound.play('end'); render();
    if (!$('end-dialog').open) $('end-dialog').showModal();
    if (mode === 'ai' && winner === human && !reducedMotion.matches) {
      for (let i = 0; i < 36; i++) {
        const dot = document.createElement('i'); dot.className = 'confetti'; dot.style.left = Math.random() * 100 + 'vw'; dot.style.animationDelay = Math.random() * .7 + 's'; document.body.append(dot); setTimeout(() => dot.remove(), 3400);
      }
    }
  }
  function startGame() {
    generation++; clearTimeout(timer); chess = new Chess(); positions = [chess.fen()];
    mode = $('mode').value; level = Number($('level').value);
    human = $('color').value === 'random' ? (Math.random() < .5 ? 'w' : 'b') : $('color').value;
    const control = $('time').value.split(',').map(Number); initialTime = control[0]; increment = control[1] || 0;
    times = { w: initialTime * 1000, b: initialTime * 1000 }; clockHistory = [{ ...times }];
    review = null; result = null; thinking = false; busy = false; flipped = mode === 'ai' && human === 'b'; clearSelection();
    lastTick = performance.now(); render(); scheduleAI();
  }
  function reviewPosition(ply) {
    if (busy) return;
    clearTimeout(timer); thinking = false; clearSelection();
    review = Math.max(0, Math.min(positions.length - 1, ply)); render();
  }
  function backToLive() { review = null; clearSelection(); render(); scheduleAI(); }
  async function undo() {
    if (busy || review !== null || !chess.history().length) return;
    generation++; clearTimeout(timer); thinking = false; result = null; $('end-dialog').close();
    busy = true; clearSelection();
    let count = mode === 'ai' && chess.turn() === human ? 2 : 1;
    // There is no human move to undo when the computer opened as White.
    while (count-- > 0 && chess.history().length) {
      const move = chess.undo(); positions.pop(); clockHistory.pop(); times = { ...clockHistory[clockHistory.length - 1] };
      render(); await animateMove(move, true);
    }
    busy = false; lastTick = performance.now(); render(); scheduleAI();
  }
  function confirmAction(title, description, action) {
    $('confirm-title').textContent = title; $('confirm-description').textContent = description;
    confirmation = action; $('confirm-dialog').showModal();
  }
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; setTimeout(() => { $('toast').hidden = true; }, 2400); }
  $('setup').onsubmit = event => { event.preventDefault(); $('new-dialog').close(); startGame(); };
  $('new-game').onclick = () => $('new-dialog').showModal();
  $('again').onclick = () => { $('end-dialog').close(); $('new-dialog').showModal(); };
  document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });
  $('new-dialog').addEventListener('close', () => { lastTick = performance.now(); scheduleAI(); });
  $('confirm-dialog').addEventListener('close', () => { lastTick = performance.now(); scheduleAI(); });
  $('mode').onchange = () => { $('level').disabled = $('mode').value === 'local'; $('color').disabled = $('mode').value === 'local'; };
  $('flip').onclick = () => { if (busy || drag) return; flipped = !flipped; clearSelection(); render(); };
  $('undo').onclick = undo;
  $('previous').onclick = () => reviewPosition((review === null ? positions.length - 1 : review) - 1);
  $('next').onclick = () => { if (review !== null && review < positions.length - 2) reviewPosition(review + 1); else backToLive(); };
  $('live').onclick = backToLive;
  $('resign').onclick = () => confirmAction('Resign this game?', 'Your opponent will win by resignation.', () => {
    const loser = mode === 'ai' ? human : chess.turn(), winner = loser === 'w' ? 'b' : 'w'; finish(names[winner] + ' wins', 'Resignation', winner);
  });
  $('draw').onclick = () => confirmAction('Agree to a draw?', names[chess.turn() === 'w' ? 'b' : 'w'] + ', do you accept the draw offer?', () => finish('Draw', 'Draw by agreement'));
  $('confirm-no').onclick = () => $('confirm-dialog').close();
  $('confirm-yes').onclick = () => { $('confirm-dialog').close(); confirmation?.(); };
  $('sound').onclick = () => { ChessSound.toggle(); ChessSound.play('move'); renderPanel(); };
  $('theme').onclick = () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = theme; store('chess-theme', theme); renderPanel(); };
  $('board-theme').onchange = () => { document.documentElement.dataset.board = $('board-theme').value; store('chess-board', $('board-theme').value); };
  $('copy').onclick = async () => {
    const outcome = result ? result.winner === 'w' ? '1-0' : result.winner === 'b' ? '0-1' : '1/2-1/2' : '*';
    const pgn = '[Event "Knightfall local game"]\n[Result "' + outcome + '"]\n\n' + chess.pgn() + ' ' + outcome;
    try { await navigator.clipboard.writeText(pgn); toast('PGN copied to clipboard'); }
    catch (_) {
      const area = document.createElement('textarea'); area.value = pgn; document.body.append(area); area.select();
      const copied = document.execCommand('copy'); area.remove();
      if (copied) toast('PGN copied to clipboard'); else window.prompt('Copy your PGN:', pgn);
    }
  };
  document.addEventListener('keydown', event => {
    if (document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); $('previous').click(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); $('next').click(); }
    if (event.key === 'Escape') { clearSelection(); renderBoard(); }
  });
  startGame(); setInterval(tick, 100);
})();
