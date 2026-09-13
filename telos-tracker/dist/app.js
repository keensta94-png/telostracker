import {LABELS, CYCLE, getEntry, getNext, getTicksAfter, CHAT_PATTERNS} from './mechanics.js';

const $ = id => document.getElementById(id);
const state = {phase:1,current:null,next:'tendrils',remaining:7,autos:0,chat:false,playerArea:null,lastChat:'',lastAutoAt:0};
const alt = window.alt1;

function now(){return new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function log(text, kind='info'){const e=document.createElement('div');e.className='entry';e.innerHTML=`<span class="time">${now()}</span><span class="kind">${kind}</span> ${escapeHtml(text)}`;$('log').prepend(e);while($('log').children.length>80)$('log').lastChild.remove();}
function escapeHtml(s){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[c]));}

function renderButtons(){
  const grid=$('mechanicGrid');grid.innerHTML='';
  Object.entries(LABELS).forEach(([id,label])=>{
    const b=document.createElement('button');b.className='mech';b.dataset.mech=id;
    b.innerHTML=`<div class="name">${label}</div><div class="ticks">Next gap: ${getTicksAfter(state.phase,id)} autos</div>`;
    b.onclick=()=>mechanic(id,'manual');grid.appendChild(b);
  });
}
function render(){
  $('phase').textContent=state.phase;
  $('current').textContent=state.current?LABELS[state.current]:'Waiting...';
  $('next').textContent=LABELS[state.next]||'—';
  $('nextTicks').textContent=state.remaining===0?'NOW':`${state.remaining} autos to go`;
  $('autoCount').textContent=state.autos;
  const total=Math.max(1,state.remaining + state.autos);$('progressBar').style.width=`${Math.max(0,Math.min(100,100-(state.remaining/Math.max(1,total))*100))}%`;
  $('counterText').textContent=state.current?`After ${LABELS[state.current]} — counting toward ${LABELS[state.next]}`:'Waiting for the next mechanic';
  $('detectorState').textContent=state.chat?'Detector: chat OCR on':(alt?'Detector: Alt1 ready':'Detector: manual/browser');
  document.querySelectorAll('.mech').forEach(b=>b.classList.toggle('active',b.dataset.mech===state.current));
}

function setPhase(p){
  const previous = state.current;
  state.phase=p;state.current=null;state.autos=0;
  const entry=getEntry(p,previous);
  state.next=entry.mechanic;state.remaining=entry.ticks;
  const carry=entry.carry?' via carry-over':'';
  log(`Switched to Phase ${p}${carry} → ${LABELS[state.next]} after ${state.remaining} autos`,'PHASE');render();
}

function mechanic(id,source='manual'){
  state.current=id;state.autos=0;state.next=getNext(state.phase,id);state.remaining=getTicksAfter(state.phase,id);
  log(`${LABELS[id]} detected (${source}) → next ${LABELS[state.next]} after ${state.remaining} autos`,'MECHANIC');render();
}

function auto(){
  if(state.remaining>0)state.remaining--;
  state.autos++;
  if(state.remaining===0) log(`Next mechanic should now be ${LABELS[state.next]}`,'READY');
  render();
}
function undo(){if(state.autos>0){state.autos--;state.remaining++;render();}}

