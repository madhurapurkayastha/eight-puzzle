// ============ CONSTANTS ============
const GOAL      = [1,2,3,4,5,6,7,8,0];
const GOAL_KEY  = GOAL.join(',');
const TOTAL     = 181440;
const DIFFS = {
  easy:   {lo:5,  hi:12, walks:20 },
  medium: {lo:13, hi:22, walks:45 },
  hard:   {lo:23, hi:31, walks:100}
};

// ============ CORE UTILS ============
const key = s => s.join(',');
function manhattan(s){
  let d=0;
  for(let i=0;i<9;i++){const v=s[i];if(v)d+=Math.abs(~~(i/3)-~~((v-1)/3))+Math.abs(i%3-(v-1)%3);}
  return d;
}
function neighbors(s){
  const bi=s.indexOf(0),br=~~(bi/3),bc=bi%3,res=[];
  for(const[dr,dc,dir]of[[-1,0,'Up'],[1,0,'Down'],[0,-1,'Left'],[0,1,'Right']]){
    const nr=br+dr,nc=bc+dc;
    if(nr>=0&&nr<3&&nc>=0&&nc<3){
      const ns=[...s],ni=nr*3+nc;[ns[bi],ns[ni]]=[ns[ni],ns[bi]];
      res.push({state:ns,dir,blankWas:bi});
    }
  }
  return res;
}

// ============ MIN-HEAP ============
class MinHeap{
  constructor(){this.h=[];}
  push(x){this.h.push(x);this._up(this.h.length-1);}
  pop(){const t=this.h[0],l=this.h.pop();if(this.h.length){this.h[0]=l;this._down(0);}return t;}
  _up(i){while(i>0){const p=(i-1)>>1;if(this.h[p].f<=this.h[i].f)break;[this.h[p],this.h[i]]=[this.h[i],this.h[p]];i=p;}}
  _down(i){const n=this.h.length;while(true){let m=i,l=2*i+1,r=2*i+2;if(l<n&&this.h[l].f<this.h[m].f)m=l;if(r<n&&this.h[r].f<this.h[m].f)m=r;if(m===i)break;[this.h[m],this.h[i]]=[this.h[i],this.h[m]];i=m;}}
  get size(){return this.h.length;}
}

// ============ A* ============
function astar(start){
  if(key(start)===GOAL_KEY)return[];
  const heap=new MinHeap();
  heap.push({f:manhattan(start),g:0,state:start,path:[]});
  const vis=new Map([[key(start),0]]);
  while(heap.size>0){
    const{f,g,state,path}=heap.pop();
    const k=key(state);
    if(k===GOAL_KEY)return path;
    if(g>(vis.get(k)??Infinity))continue;
    for(const{state:ns,dir,blankWas}of neighbors(state)){
      const ng=g+1,nk=key(ns);
      if(ng<(vis.get(nk)??Infinity)){
        vis.set(nk,ng);
        heap.push({f:ng+manhattan(ns),g:ng,state:ns,
                   path:[...path,{state:ns,dir,blankWas}]});
      }
    }
  }
  return null;
}

// ============ BFS PRECOMPUTE ============
const distMap   = new Map();
const stepCount = {};
function precompute(){
  const q=[GOAL];distMap.set(GOAL_KEY,0);stepCount[0]=1;
  let head=0;
  while(head<q.length){
    const s=q[head++],d=distMap.get(key(s));
    for(const{state:ns}of neighbors(s)){
      const nk=key(ns);
      if(!distMap.has(nk)){distMap.set(nk,d+1);stepCount[d+1]=(stepCount[d+1]||0)+1;q.push(ns);}
    }
  }
}

// ============ PUZZLE GEN ============
function genPuzzle(diff){
  const{lo,hi,walks}=DIFFS[diff];
  for(let a=0;a<400;a++){
    let s=[...GOAL],prev=null;
    const steps=walks+~~(Math.random()*walks/2);
    for(let i=0;i<steps;i++){
      const nb=neighbors(s).filter(n=>key(n.state)!==prev);
      const c=nb[~~(Math.random()*nb.length)];
      prev=key(s);s=c.state;
    }
    const opt=distMap.get(key(s))??0;
    if(opt>=lo&&opt<=hi)return s;
  }
  let s=[...GOAL],prev=null;
  for(let i=0;i<300;i++){const nb=neighbors(s).filter(n=>key(n.state)!==prev);const c=nb[~~(Math.random()*nb.length)];prev=key(s);s=c.state;}
  return s;
}

