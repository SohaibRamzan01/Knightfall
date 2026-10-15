/* Search uses a private position and always balances fast make/unmake calls. */
(function (root) {
  'use strict';
  const values = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
  const squareName = s => 'abcdefgh'[s & 7] + (8 - (s >> 4));
  const MATE = 100000;
  function evaluate(chess) {
    let score = 0, phase = 0;
    for (const p of chess._board) if (p) phase += ({ n: 1, b: 1, r: 2, q: 4 }[p.type] || 0);
    const middle = Math.min(1, phase / 24);
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = chess._board[s];
      if (!p) continue;
      const file = s & 7, rank = p.color === 'w' ? 7 - (s >> 4) : s >> 4;
      const center = 3.5 - Math.abs(file - 3.5), advance = 3.5 - Math.abs(rank - 3.5);
      // Piece-square tables generated from symmetric positional features.
      const tables = {
        p: rank * 8 + center * 3,
        n: (center + advance) * 12 - (rank === 0 ? 18 : 0),
        b: (center + advance) * 6 + rank * 2,
        r: rank * 2 + (rank === 6 ? 18 : 0),
        q: (center + advance) * 3,
        k: middle * (-rank * 12 - center * 8) + (1 - middle) * (center + advance) * 14
      };
      score += (p.color === 'w' ? 1 : -1) * (values[p.type] + tables[p.type]);
    }
    return score * (chess.turn() === 'w' ? 1 : -1);
  }
  function findBestMove(game, options = {}) {
    const Chess = root.ChessEngine ? root.ChessEngine.Chess : require('./engine.js').Chess;
    const chess = new Chess(game.fen());
    const level = Math.max(1, Math.min(4, Number(options.level) || 3));
    const limits = [0, 1, 2, 3, 5];
    const deadline = Date.now() + (level === 4 ? 2500 : level === 3 ? 1000 : 500);
    const timeout = {};
    let nodes = 0;
    const order = (moves, preferred) => moves.sort((a, b) => priority(b, preferred) - priority(a, preferred));
    function priority(m, preferred) {
      return (preferred && m.from === preferred.from && m.to === preferred.to ? 20000 : 0)
        + (m.captured ? 10000 + values[m.captured] * 10 - values[m.piece] : 0)
        + (m.promotion ? values[m.promotion] : 0);
    }
    function search(depth, alpha, beta, ply, quietDepth) {
      if ((++nodes & 63) === 0 && Date.now() >= deadline) throw timeout;
      const moves = chess._genLegal(), check = chess.inCheck();
      if (!moves.length) return check ? -MATE + ply : 0;
      if (chess.isFiftyMoveRule() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) return 0;
      if (depth <= 0 && !check) {
        const stand = evaluate(chess);
        if (stand >= beta) return stand;
        alpha = Math.max(alpha, stand);
        if (quietDepth >= 8) return alpha;
      }
      const candidates = depth <= 0 && !check ? moves.filter(m => m.captured || m.promotion) : moves;
      if (ply >= 32) return evaluate(chess);
      for (const move of order(candidates)) {
        chess._make(move);
        let score;
        try { score = -search(depth - 1, -beta, -alpha, ply + 1, depth <= 0 ? quietDepth + 1 : 0); }
        finally { chess._unmake(); }
        if (score >= beta) return score;
        alpha = Math.max(alpha, score);
      }
      return alpha;
    }
    const legal = chess._genLegal();
    if (!legal.length) return null;
    // Shuffle so equally scored moves vary from game to game (sort below is stable).
    for (let i = legal.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [legal[i], legal[j]] = [legal[j], legal[i]];
    }
    let best = legal[0];
    if (level === 1 && Math.random() < 0.35) best = legal[Math.floor(Math.random() * legal.length)];
    else for (let depth = 1; depth <= limits[level]; depth++) {
      let candidate = best, alpha = -Infinity;
      try {
        for (const move of order(legal.slice(), best)) {
          if (Date.now() >= deadline) throw timeout;
          chess._make(move);
          let score;
          try { score = -search(depth - 1, -Infinity, -alpha, 1, 0); }
          finally { chess._unmake(); }
          if (score > alpha) { alpha = score; candidate = move; }
        }
        best = candidate;
        if (alpha > MATE - 100) break;
      } catch (error) { if (error !== timeout) throw error; break; }
    }
    return { from: squareName(best.from), to: squareName(best.to), ...(best.promotion ? { promotion: best.promotion } : {}) };
  }
  root.ChessAI = { findBestMove };
  if (typeof module === 'object') module.exports = root.ChessAI;
})(typeof window !== 'undefined' ? window : globalThis);