function findMechanic(text){
  const s=text.toLowerCase().replace(/[\u2019']/g,"'").replace(/\s+/g,' ').trim();
  for(const item of CHAT_PATTERNS)for(const p of item.patterns)if(s.includes(p))return item.mechanic;
  return null;
}

// Alt1 chat polling. This intentionally has a conservative fallback: if the chat
// reader cannot locate the box, the app remains usable with manual mechanic buttons.
let bindId=null;
function startChatOCR(){
  if(!alt || !alt.rsLinked){log('Alt1/RS client not available. Open this page through Alt1 first.','WARN');return;}
  if(!alt.permissionPixel){log('Enable Pixel / Screen permissions for this app in Alt1.','WARN');return;}
  state.chat=true; $('chatBtn').textContent='Chat OCR running';
  try{bindId=alt.bindRegion(0,0,alt.rsWidth,alt.rsHeight);log('Chat OCR started. Keep the game-message chat visible.','OCR');}catch(e){log('Could not bind the RuneScape screen: '+e,'WARN');return;}
  pollChat();render();
}
function pollChat(){
  if(!state.chat||!alt||!bindId)return;
  // Standard RS3 chat is bottom-left. We sample a grid of baselines. The distinctive
  // phrase match makes this tolerant of partial OCR and chatbox resizing.
  const w=alt.rsWidth||800,h=alt.rsHeight||600;
  const minY=Math.floor(h*0.70),maxY=Math.floor(h*0.98);
  const minX=0,maxX=Math.floor(w*0.75);
  let found=null;
  for(let y=minY;y<maxY&&!found;y+=9){
    for(let x=minX;x<maxX&&!found;x+=22){
      try{
        const text=alt.bindReadString(bindId,'chat',x,y);
        const mech=findMechanic(text||'');
        if(mech && text!==state.lastChat){state.lastChat=text;found={mech,text};}
      }catch{}
    }
  }
  if(found){mechanic(found.mech,'chat');log(`OCR: ${found.text}`,'CHAT');}
  setTimeout(pollChat, Math.max(250, alt.captureInterval||400));
}

// Experimental hit-splat detector. It is deliberately opt-in and conservative.
// The user places the mouse over their character and clicks the calibration button.
function setPlayerArea(){
  if(!alt||!alt.rsLinked){log('Alt1 is not available.','WARN');return;}
  const packed=alt.mousePosition;
  const x=(packed>>16)&0xffff,y=packed&0xffff;
  state.playerArea={x:Math.max(0,x-90),y:Math.max(0,y-90),w:180,h:180};
  log(`Hit-splat area calibrated around ${x}, ${y}.`,'CALIBRATE');
  $('detectHelp').textContent='Hit area set. This detector is experimental; use +1 auto if it misses a hit.';
  startHitDetector();
}
let hitTimer=null,lastRed=0;
function startHitDetector(){
  if(hitTimer)clearInterval(hitTimer);
  if(!state.playerArea||!alt||!alt.rsLinked||!alt.permissionPixel)return;
  let previous=0;
  hitTimer=setInterval(()=>{
    try{
      const a=state.playerArea;
      const id=alt.bindScreenRegion(a.x,a.y,a.w,a.h);
      let score=0;
      // Sparse sampling keeps the detector cheap. A new cluster of bright red/orange
      // pixels is treated as a possible damage splat; cooldown prevents double counts.
      for(let y=15;y<a.h;y+=8)for(let x=15;x<a.w;x+=8){
        const p=alt.bindGetPixel(id,x,y); // packed RGBA/ABGR varies by API version; inspect red-ish channels via byte extraction
        const r=p&255,g=(p>>8)&255,b=(p>>16)&255;
        if(r>150&&r>g*1.35&&r>b*1.25)score++;
      }
      if(score>12 && previous<=12 && Date.now()-lastRed>500){lastRed=Date.now();auto();log('Possible hit-splat detected','HIT');}
      previous=score;
    }catch{}
  },250);
}

$('resetBtn').onclick=()=>{state.phase=1;state.current=null;state.next='tendrils';state.remaining=7;state.autos=0;state.lastChat='';log('Tracker reset','RESET');render();};
$('autoBtn').onclick=auto;$('undoAuto').onclick=undo;$('chatBtn').onclick=startChatOCR;$('playerBtn').onclick=setPlayerArea;$('clearLog').onclick=()=>$('log').replaceChildren();
document.querySelectorAll('[data-phase]').forEach(b=>b.onclick=()=>setPhase(Number(b.dataset.phase)));

renderButtons();
if(alt){$('status').textContent=alt.rsLinked?'Alt1 detected — ready to monitor RuneScape':'Alt1 API present — RuneScape client not linked';}
log('Tracker loaded. Start with the phase buttons or confirm a mechanic manually.','READY');
