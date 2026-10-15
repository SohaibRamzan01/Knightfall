/* Dependency-free chess rules engine (classic browser script or CommonJS).
 * Fast search API: _genLegal() returns internal {from,to,piece,color,captured,
 * promotion,flags} moves with numeric 0x88 squares and NO SAN computation.
 * Pass one of these moves to _make(move), then pair it with _unmake(). These
 * methods update position, counters and repetition state, but not public history.
 * Do not mutate internal moves or mix public undo() with outstanding search moves.
 * perft(depth) counts legal leaf nodes without SAN or game-ending draw cutoffs.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ChessEngine = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const OFF = { n: [-33,-31,-18,-14,14,18,31,33], b: [-17,-15,15,17], r: [-16,-1,1,16], q: [-17,-16,-15,-1,1,15,16,17], k: [-17,-16,-15,-1,1,15,16,17] };
  const opposite = c => c === 'w' ? 'b' : 'w';
  const name = s => 'abcdefgh'[s & 7] + (8 - (s >> 4));
  const index = s => typeof s === 'string' && /^[a-h][1-8]$/.test(s) ? (8 - Number(s[1])) * 16 + s.charCodeAt(0) - 97 : -1;
  class Chess {
    constructor(fen = START) { this.load(fen); }
    load(fen) {
      const f = typeof fen === 'string' ? fen.trim().split(/\s+/) : [];
      if (f.length !== 6 || !/^[wb]$/.test(f[1]) || !/^(?:-|K?Q?k?q?)$/.test(f[2]) || !/^(?:-|[a-h][36])$/.test(f[3]) || !/^\d+$/.test(f[4]) || !/^[1-9]\d*$/.test(f[5])) throw new Error('Invalid FEN');
      const b = Array(128).fill(null), rows = f[0].split('/'), kings = {w:0,b:0};
      if (rows.length !== 8) throw new Error('Invalid FEN');
      rows.forEach((row,r) => { let c=0; for (const x of row) { if (/[1-8]/.test(x)) c+=Number(x); else { if (!/^[pnbrqkPNBRQK]$/.test(x) || c>=8) throw new Error('Invalid FEN'); const color=x===x.toUpperCase()?'w':'b', type=x.toLowerCase(); b[r*16+c++]={type,color}; if(type==='k') kings[color]++; } } if(c!==8) throw new Error('Invalid FEN'); });
      if(kings.w!==1 || kings.b!==1) throw new Error('Invalid FEN kings');
      this._board=b; this._turn=f[1]; this._rights=f[2]==='-'?'':f[2]; this._ep=index(f[3]); this._half=Number(f[4]); this._full=Number(f[5]); this._stack=[]; this._history=[]; this._counts=new Map(); this._counts.set(this._key(),1); return this;
    }
    fen() {
      const rows=[]; for(let r=0;r<8;r++){let row='',empty=0; for(let c=0;c<8;c++){const p=this._board[r*16+c]; if(!p) empty++; else {if(empty) row+=empty;empty=0;row+=p.color==='w'?p.type.toUpperCase():p.type;}} if(empty)row+=empty;rows.push(row);}
      return rows.join('/')+' '+this._turn+' '+(this._rights||'-')+' '+(this._ep<0?'-':name(this._ep))+' '+this._half+' '+this._full;
    }
    _key(){return this.fen().split(' ').slice(0,4).join(' ');}
    turn(){return this._turn;}
    get(s){const i=index(s);return i<0||!this._board[i]?null:{...this._board[i]};}
    board(){return Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>this.get(name(r*16+c))));}
    kingSquare(color){const s=this._king(color);return s<0?null:name(s);}
    _king(color){for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const p=this._board[s];if(p&&p.type==='k'&&p.color===color)return s;}return -1;}
    _attacked(s,by){
      const dir=by==='w'?-16:16;
      for(const d of [dir-1,dir+1]){const t=s-d;if(!(t&0x88)){const p=this._board[t];if(p&&p.color===by&&p.type==='p')return true;}}
      for(const type of ['n','k','b','r']) for(const d of OFF[type]){let t=s+d;while(!(t&0x88)){const p=this._board[t];if(p){if(p.color===by&&(p.type===type||((type==='b'||type==='r')&&p.type==='q')))return true;break;}if(type==='n'||type==='k')break;t+=d;}}
      return false;
    }
    inCheck(){return this._attacked(this._king(this._turn),opposite(this._turn));}
    _pseudo(){
      const out=[],color=this._turn,b=this._board;
      const add=(from,to,flags,promotion)=>{const p=b[from],cap=flags==='e'?'p':b[to]?.type; if(cap==='k')return; const m={from,to,piece:p.type,color,flags};if(cap)m.captured=cap;if(promotion)m.promotion=promotion;out.push(m);};
      const pawn=(s,t,flag)=>{if((t>>4)===0||(t>>4)===7)for(const p of ['q','r','b','n'])add(s,t,flag+'p',p);else add(s,t,flag);};
      for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const p=b[s];if(!p||p.color!==color)continue;
        if(p.type==='p'){const d=color==='w'?-16:16,t=s+d;if(!(t&0x88)&&!b[t]){pawn(s,t,'n');if((s>>4)===(color==='w'?6:1)&&!b[t+d])add(s,t+d,'b');}for(const v of [d-1,d+1]){const t=s+v;if(t&0x88)continue;if(b[t]&&b[t].color!==color)pawn(s,t,'c');else if(t===this._ep&&!b[t]&&b[t-d]?.type==='p'&&b[t-d].color!==color)add(s,t,'e');}}
        else for(const d of OFF[p.type]){let t=s+d;while(!(t&0x88)){if(b[t]?.color===color)break;add(s,t,b[t]?'c':'n');if(b[t]||p.type==='n'||p.type==='k')break;t+=d;}}
      }
      const home=color==='w'?112:0,k=home+4,enemy=opposite(color);
      if(b[k]?.type==='k'&&b[k].color===color&&!this._attacked(k,enemy))for(const side of ['k','q']){const right=color==='w'?side.toUpperCase():side,rook=home+(side==='k'?7:0),step=side==='k'?1:-1;if(this._rights.includes(right)&&b[rook]?.type==='r'&&b[rook].color===color&&!b[k+step]&&!b[k+step*2]&&(side==='k'||!b[k-3])&&!this._attacked(k+step,enemy)&&!this._attacked(k+step*2,enemy))add(k,k+step*2,side);}
      return out;
    }
    _genLegal(){const color=this._turn,out=[];for(const m of this._pseudo()){this._make(m);const ok=!this._attacked(this._king(color),this._turn);this._unmake();if(ok)out.push(m);}return out;}
    _make(m){
      const b=this._board,changes=new Map(),put=(s,p)=>{if(!changes.has(s))changes.set(s,b[s]);b[s]=p;};
      this._stack.push({changes,turn:this._turn,rights:this._rights,ep:this._ep,half:this._half,full:this._full});
      put(m.from,null);put(m.to,{type:m.promotion||m.piece,color:m.color});
      if(m.flags.includes('e'))put(m.to+(m.color==='w'?16:-16),null);
      if(m.flags==='k'||m.flags==='q'){const r=m.flags==='k'?m.to+1:m.to-2;put(m.flags==='k'?m.to-1:m.to+1,b[r]);put(r,null);}
      if(m.piece==='k')this._rights=this._rights.replace(m.color==='w'?/[KQ]/g:/[kq]/g,'');
      for(const [s,r] of [[112,'Q'],[119,'K'],[0,'q'],[7,'k']])if(m.from===s||m.to===s)this._rights=this._rights.replace(r,'');
      this._ep=m.flags==='b'?(m.from+m.to)/2:-1;this._half=m.piece==='p'||m.captured?0:this._half+1;if(this._turn==='b')this._full++;this._turn=opposite(this._turn);
      const key=this._key();this._counts.set(key,(this._counts.get(key)||0)+1);
    }
    _unmake(){const st=this._stack.pop();if(!st)return null;const key=this._key(),n=this._counts.get(key);if(n===1)this._counts.delete(key);else this._counts.set(key,n-1);for(const [s,p]of st.changes)this._board[s]=p;this._turn=st.turn;this._rights=st.rights;this._ep=st.ep;this._half=st.half;this._full=st.full;return st;}
    _san(m,legal){
      let san='';if(m.flags==='k')san='O-O';else if(m.flags==='q')san='O-O-O';else {if(m.piece!=='p'){san=m.piece.toUpperCase();const others=legal.filter(x=>x!==m&&x.piece===m.piece&&x.to===m.to&&x.from!==m.from);if(others.length){const file=others.some(x=>(x.from&7)===(m.from&7)),rank=others.some(x=>(x.from>>4)===(m.from>>4));san+=!file?name(m.from)[0]:!rank?name(m.from)[1]:name(m.from);}}else if(m.captured)san=name(m.from)[0];if(m.captured)san+='x';san+=name(m.to);if(m.promotion)san+='='+m.promotion.toUpperCase();}
      this._make(m);if(this.inCheck())san+=this._genLegal().length?'+':'#';this._unmake();return san;
    }
    _verbose(m,legal){const v={...m,from:name(m.from),to:name(m.to),san:this._san(m,legal)};return v;}
    moves(options={}){const all=this._genLegal(),selected=options.square===undefined?all:all.filter(m=>m.from===index(options.square));return selected.map(m=>options.verbose?this._verbose(m,all):this._san(m,all));}
    move(input){const all=this._genLegal();let m;if(typeof input==='string'){const clean=s=>s.replace(/0/g,'O').replace(/[+#]?[!?]*$/,'');m=all.find(x=>clean(this._san(x,all))===clean(input.trim()));}else if(input&&typeof input==='object')m=all.find(x=>x.from===index(input.from)&&x.to===index(input.to)&&(!x.promotion||x.promotion===(input.promotion||'q')));if(!m)return null;const v=this._verbose(m,all);const full=this._full;this._make(m);this._history.push({move:v,full});return {...v};}
    undo(){const h=this._history.pop();if(!h)return null;this._unmake();return {...h.move};}
    history(options={}){return this._history.map(h=>options.verbose?{...h.move}:h.move.san);}
    isCheckmate(){return this.inCheck()&&this._genLegal().length===0;}
    isStalemate(){return !this.inCheck()&&this._genLegal().length===0;}
    isInsufficientMaterial(){const pieces=[];for(let s=0;s<128;s++){if(s&0x88){s+=7;continue;}const p=this._board[s];if(p&&p.type!=='k')pieces.push({type:p.type,shade:((s>>4)+(s&7))%2});}if(pieces.length===0)return true;if(pieces.length===1)return ['b','n'].includes(pieces[0].type);return pieces.every(p=>p.type==='b')&&pieces.every(p=>p.shade===pieces[0].shade);}
    isThreefoldRepetition(){return (this._counts.get(this._key())||0)>=3;}
    isFiftyMoveRule(){return this._half>=100;}
    isDraw(){return this.isStalemate()||this.isInsufficientMaterial()||this.isThreefoldRepetition()||this.isFiftyMoveRule();}
    isGameOver(){return this.isCheckmate()||this.isDraw();}
    pgn(){let out='';this._history.forEach((h,i)=>{if(out)out+=' ';if(h.move.color==='w')out+=h.full+'. ';else if(i===0)out+=h.full+'... ';out+=h.move.san;});return out;}
    perft(depth){if(!Number.isInteger(depth)||depth<0)throw new Error('Invalid depth');if(depth===0)return 1;const moves=this._genLegal();if(depth===1)return moves.length;let n=0;for(const m of moves){this._make(m);n+=this.perft(depth-1);this._unmake();}return n;}
  }
  return {Chess};
});
