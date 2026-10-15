'use strict';
const { Chess } = require('../js/engine.js');
let failures = 0;
function check(label, test) {
  try { if (!test()) throw new Error('unexpected result'); console.log('PASS ' + label); }
  catch (e) { failures++; console.error('FAIL ' + label + ': ' + e.message); }
}
const cases = [
  ['startpos', undefined, [20,400,8902,197281]],
  ['Kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48,2039,97862]],
  ['rook endgame', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14,191,2812,43238]],
  ['promotion and castling', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6,264,9467]],
  ['tactical promotions', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44,1486,62379]]
];
for (const [label,fen,counts] of cases) {
  const chess = new Chess(fen), original = chess.fen();
  counts.forEach((expected,i) => check(label + ' depth ' + (i+1), () => {
    const actual = chess.perft(i+1);
    if(actual!==expected) throw new Error('expected '+expected+', got '+actual);
    return chess.fen()===original && chess.history().length===0;
  }));
}
check("Scholar's mate", () => {
  const c=new Chess();
  for(const san of ['e4','e5','Bc4','Nc6','Qh5','Nf6','Qxf7#']) if(!c.move(san))throw new Error('rejected '+san);
  return c.isCheckmate() && c.history().at(-1)==='Qxf7#' && c.isGameOver();
});
check('stalemate',()=>new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1').isStalemate());
check('bishop insufficient material',()=>new Chess('7k/8/6K1/8/8/8/8/2B5 w - - 0 1').isInsufficientMaterial());
check('SAN file disambiguation',()=>{
  const c=new Chess('7k/8/8/8/8/8/8/1N2KN2 w - - 0 1');
  return c.moves().includes('Nbd2') && c.moves().includes('Nfd2') && c.move('Nd2')===null && c.move('Nbd2').san==='Nbd2';
});
check('SAN rank disambiguation',()=>new Chess('7k/8/8/8/8/4R3/8/K3R3 w - - 0 1').moves().includes('R1e2'));
check('undo restores exact FEN',()=>{
  for(const [,fen] of cases){const c=new Chess(fen),before=c.fen();for(const m of c.moves({verbose:true})){if(!c.move(m))return false;c.undo();if(c.fen()!==before)return false;}}return true;
});
check('threefold and undo',()=>{
  const c=new Chess();for(let i=0;i<2;i++)for(const s of ['Nf3','Nf6','Ng1','Ng8'])c.move(s);
  if(!c.isThreefoldRepetition())return false;c.undo();return !c.isThreefoldRepetition();
});
check('pinned en passant illegal',()=>!new Chess('7k/8/8/r4pPK/8/8/8/8 w - f6 0 1').moves({square:'g5',verbose:true}).some(m=>m.flags==='e'));
check('promotion defaults to queen',()=>new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1').move({from:'a7',to:'a8'}).promotion==='q');
check('fifty move rule',()=>new Chess('7k/8/8/8/8/8/R7/K7 w - - 100 51').isFiftyMoveRule());
check('PGN',()=>{const c=new Chess();for(const m of ['e4','e5','Nf3','Nc6'])c.move(m);return c.pgn()==='1. e4 e5 2. Nf3 Nc6';});
check('browser classic script export',()=>{const vm=require('node:vm'),fs=require('node:fs'),ctx={window:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../js/engine.js'),'utf8'),ctx);return new ctx.window.ChessEngine.Chess().perft(1)===20;});
process.exitCode=failures?1:0;
