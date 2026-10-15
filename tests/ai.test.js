'use strict';
const assert = require('node:assert/strict');
const { Chess } = require('../js/engine.js');
const AI = require('../js/ai.js');
function choose(chess, level) {
  const fen = chess.fen(), history = chess.history();
  const move = AI.findBestMove(chess, { level });
  assert.equal(chess.fen(), fen, 'Search must preserve the game position');
  assert.deepEqual(chess.history(), history, 'Search must preserve history');
  assert.ok(chess.moves({ verbose: true }).some(m => m.from === move.from && m.to === move.to && m.promotion === move.promotion), 'Move must be legal');
  return move;
}
const mate = new Chess('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1');
assert.deepEqual(choose(mate, 3), { from: 'a1', to: 'a8' });
mate.move({ from: 'a1', to: 'a8' });
assert.ok(mate.isCheckmate());
console.log('PASS finds Ra8 mate in one');
const queen = new Chess('4k3/8/8/8/3q4/8/3R4/4K3 w - - 0 1');
assert.equal(choose(queen, 3).to, 'd4');
console.log('PASS captures hanging queen');
for (const level of [1, 2, 3, 4]) {
  for (const fen of [undefined, '4k3/P7/8/8/8/8/7p/4K3 w - - 0 1', 'r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1']) choose(new Chess(fen), level);
}
assert.equal(AI.findBestMove(mate, { level: 3 }), null);
console.log('PASS all levels return legal moves, including promotions and castling positions');