// ============ GAME STATE ============
const G={state:null,initial:null,solution:[],aiIdx:0,aiTimer:null,aiOn:false,
         moves:0,diff:'medium',mode:'manual',hintIdx:null,blinkInt:null,
         timerOn:false,timerJob:null,elapsed:0,tStart:0};

// ============ DOM HELPERS ============
const $=id=>document.getElementById(id);
const fmt=t=>{const m=~~(t/60),s=~~(t%60);return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;};

function updStats(moves,mode,modeColor,optimal,perm){
  if(moves!=null)$('moves').textContent='Your Moves: '+moves;
  if(mode!=null){$('mode').textContent=mode;$('mode').style.color=modeColor||'var(--grn)';}
  if(optimal!=null)$('optimal').textContent='Optimal Steps: '+optimal;
  if(perm!=null)$('perm').textContent=perm;
}

function updPerm(){
  const opt=distMap.get(key(G.state))??-1;
  if(opt>=0){
    const cnt=stepCount[opt]||0,pct=(cnt/TOTAL*100).toFixed(1);
    $('optimal').textContent='Optimal Steps: '+opt;
    $('perm').textContent='\uD83D\uDD22 '+cnt.toLocaleString()+' / '+TOTAL.toLocaleString()+' configs ('+pct+'%) share this '+opt+'-step optimal distance';
  }
}

// ============ BOARD ============
function renderBoard(aiAt=null){
  const board=$('board');board.innerHTML='';
  const bi=G.state.indexOf(0),br=~~(bi/3),bc=bi%3;
  for(let i=0;i<9;i++){
    const v=G.state[i],r=~~(i/3),c=i%3;
    const btn=document.createElement('button');
    btn.className='tile';
    if(v===0){btn.classList.add('empty');btn.disabled=true;}
    else{
      btn.textContent=v;
      const mv=Math.abs(r-br)+Math.abs(c-bc)===1;
      if(aiAt===i)           btn.classList.add('ai');
      else if(G.hintIdx===i) btn.classList.add('hint-tile');
      else if(mv&&G.mode==='manual') btn.classList.add('moveable');
      btn.addEventListener('click',()=>handleClick(i));
    }
    board.appendChild(btn);
  }
}

// ============ TIMER ============
function tStart(){G.timerOn=true;G.tStart=Date.now()-G.elapsed*1000;tTick();}
function tTick(){
  if(!G.timerOn)return;
  G.elapsed=(Date.now()-G.tStart)/1000;
  $('timer').textContent='\u23F1 '+fmt(G.elapsed);
  G.timerJob=setTimeout(tTick,500);
}
function tStop(){G.timerOn=false;clearTimeout(G.timerJob);}
function tReset(){tStop();G.elapsed=0;$('timer').textContent='\u23F1 00:00';}

// ============ BLINK ============
function cancelBlink(){clearInterval(G.blinkInt);G.blinkInt=null;}
function startBlink(idx){
  cancelBlink();
  let on=true;
  G.blinkInt=setInterval(()=>{
    const t=document.querySelectorAll('.tile')[idx];
    if(t){t.classList.toggle('blinking',on);}
    on=!on;
  },450);
}

// ============ CLICK ============
function handleClick(idx){
  if(G.mode!=='manual'||G.aiOn)return;
  const bi=G.state.indexOf(0),br=~~(bi/3),bc=bi%3,r=~~(idx/3),c=idx%3;
  if(Math.abs(r-br)+Math.abs(c-bc)!==1)return;
  if(!G.timerOn&&G.moves===0)tStart();
  [G.state[bi],G.state[idx]]=[G.state[idx],G.state[bi]];
  G.moves++;G.hintIdx=null;$('hint-label').textContent='';cancelBlink();
  updStats(G.moves);updPerm();renderBoard();
  if(key(G.state)===GOAL_KEY)onWin();
}

// ============ HINT ============
function showHint(){
  if(G.mode==='ai'||G.aiOn)return;
  const sol=astar(G.state);
  if(!sol||!sol.length){$('hint-label').textContent='\u2705 Already at goal!';return;}
  const{state:ns,dir}=sol[0];
  let hi=-1;
  for(let i=0;i<9;i++){if(G.state[i]!==ns[i]&&G.state[i]!==0){hi=i;break;}}
  G.hintIdx=hi;
  $('hint-label').textContent='\uD83D\uDCA1 Move tile '+G.state[hi]+'  \u2192  '+dir;
  cancelBlink();renderBoard();startBlink(hi);
}

// ============ AI ============
function startAI(){
  if(G.aiOn)return;
  cancelBlink();tStop();G.hintIdx=null;$('hint-label').textContent='';
  const sol=astar(G.state);
  if(sol===null){alert('No solution found!');return;}
  if(!sol.length){alert('Already solved!');return;}
  G.solution=sol;
  const opt=sol.length,cnt=stepCount[opt]||0;
  $('optimal').textContent='Optimal Steps: '+opt;
  $('perm').textContent='\uD83D\uDD22 '+cnt.toLocaleString()+' / '+TOTAL.toLocaleString()+' configs share this '+opt+'-step distance';
  updStats(null,'\u25CF AI MODE (solving...)',   'var(--purple)');
  $('btn-hint').disabled=true;$('btn-ai').disabled=true;
  G.mode='ai';G.aiOn=true;G.aiIdx=0;
  tStart();aiStep();
}

function aiStep(){
  if(G.aiIdx<G.solution.length){
    const{state:ns,blankWas}=G.solution[G.aiIdx];
    const blankPos=G.state.indexOf(0);  // blank's current pos = where tile will land
    G.state=[...ns];G.aiIdx++;
    renderBoard(blankPos);             // purple highlight on the tile that just moved
    G.aiTimer=setTimeout(aiStep,550);
  } else {
    tStop();G.aiOn=false;
    const total=G.solution.length;
    updStats(null,'\u2705 AI Done ('+total+' steps)','var(--grn)');
    $('btn-hint').disabled=false;$('btn-ai').disabled=false;
    setTimeout(()=>alert('Puzzle solved by AI!\n\nOptimal Steps: '+total+'\nTime Taken: '+fmt(G.elapsed)),80);
  }
}

// ============ WIN ============
function onWin(){
  cancelBlink();tStop();
  const opt=distMap.get(key(G.initial))??0;
  updStats(null,'\uD83C\uDF89 SOLVED!','var(--gold)');
  let msg='Congratulations! \uD83C\uDF89\n\nYour Moves: '+G.moves+'\nOptimal Steps: '+opt+'\nTime: '+fmt(G.elapsed);
  if(G.moves===opt)         msg+='\n\n\u2B50 Perfect \u2014 Optimal Solution!';
  else if(G.moves<=opt+3)   msg+='\n\n\uD83D\uDC4F Great \u2014 Very close to optimal!';
  setTimeout(()=>alert(msg),80);
}

// ============ DIFFICULTY ============
function setDiff(d){
  G.diff=d;
  document.querySelectorAll('.diff-btn').forEach(b=>b.classList.toggle('active',b.dataset.diff===d));
  newGame();
}

// ============ NEW / RESET ============
function newGame(){
  clearTimeout(G.aiTimer);cancelBlink();tReset();
  if(!distMap.size)return;
  G.initial=genPuzzle(G.diff);G.state=[...G.initial];
  G.moves=0;G.hintIdx=null;G.mode='manual';G.aiIdx=0;G.solution=[];G.aiOn=false;
  $('hint-label').textContent='';
  $('btn-hint').disabled=false;$('btn-ai').disabled=false;
  updStats(0,'\u25CF MANUAL MODE','var(--grn)');updPerm();renderBoard();
}
function resetGame(){
  clearTimeout(G.aiTimer);cancelBlink();tReset();
  G.state=[...G.initial];G.moves=0;G.hintIdx=null;G.mode='manual';G.aiIdx=0;G.aiOn=false;
  $('hint-label').textContent='';
  $('btn-hint').disabled=false;$('btn-ai').disabled=false;
  updStats(0,'\u25CF MANUAL MODE','var(--grn)');updPerm();renderBoard();
}

// ============ INIT ============
window.addEventListener('DOMContentLoaded',()=>{
  $('perm').textContent='\u23F3 Building solution map (181,440 states)...';
  setTimeout(()=>{
    precompute();
    G.initial=genPuzzle(G.diff);G.state=[...G.initial];
    updStats(0,'\u25CF MANUAL MODE','var(--grn)');updPerm();renderBoard();
    $('btn-hint') .addEventListener('click',showHint);
    $('btn-ai')   .addEventListener('click',startAI);
    $('btn-new')  .addEventListener('click',newGame);
    $('btn-reset').addEventListener('click',resetGame);
    document.querySelectorAll('.diff-btn').forEach(b=>b.addEventListener('click',()=>setDiff(b.dataset.diff)));
  },60);
});
