import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

// Build stamp from the page (index.html loads game.js?v=<commit>), added to sounds and the model so a new release never mixes with cached files.
const BUILD=new URL(import.meta.url).searchParams.get('v')||'dev';

// ---------------------------------------------------------------------------------------------------------------
// SouSou Bus is played in levels. Each level is a timed shift with a money goal: fill buses with travelers for their
// country, send them, swipe to where they arrive and claim the fares. Reach the goal to win; run out of time or of
// the 3 hearts (lost when a group does not fit or a claim is missed) and you lose. Stars = hearts left.
// The stations and buses of a level are part of its design and its difficulty; coins only buy small boosters.
// ---------------------------------------------------------------------------------------------------------------
const STATIONS = [
  {id:'tunis',name:'Tunis',country:'Tunisia',code:'TN',accent:0xf7a86a,shirt:0xe8833f},
  {id:'paris',name:'Paris',country:'France',code:'FR',accent:0xa5c9ed,shirt:0x5b8fd6},
  {id:'rome',name:'Rome',country:'Italy',code:'IT',accent:0xeec99b,shirt:0x52a86b},
  {id:'barcelona',name:'Barcelona',country:'Spain',code:'ES',accent:0xf5bca2,shirt:0xe0b13a},
  {id:'berlin',name:'Berlin',country:'Germany',code:'DE',accent:0xbbc9da,shirt:0x6d6f78},
  {id:'istanbul',name:'Istanbul',country:'Türkiye',code:'TR',accent:0xcbb2d6,shirt:0xd2475a}
];
const city=Object.fromEntries(STATIONS.map(s=>[s.id,s]));
const $=id=>document.getElementById(id);
const flagMarkup=(id,className='flag-icon')=>`<img class="${className}" src="./flags/${city[id].code.toLowerCase()}.svg" alt="" aria-hidden="true">`;
// Icons are single-colour SVGs (Streamline Plump Solid) used as CSS masks, so they take the text colour.
const icon=(name,className='')=>`<i class="ico ${className}" style="--i:url(./icons/${name}.svg)" aria-hidden="true"></i>`;
const euro=n=>'€'+Math.floor(n).toLocaleString('en-US');
const shortEuro=n=>n>=1000?'€'+(n/1000).toFixed(n%1000?1:0).replace(/\.0$/,'')+'k':euro(n);
const SAVE_KEY='souha-bus-station-stories-v1',CAPACITY=20,PERSON_SCALE=.58,MAX_HEARTS=3,COMBO_STEP=4;
const BAYS=[{x:-2.15,z:-2},{x:0,z:0},{x:2.15,z:2}],LANE_EDGES=[-3.1,-1.02,1.02,3.1];
// Where the raised walkway stops behind bay i (just past the rear of a parked coach).
const platformEdge=i=>BAYS[i].x-1.98;
const SPECIALS={
  vip:{icon:'star',label:'VIP · combo ×2',chance:.06,color:0xffc93c},
  gift:{icon:'gift',label:'Gift',chance:.06,color:0xff7ab8,bonus:60},
  heart:{icon:'heart',label:'Extra life',chance:.025,color:0xff5f6d},
  rush:{icon:'flash',label:'Rush · combo frozen',chance:.04,color:0x48c8ff},
  diamond:{icon:'diamond',label:'Diamond',chance:.015,color:0x8ee8ff,bonus:250}};
const SPECIAL_CSS={vip:'#ffc800',gift:'#ff86d0',heart:'#ff4b4b',rush:'#1cb0f6',diamond:'#7fe3ff'};
const stationIndex=id=>STATIONS.findIndex(s=>s.id===id);
const distance=(a,b)=>Math.abs(stationIndex(a)-stationIndex(b));
// Longer routes pay more per traveler and take longer to drive.
const fareFor=(origin,dest)=>12+6*distance(origin,dest);
const tripTime=(origin,dest)=>(7+2*distance(origin,dest))*1000;

// Boosters: the only things coins buy. They make every level a little kinder, never change the level itself.
const UPGRADES={
  patience:{name:'Patient travelers',icon:'timer',effect:level=>`Travelers wait ${level*10}% longer`,next:'+10% waiting time'},
  claim:{name:'Longer claims',icon:'bag',effect:level=>`+${(level*1.5).toFixed(1)} s to claim arrived buses`,next:'+1.5 s to claim'},
  combo:{name:'Combo keeper',icon:'crown',effect:level=>`Combos last ${(level*.15).toFixed(2)} s longer`,next:'+0.15 s combo window'}};
const UPGRADE_MAX=5,upgradeCost=level=>Math.round(1500*1.9**level/100)*100;

// Level design: every 3 levels a new country joins (more destinations, longer and better-paid routes); inside each
// group of 3 the level gives one bus fewer. Traveler patience, bonus speed, groups and claim time get tougher over the
// first 16 levels (t: 0 → 1); after that the levels keep growing (e: 0 → 1 over the next 24): fewer buses, shorter
// claims, faster travelers, bigger groups. Goals are a share of what a quick player earns in a full shift (measured
// with a test player): 22% at level 1, 70% by level 16, then +1% per level up to 95%.
function levelConfig(n){
  const k=Math.min(STATIONS.length,2+Math.floor((n-1)/3)),stations=STATIONS.slice(0,k).map(s=>s.id),up=game.upgrades;
  const t=Math.min(1,(n-1)/15),e=Math.min(1,Math.max(0,n-16)/24),patience=(1+.1*up.patience)*(1-.2*e);
  const potential=9500*(1+.25*(k-2)),share=n<=16?.22+.48*t:Math.min(.95,.7+.01*(n-16));
  return {n,stations,buses:Math.max(k+2,2*k+2-(n-1)%3-Math.floor(4*e)),duration:(60+10*(k-2))*1000,
    target:Math.round(potential*share/50)*50,
    life:[(2800-1000*t)*patience,(4000-1300*t)*patience],bonusLife:600-150*t-50*e,
    claim:Math.max(6000,12000-3500*t-2000*e)+1500*up.claim,combo:1500-200*t-150*e+150*up.combo,
    groupChance:.25+.3*t+.1*e,maxGroup:3+Math.round(2*t+e),spawn:190-50*t};}

// ---------------------------------------------------------------------------------------------------------------
// Saved progress: coins, the next level to play, best stars per level and boosters. A level in progress is not saved.
// ---------------------------------------------------------------------------------------------------------------
function freshGame(){return {version:3,coins:0,level:1,stars:{},upgrades:{patience:0,claim:0,combo:0},bestCombo:0};}
// Earlier saves (free play) keep their coins, including fares still sitting on buses, and start at level 1.
function migrate(old){const owed=(old.buses||[]).reduce((sum,b)=>sum+(b.payout||0)+(b.revenue||0),0);return {...freshGame(),coins:Math.floor((old.coins||0)+owed),bestCombo:old.bestCombo||0};}
function load(){try{const data=JSON.parse(localStorage.getItem(SAVE_KEY));if(data?.version===3)return data;if(data&&(data.version===1||data.version===2))return migrate(data);}catch{}return freshGame();}
const game=load();
// Developer switch for balancing (?calibrate): levels never end early, so a test player can measure a full shift.
const CALIBRATE=new URLSearchParams(location.search).has('calibrate');
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));}catch{}}
save();
let sound=localStorage.getItem('souha-sound')!=='off';

// ---------------------------------------------------------------------------------------------------------------
// Sound: CC0 samples (see sounds/CREDITS.txt) through one shared Web Audio context, unlocked by the first tap.
// ---------------------------------------------------------------------------------------------------------------
const SOUND_NAMES=['board','bus-full','select','depart','coins','buy','station-open','switch','error','menu-open','arrival','vip','gift','heart','rush','diamond','combo','tick','lost','note','pop-a','pop-b','pop-c','ping','coin-jingle','purchase'];
const soundFiles=Object.fromEntries(SOUND_NAMES.map(name=>[name,fetch(`./sounds/${name}.mp3?v=${BUILD}`).then(r=>r.arrayBuffer()).catch(()=>null)]));
let audioCtx=null;const soundBuffers={};
function unlockAudio(){if(audioCtx){if(audioCtx.state!=='running')audioCtx.resume().catch(()=>{});return;}const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}audioCtx=new AudioCtx();audioCtx.resume().catch(()=>{});for(const name of SOUND_NAMES)soundFiles[name].then(data=>data&&audioCtx.decodeAudioData(data)).then(buffer=>{if(buffer)soundBuffers[name]=buffer;}).catch(()=>{});}
for(const type of ['pointerdown','touchend','click','keydown'])addEventListener(type,unlockAudio,{capture:true});
function play(name,volume=1,rate=1,delay=0){if(!sound||!audioCtx||!soundBuffers[name])return;if(audioCtx.state!=='running')audioCtx.resume().catch(()=>{});const source=audioCtx.createBufferSource(),gain=audioCtx.createGain();source.buffer=soundBuffers[name];source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain).connect(audioCtx.destination);source.start(audioCtx.currentTime+delay);}
// Money in: a quick cascade of rising coin pings (a major arpeggio, longer for big sums) over a coin jingle.
function playCash(amount,jingle=.9){const notes=amount>=1000?[0,4,7,12,16,19,24]:amount>=200?[0,4,7,12,16]:[0,4,7];notes.forEach((step,i)=>play('ping',.5,.7*2**(step/12),i*.055));if(jingle)play('coin-jingle',jingle);}
const PENTATONIC=[0,2,4,7,9,12,14,16,19];
// Boarding: one of three CC0 pops (picked at random so fast taps never sound identical) rising gently with the combo,
// over a quiet steel-drum note that climbs a pentatonic scale.
const POPS=['pop-a','pop-b','pop-c'];
function playComboNote(count){const step=PENTATONIC[(count-1)%PENTATONIC.length];play(POPS[Math.floor(Math.random()*POPS.length)],1,.95*2**(step/24));play('note',.35,1.2*2**(step/12));}
// Phones only allow vibration after the first tap.
function vibrate(pattern){if(sound&&navigator.userActivation?.hasBeenActive!==false)try{navigator.vibrate?.(pattern);}catch{}}
function toast(message,kind=''){if(kind==='error')play('error',.6);const node=document.createElement('div');node.className='toast'+(kind?' '+kind:'');node.innerHTML=message;$('toast-stack').replaceChildren(node);setTimeout(()=>node.remove(),2600);}

// ---------------------------------------------------------------------------------------------------------------
// The level being played (or previewed on the home screen).
// mode: 'home' · 'intro' (goal card, then 3-2-1) · 'play' · 'paused' · 'over' (win or lose card)
// ---------------------------------------------------------------------------------------------------------------
let mode='home',run=null,currentStation='tunis',selectedBus=null,nextBusId=1;
function newBus(location){return {id:nextBusId++,location,status:'idle',dest:null,passengers:0,revenue:0,payout:0,claimBy:0,readyAt:Date.now()};}
// The level's buses start spread over its stations, the first station getting the extra ones.
function prepareRun(n){
  const cfg=levelConfig(n),buses=[];for(let i=0;i<cfg.buses;i++)buses.push(newBus(cfg.stations[i%cfg.stations.length]));
  run={n,cfg,buses,hearts:MAX_HEARTS,earned:0,endsAt:0,remaining:cfg.duration,bestCombo:0,result:null};
  for(const bus of buses)assignDest(bus);currentStation=cfg.stations[0];selectedBus=null;crowd=[];shownEarned=0;coinsInFlight=0;resetCombo();}
const stationsInRun=()=>run.cfg.stations;
// Every parked bus waiting for travelers has a random destination among the level's other stations.
function assignDest(bus){const options=stationsInRun().filter(id=>id!==bus.location);bus.dest=options[Math.floor(Math.random()*options.length)]||null;}
const timeLeft=()=>mode==='play'?Math.max(0,run.endsAt-Date.now()):run.remaining;

// ---------------------------------------------------------------------------------------------------------------
// Buses: tap one to choose it, fill it with travelers for its country, tap it again when full to send it.
// It parks at its destination holding the fares; tap it there in time or the money (and a heart) is lost.
// ---------------------------------------------------------------------------------------------------------------
const busesHere=()=>run.buses.filter(b=>b.status==='idle'&&b.location===currentStation);
// Up to three buses park in the bays: buses holding fares first (so you can always claim), then partly filled ones.
function bayBuses(){
  const buses=busesHere().sort((a,b)=>(b.payout>0)-(a.payout>0)||(b.passengers>0)-(a.passengers>0)||(a.readyAt||0)-(b.readyAt||0)||a.id-b.id).slice(0,BAYS.length),occupied=new Set();
  for(const bus of buses){if(!Number.isInteger(bus.bay)||bus.bay<0||bus.bay>=BAYS.length||occupied.has(bus.bay))bus.bay=null;else occupied.add(bus.bay);}
  for(const bus of buses)if(bus.bay===null){bus.bay=BAYS.findIndex((_,i)=>!occupied.has(i));occupied.add(bus.bay);}
  return buses.sort((a,b)=>a.bay-b.bay);}
const entering=bus=>entryEffects.some(e=>e.id===bus.id);
// A bus that is still backing into its bay already takes travelers, so fast taps are never lost.
const canBoard=bus=>bus&&bus.status==='idle'&&bus.location===currentStation&&!bus.payout&&bus.passengers<CAPACITY&&bus.dest;
function getSelectedBus(){return bayBuses().find(b=>b.id===selectedBus);}
// Keep a sensible bus selected: the current one while it is in a bay, otherwise the fullest bus that can still board.
function syncSelectedBus(){const bays=bayBuses();if(bays.some(b=>b.id===selectedBus&&!b.payout))return;selectedBus=bays.filter(b=>!b.payout&&b.dest).sort((a,b)=>(b.passengers<CAPACITY)-(a.passengers<CAPACITY)||b.passengers-a.passengers)[0]?.id??null;}
function tapBus(id){
  if(mode!=='play')return;const bus=bayBuses().find(b=>b.id===id);if(!bus)return;
  if(bus.payout>0)return claim(bus);
  if(entering(bus))return;
  if(bus.passengers>=CAPACITY)return depart(bus);
  if(selectedBus!==id){selectedBus=id;play('select');vibrate(8);renderBuses();renderCrowd();renderHud();}}
function depart(bus){
  const tagRect=document.querySelector(`[data-bus="${bus.id}"]`)?.getBoundingClientRect(),vacated=bus.bay;launchVisualDeparture(bus.id);
  Object.assign(bus,{status:'trip',origin:bus.location,departed:Date.now(),arrival:Date.now()+tripTime(bus.location,bus.dest),bay:null});
  const replacement=bayBuses().find(b=>b.bay===vacated);if(replacement)pendingMoves[replacement.id]=true;
  selectedBus=null;syncSelectedBus();renderBuses();renderCrowd();renderHud();play('depart',.9);vibrate(20);
  if(tagRect)floatText(tagRect.left+tagRect.width/2,tagRect.top,`${icon('bus')} ${euro(bus.revenue)} → ${city[bus.dest].name}`,'depart');}
function arrive(bus,now){
  Object.assign(bus,{status:'idle',location:bus.dest,dest:null,payout:bus.revenue,revenue:0,passengers:0,claimBy:now+run.cfg.claim,readyAt:now,bay:null});
  if(bus.location===currentStation){pendingMoves[bus.id]=true;play('arrival',.9);}
  else{toast(`${icon('bag')} ${euro(bus.payout)} waiting in <b>${city[bus.location].name}</b> · ${Math.round(run.cfg.claim/1000)}s!`,'claim');play('ping',.6,1.6);play('ping',.6,2,.09);vibrate([25,40,25]);}}
// Claimed money counts toward the level goal and is yours to keep.
function claim(bus){
  const amount=bus.payout;bus.payout=0;bus.claimBy=0;run.earned+=amount;game.coins+=amount;coinsInFlight+=amount;assignDest(bus);save();
  const tag=document.querySelector(`[data-bus="${bus.id}"]`)?.getBoundingClientRect();if(tag)floatText(tag.left+tag.width/2,tag.top,`${icon('bag')} +${euro(amount)}`,'cash');
  playCash(amount);burstAt(tag,'#ffc800',16,true);if(tag)flyCoins(tag.left+tag.width/2,tag.top+tag.height/2,amount);else coinsInFlight-=amount;vibrate([20,30,20]);
  renderBuses();renderCrowd();renderHud();if(run.earned>=run.cfg.target&&!CALIBRATE)finishRun(true);}
function loseClaim(bus){
  const lost=bus.payout;bus.payout=0;bus.claimBy=0;assignDest(bus);
  loseHeart(`${icon('timer')} ${euro(lost)} lost in ${city[bus.location].name}`);}

// ---------------------------------------------------------------------------------------------------------------
// Travelers: they pop up all over the visible walkway, each heading to a country, and leave after a few seconds.
// Only travelers for the selected bus's country can be tapped; the others are faded.
// ---------------------------------------------------------------------------------------------------------------
let crowd=[],nextTravelerId=1,lastSpawn=0;
function rollSpecial(){let roll=Math.random();for(const [kind,special] of Object.entries(SPECIALS)){if(roll<special.chance)return kind;roll-=special.chance;}return null;}
// Destinations favour the selected bus (so there is always someone to tap), then the other buses here, then any other country.
function travelerDest(){
  const others=stationsInRun().filter(id=>id!==currentStation),selected=getSelectedBus(),bays=bayBuses().filter(b=>b.dest&&!b.payout).map(b=>b.dest),roll=Math.random();
  if(selected?.dest&&roll<.55)return selected.dest;if(bays.length&&roll<.8)return bays[Math.floor(Math.random()*bays.length)];return others[Math.floor(Math.random()*others.length)];}
// A flag needs about a tag-sized box of walkway (TAG_BOX) so tags never cover each other.
const TAG_BOX=[.64,.72];
function freeSpot(){
  const pool=onScreenSpots&&onScreenSpots.size>=8?[...onScreenSpots]:CROWD_SPOTS.map((_,i)=>i);
  const roomy=pool.filter(i=>crowd.every(p=>{const [x1,z1]=CROWD_SPOTS[i],[x2,z2]=CROWD_SPOTS[p.spot];return Math.abs(x1-x2)>=TAG_BOX[0]||Math.abs(z1-z2)>=TAG_BOX[1];}));
  return roomy.length?roomy[Math.floor(Math.random()*roomy.length)]:null;}
// Groups: a traveler tag can carry 2 or more people (more often, and bigger, in later levels). A group fills that
// many seats in one tap; a group that does not fit the selected bus costs its fares and a heart and breaks the combo.
// Filling the bus exactly with a group is a PERFECT FIT worth 5 extra fares.
const PERFECT_FIT_FARES=5;
function rollGroup(){if(Math.random()>=run.cfg.groupChance)return 1;return 2+Math.floor(Math.random()**1.6*(run.cfg.maxGroup-1));}
function spawnTraveler(now,dest=travelerDest()){
  const spot=freeSpot();if(spot===null||!dest)return false;const special=rollSpecial(),[lo,hi]=run.cfg.life;
  crowd.push({id:nextTravelerId++,dest,spot,special,size:special?1:rollGroup(),born:now,until:now+(special?run.cfg.bonusLife:lo+Math.random()*(hi-lo))});return true;}
function groupDoesNotFit(traveler,bus){
  const loss=fareFor(currentStation,bus.dest)*traveler.size;bus.revenue=Math.max(0,bus.revenue-loss);
  const tag=document.querySelector(`[data-traveler="${traveler.id}"]`)?.getBoundingClientRect();
  resetCombo();crowd=crowd.filter(p=>p.id!==traveler.id);launchVanish(traveler.id);burstAt(tag,'#ff4b4b',12,true);
  if(tag)floatText(tag.left+tag.width/2,tag.top,`−${euro(loss)} · ${traveler.size} won't fit!`,'loss');
  const busTag=document.querySelector(`[data-bus="${bus.id}"]`);busTag?.classList.remove('nope');void busTag?.offsetWidth;busTag?.classList.add('nope');
  renderBuses();renderCrowd();loseHeart(`${traveler.size} travelers didn't fit!`);}
function tapTraveler(id){
  if(mode!=='play')return;const traveler=crowd.find(p=>p.id===id),bus=getSelectedBus(),now=Date.now();if(!traveler)return;
  if(!canBoard(bus)||traveler.dest!==bus.dest){const tag=document.querySelector(`[data-traveler="${id}"]`);tag?.classList.remove('nope');void tag?.offsetWidth;tag?.classList.add('nope');return;}
  const size=traveler.size||1;if(size>CAPACITY-bus.passengers)return groupDoesNotFit(traveler,bus);
  // Combo: fares go on the bus; the combo multiplier (+0.25 every COMBO_STEP boardings, ×2 per VIP, up to ×4) is added to those buses when it ends.
  if(combo.count&&now-combo.last>run.cfg.combo&&now>combo.frozenUntil)endCombo();
  combo.count++;combo.last=now;const special=traveler.special,fare=fareFor(currentStation,bus.dest);
  if(special==='vip')combo.vip*=2;else if(special==='rush')combo.frozenUntil=now+5000;
  const fares=fare*size,perfect=size>1&&bus.passengers+size===CAPACITY,bonus=(SPECIALS[special]?.bonus||0)+(perfect?fare*PERFECT_FIT_FARES:0),share=combo.byBus[bus.id]??={fares:0,bonus:0};share.fares+=fares;share.bonus+=bonus;
  combo.fares+=fares;combo.bonus+=bonus;bus.revenue+=fares+bonus;bus.passengers+=size;
  crowd=crowd.filter(p=>p.id!==id);
  const tag=document.querySelector(`[data-traveler="${id}"]`)?.getBoundingClientRect();
  if(special==='heart'){if(run.hearts<MAX_HEARTS){run.hearts++;bump($('hearts'));}else{bus.revenue+=40;}}
  burstAt(tag,special?SPECIAL_CSS[special]:'#58cc02',special?14:5,!!special);
  const level=Math.min(4,Math.floor(combo.count/COMBO_STEP));
  if(tag)floatText(tag.left+tag.width/2,tag.top,special?`${icon(SPECIALS[special].icon)} ${SPECIALS[special].label}${SPECIALS[special].bonus?' +'+euro(SPECIALS[special].bonus):''}`:`+${euro(fares)}${size>1?` · ${size} seats`:''}${comboMultiplier()>1?`<em>×${comboMultiplier()}</em>`:''}`,special||`lvl${level}`);
  const shout=perfect?'PERFECT FIT!':SHOUTS[combo.count];if(shout)showShout(shout);
  launchBoardingAnimation(id,bus.id);
  playComboNote(combo.count);for(let i=1;i<size;i++)play(POPS[i%POPS.length],.8,1.05+i*.14,i*.05);if(perfect){play('gift',.8);play('combo',.7,1.1);}if(special)play(special,.9);if(combo.count%10===0)play('combo',.7);
  if(bus.passengers>=CAPACITY){play('bus-full',.8);vibrate(35);}else vibrate(special?[15,40,15]:10);
  renderBuses();renderCrowd();renderHud();renderCombo();}

// ---------------------------------------------------------------------------------------------------------------
// Combo: money earned while the combo lasts is multiplied when it ends; the extra goes onto the buses that earned it.
// ---------------------------------------------------------------------------------------------------------------
const combo={count:0,last:0,fares:0,bonus:0,vip:1,frozenUntil:0,byBus:{}};
const SHOUTS={10:'NICE!',20:'GREAT!',30:'AMAZING!',45:'INCREDIBLE!',60:'UNSTOPPABLE!',80:'LEGENDARY!'};
// Every COMBO_STEP boardings add +0.25 and each VIP doubles it, up to COMBO_CAP.
const COMBO_CAP=4,comboMultiplier=()=>Math.min(COMBO_CAP,(1+.25*Math.floor(combo.count/COMBO_STEP))*combo.vip);
const comboWorth=()=>Math.round((combo.fares+combo.bonus)*comboMultiplier());
function resetCombo(){Object.assign(combo,{count:0,last:0,fares:0,bonus:0,vip:1,frozenUntil:0,byBus:{}});}
function endCombo(){
  if(!combo.count)return;const count=combo.count,mult=comboMultiplier(),shares=combo.byBus;resetCombo();
  if(run&&count>run.bestCombo)run.bestCombo=count;if(count>game.bestCombo){game.bestCombo=count;save();}
  let payout=0;const targets=[];
  for(const [id,share] of Object.entries(shares)){const extra=Math.round(share.fares*(mult-1)+share.bonus*mult),bus=run?.buses.find(b=>b.id===Number(id));if(!bus||extra<=0)continue;
    if(bus.payout>0)bus.payout+=extra;else bus.revenue+=extra;payout+=extra;targets.push(bus.id);}
  if(payout>0){renderBuses();const from=rectCentre(showComboBanner(count,mult,payout));for(const id of targets)coinsToBus(from,id);play('combo',.8);playCash(payout,0);vibrate([20,40,20]);}
  renderCombo();}

// ---------------------------------------------------------------------------------------------------------------
// Hearts, time and the goal
// ---------------------------------------------------------------------------------------------------------------
function loseHeart(reason){
  if(mode!=='play')return;run.hearts=Math.max(0,run.hearts-1);
  play('error',.9);play('lost',.8);vibrate([70,40,70]);toast(`${icon('heart')} ${reason}`,'error-soft');
  const hearts=$('hearts');hearts.classList.remove('hurt');void hearts.offsetWidth;hearts.classList.add('hurt');renderHud();
  if(!run.hearts)finishRun(false,'hearts');}
// Winning unlocks the next level and records the stars; money only ever comes from claiming buses (kept win or lose).
function finishRun(won,reason='time'){
  if(mode!=='play')return;endCombo();run.remaining=timeLeft();mode='over';crowd=[];renderCrowd();
  const stars=won?Math.max(1,run.hearts):0;
  if(won){game.stars[run.n]=Math.max(game.stars[run.n]||0,stars);if(game.level===run.n)game.level++;}
  save();run.result={won,reason,stars};
  if(won){play('gift',.9);playCash(2000,.8);play('arrival',.8,1.1);vibrate([40,60,40,60,120]);}else{play('lost',.9);play('error',.6,.8);vibrate([200]);}
  setTimeout(()=>showOverlay('result'),won?700:500);}

// ---------------------------------------------------------------------------------------------------------------
// Stations: swipe left/right or tap a station tab to move between the level's stations.
// ---------------------------------------------------------------------------------------------------------------
function neighbour(step){const list=stationsInRun(),i=list.indexOf(currentStation);return list[(i+step+list.length)%list.length];}
function switchStation(id,direction=0){
  if(mode!=='play'||!stationsInRun().includes(id)||id===currentStation)return;endCombo();clearBoardingAnimations();
  const list=stationsInRun();direction||=list.indexOf(id)>list.indexOf(currentStation)?1:-1;currentStation=id;selectedBus=null;crowd=[];
  syncSelectedBus();buildStatic();for(let i=0;i<6;i++)spawnTraveler(Date.now());renderBuses();renderCrowd();renderHud();
  const view=$('game');view.classList.remove('slide-from-left','slide-from-right');void view.offsetWidth;view.classList.add(direction>0?'slide-from-right':'slide-from-left');
  play('depart',.35,1.7);play('switch',.5);}

// ---------------------------------------------------------------------------------------------------------------
// Clock: arrivals, claim deadlines, the level timer, travelers coming and going.
// ---------------------------------------------------------------------------------------------------------------
let lastTickSecond=0,lastHudSecond=0;
function tick(){
  if(mode!=='play')return;const now=Date.now();let busesChanged=false,crowdChanged=false;
  for(const bus of run.buses){
    if(bus.status==='trip'&&now>=bus.arrival){arrive(bus,now);busesChanged=true;}
    else if(bus.status==='idle'&&bus.payout>0&&now>bus.claimBy){loseClaim(bus);busesChanged=true;if(mode!=='play')return;}}
  const left=timeLeft(),second=Math.ceil(left/1000);
  if(second!==lastTickSecond){lastTickSecond=second;
    // Ticks in the last 3 seconds of a claim here, and every second of the level's last 10 seconds.
    if(second<=10&&second>0)play('tick',second<=5?.9:.5,second<=5?1.3:1);else if(run.buses.some(b=>b.payout>0&&b.claimBy-now<3200&&b.claimBy>now))play('tick',.7);}
  if(left<=0){finishRun(run.earned>=run.cfg.target);return;}
  const before=crowd.length;for(const p of crowd)if(now>=p.until)launchVanish(p.id);crowd=crowd.filter(p=>now<p.until);if(crowd.length!==before)crowdChanged=true;
  if(now-lastSpawn>=run.cfg.spawn){lastSpawn=now;for(let i=Math.random()<.35?2:1;i>0;i--)if(spawnTraveler(now))crowdChanged=true;}
  if(busesChanged){syncSelectedBus();renderBuses();}
  if(busesChanged||crowdChanged)renderCrowd();
  if(busesChanged||second!==lastHudSecond)renderHud();}

// ---------------------------------------------------------------------------------------------------------------
// Flow: home → intro (goal, 3-2-1) → play → result; pause at any time.
// ---------------------------------------------------------------------------------------------------------------
function setMode(next){mode=next;$('game').dataset.mode=next;}
function goHome(){if(run)endCombo();prepareRun(game.level);setMode('home');clearBoardingAnimations();buildStatic();renderBuses();renderCrowd();renderHud();showOverlay('home');}
function openLevel(n){prepareRun(n);setMode('intro');clearBoardingAnimations();buildStatic();renderBuses();renderCrowd();renderHud();showOverlay('intro');play('menu-open',.7);}
function startCountdown(){
  hideOverlay();let count=3;const el=document.createElement('div');el.className='countdown';floatLayer.appendChild(el);
  const step=()=>{el.textContent=count||'GO!';el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');
    if(count){play('tick',1,1.2);count--;setTimeout(step,650);}else{play('station-open');play('depart',.5,1.4);setTimeout(()=>el.remove(),600);beginPlay();}};
  step();}
function beginPlay(){setMode('play');run.endsAt=Date.now()+run.remaining;lastSpawn=0;for(let i=0;i<8;i++)spawnTraveler(Date.now());syncSelectedBus();renderBuses();renderCrowd();renderHud();}
// Pausing freezes the level: on resume every deadline moves forward by the paused time; waiting travelers leave.
function pause(){if(mode!=='play')return;run.pausedAt=Date.now();run.remaining=timeLeft();endCombo();setMode('paused');crowd=[];renderCrowd();showOverlay('pause');play('menu-open',.6);}
function resume(){
  if(mode!=='paused')return;const delta=Date.now()-run.pausedAt;
  for(const bus of run.buses){if(bus.status==='trip')bus.arrival+=delta;if(bus.payout>0)bus.claimBy+=delta;}
  hideOverlay();setMode('play');run.endsAt=Date.now()+run.remaining;renderBuses();renderHud();play('select');}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});

// ---------------------------------------------------------------------------------------------------------------
// HUD, overlays and floating feedback
// ---------------------------------------------------------------------------------------------------------------
const floatLayer=document.createElement('div');floatLayer.className='float-layer';$('game').appendChild(floatLayer);
function floatText(x,y,html,kind){const el=document.createElement('div');el.className='float-gain'+(kind?' special-'+kind:'');el.innerHTML=html;el.style.top=y+'px';floatLayer.appendChild(el);
  // Keep the whole label on screen, however long it is.
  const half=el.offsetWidth/2+8;el.style.left=Math.min(Math.max(x,half),innerWidth-half)+'px';setTimeout(()=>el.remove(),1000);}
function showShout(text){const el=document.createElement('div');el.className='shout';el.textContent=text;floatLayer.appendChild(el);setTimeout(()=>el.remove(),900);play('combo',.6,1.25);}
// The message rail under the top bar shows one message at a time (newest wins), so it never reaches the buses.
function showNotice(kind,html,ms=2200){const el=document.createElement('div');el.className='notice notice-'+kind;el.innerHTML=html;$('toast-stack').replaceChildren(el);setTimeout(()=>el.remove(),ms);return el.getBoundingClientRect();}
const rectCentre=r=>[r.left+r.width/2,r.top+r.height/2];
function showComboBanner(count,mult,payout){return showNotice('combo',`<span class="notice-art">${icon('crown')}</span><span>COMBO ${count}</span><b>+${euro(payout)}</b><span class="chip orange">×${mult}</span><span class="chip blue">${icon('bus')} on the bus</span>`,1800);}
// Coins fly onto a bus label (only a visual: the money is already on that bus).
function coinsToBus([x,y],busId){const tag=document.querySelector(`[data-bus="${busId}"]`);if(tag)flyTo(x,y,tag,'coin-flyer',icon('coin'),4,()=>{});}
// Particle burst at a screen rectangle: small CSS-animated dots that fly out and fade (no canvas or 3D work).
function burstAt(rect,color,count=10,big=false){if(!rect)return;const host=document.createElement('div');host.className='burst'+(big?' big':'');host.style.left=rect.left+rect.width/2+'px';host.style.top=rect.top+rect.height/2+'px';host.style.setProperty('--c',color);
  host.innerHTML='<i class="burst-ring"></i>'+Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2+Math.random()*.4,d=(big?46:30)+Math.random()*(big?34:20);return `<i style="--dx:${(Math.cos(a)*d).toFixed(1)}px;--dy:${(Math.sin(a)*d).toFixed(1)}px;--s:${(.6+Math.random()*.8).toFixed(2)}"></i>`;}).join('');
  floatLayer.appendChild(host);setTimeout(()=>host.remove(),650);}
function bump(el){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}
// The multiplier card (top right) also shows the live combo: its count and worth, and a bar for the time left.
let shownCombo=-1,shownMult='';
const multLevel=m=>m>=4?4:m>=3?3:m>=2?2:m>1?1:0;
function renderCombo(now=Date.now()){
  const badge=$('mult-badge'),mult=combo.count?comboMultiplier():1,label=`×${mult}`,active=combo.count>=2;
  if(label!==shownMult){shownMult=label;$('mult-value').textContent=label;badge.dataset.level=multLevel(mult);if(mult>1)bump(badge);}
  badge.classList.toggle('in-combo',active);
  if(!active){if(shownCombo!==-1){shownCombo=-1;$('mult-label').textContent='COMBO';}return;}
  if(shownCombo!==combo.count){shownCombo=combo.count;$('mult-label').textContent=`COMBO ${combo.count} · ${shortEuro(comboWorth())}`;}
  const frozen=now<combo.frozenUntil,timer=$('mult-timer');timer.classList.toggle('frozen',frozen);timer.style.transform=`scaleX(${frozen?1:Math.max(0,1-(now-combo.last)/run.cfg.combo).toFixed(3)})`;}
// Coins and the goal "add up": coins fly to the counter first and the numbers roll up as they land.
let coinsInFlight=0;
function flyTo(x,y,target,className,html,count,onArrive,onEach){
  const to=target.getBoundingClientRect(),tx=to.left+to.width/2,ty=to.top+to.height/2;let landed=0;
  for(let i=0;i<count;i++){const el=document.createElement('div');el.className='flyer '+className;el.innerHTML=html;floatLayer.appendChild(el);
    const jx=(Math.random()-.5)*70,jy=(Math.random()-.5)*50-20,duration=520+i*55+Math.random()*80;let done=false;
    const land=()=>{if(done)return;done=true;el.remove();landed++;if(className==='coin-flyer'){const pill=target.closest('.coin-pill,.goal-card');if(pill)bump(pill);play('ping',.12,2.2+Math.random()*.4);}onEach?.();if(landed===count)onArrive();};
    el.animate([{transform:`translate(${x}px,${y}px) scale(.4)`,opacity:0},{transform:`translate(${x+jx}px,${y+jy}px) scale(1.15)`,opacity:1,offset:.3},{transform:`translate(${tx}px,${ty}px) scale(.6)`,opacity:.9}],{duration,easing:'cubic-bezier(.45,0,.7,1)',delay:i*35,fill:'backwards'}).onfinish=land;
    setTimeout(land,duration+i*35+400);}}
// During a level coins fly into the goal card; on the home and result screens into the coin counter.
function coinTarget(){return mode==='play'||mode==='paused'?$('goal-fill'):($('home-coins')||$('result-coins')||$('goal-fill'));}
function flyCoins(x,y,amount){const count=Math.max(3,Math.min(10,Math.round(2+Math.log10(Math.max(1,amount))*2))),share=Math.floor(amount/count);let released=0;
  flyTo(x,y,coinTarget(),'coin-flyer',icon('coin'),count,()=>{coinsInFlight-=amount-released;},()=>{released+=share;coinsInFlight-=share;});}
function pendingClaims(id){return run.buses.filter(b=>b.status==='idle'&&b.location===id&&b.payout>0);}
const secondsLeft=claims=>Math.max(0,Math.ceil(Math.min(...claims.map(b=>b.claimBy-Date.now()))/1000));
const clock=ms=>{const s=Math.ceil(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
function renderHud(){
  if(!run)return;const now=Date.now();lastHudSecond=Math.floor(now/1000);
  $('hearts').innerHTML=Array.from({length:MAX_HEARTS},(_,i)=>icon('heart',i<run.hearts?'heart full':'heart empty')).join('');
  const left=timeLeft();$('timer-text').textContent=clock(left);$('timer').classList.toggle('low',left<=10000&&mode==='play');
  $('goal-level').textContent=`LEVEL ${run.n}`;renderGoal();
  $('mult-boost').textContent=`goal ${shortEuro(run.cfg.target)}`;
  // Money waiting: a gold pill per bus holding fares at another station (flag, amount, seconds, draining bar);
  // tap one to jump there. The bar keeps its height when empty so the station view never shifts.
  const waiting=run.buses.filter(b=>b.status==='idle'&&b.payout>0&&b.location!==currentStation).sort((a,b)=>a.claimBy-b.claimBy);
  $('claims-bar').innerHTML=waiting.length?waiting.map(b=>{const left=Math.max(0,b.claimBy-now),total=run.cfg.claim;
    return `<button class="claim-pill${left<4000?' hurry':''}" data-station="${b.location}" aria-label="${euro(b.payout)} waiting in ${city[b.location].name}, ${Math.ceil(left/1000)} seconds">${flagMarkup(b.location,'claim-flag')}${icon('bag')}<b>${euro(b.payout)}</b><span>${Math.ceil(left/1000)}s</span><i style="animation-duration:${total}ms;animation-delay:-${total-left}ms"></i></button>`;}).join('')
    :`<span class="claims-empty">${icon('bag')} Buses that arrive elsewhere show up here</span>`;
  // Station tabs: one per station of the level, with its parked buses and any fares waiting to be claimed there.
  $('station-tabs').innerHTML=stationsInRun().map(id=>{const claims=pendingClaims(id),parked=run.buses.filter(b=>b.status==='idle'&&b.location===id).length;
    return `<button class="station-tab${id===currentStation?' here':''}${claims.length&&id!==currentStation?' alert':''}" data-station="${id}" aria-label="${city[id].name}: ${parked} buses${claims.length?`, ${claims.length} to claim`:''}">${flagMarkup(id,'tab-flag')}<b>${city[id].name}</b><small>${claims.length?`${icon('bag')} ${secondsLeft(claims)}s`:`${icon('bus')} ${parked}`}</small></button>`;}).join('');}
// Goal bar: money claimed this level against the target (rolls up as coins land).
let shownEarned=0;
function renderGoal(){const target=run.cfg.target,value=Math.min(target,shownEarned);$('goal-fill').style.width=`${Math.min(100,value/target*100).toFixed(1)}%`;$('goal-text').textContent=`${euro(value)} / ${euro(target)}`;$('goal-card').classList.toggle('done',run.earned>=target);}

// Overlays: one card at a time over the live 3D station.
function hideOverlay(){$('overlay').classList.add('hidden');}
function levelChips(cfg){return `<div class="level-chips"><span class="chip gold">${icon('coin')} Earn ${euro(cfg.target)}</span><span class="chip blue">${icon('timer')} ${cfg.duration/1000}s</span><span class="chip orange">${icon('bus')} ${cfg.buses} buses</span><span class="chip green">${cfg.stations.map(id=>flagMarkup(id,'chip-flag')).join('')}</span></div>`;}
const starsMarkup=(count,className='')=>`<span class="stars ${className}">${[0,1,2].map(i=>icon('star',i<count?'star on':'star off')).join('')}</span>`;
function showOverlay(kind){
  const card=$('overlay-card'),cfg=run.cfg;$('overlay').classList.remove('hidden');$('overlay').dataset.kind=kind;
  if(kind==='home'){
    const first=Math.max(1,game.level-3),path=Array.from({length:6},(_,i)=>first+i);
    card.innerHTML=`<div class="home-brand"><span class="logo big">${icon('bus')}<span class="logo-text"><b>SouSou</b><small>BUS</small></span></span><div class="coin-pill" id="home-coins">${icon('coin','coin-ico')}<strong>${Math.round(shownCoins).toLocaleString('en-US')}</strong></div></div>
      <div class="level-path">${path.map(n=>`<button class="path-node${n===game.level?' current':''}${n>game.level?' locked':''}" data-level="${n}" ${n>game.level?'disabled':''}><b>${n>game.level?icon('lock'):n}</b>${n<game.level?starsMarkup(game.stars[n]||0,'tiny'):''}</button>`).join('')}</div>
      <div class="level-card"><small>NEXT SHIFT</small><h1>Level ${game.level}</h1>${levelChips(levelConfig(game.level))}<p>${levelHint(game.level)}</p></div>
      <button class="btn green big" id="play-btn">${icon('play')} PLAY</button>
      <h3 class="shop-title">Boosters <small>bought with the money you earn</small></h3>
      <div class="shop">${Object.entries(UPGRADES).map(([key,u])=>{const level=game.upgrades[key],max=level>=UPGRADE_MAX,cost=upgradeCost(level);
        return `<div class="shop-item"><span class="shop-art">${icon(u.icon)}</span><span class="shop-text"><b>${u.name} <em>${level}/${UPGRADE_MAX}</em></b><small>${level?u.effect(level):u.next}</small></span><button class="btn ${max?'locked':game.coins>=cost?'green':'locked'}" data-upgrade="${key}" ${max||game.coins<cost?'disabled':''}>${max?'MAX':shortEuro(cost)}</button></div>`;}).join('')}</div>
      <p class="home-best">${icon('crown')} Best combo ${game.bestCombo||0}</p>`;}
  else if(kind==='intro'){
    card.innerHTML=`<small class="eyebrow">SHIFT ${run.n}</small><h1>Level ${run.n}</h1>${levelChips(cfg)}
      ${run.n<=2?`<ol class="how"><li>${icon('bus')}<span><b>Tap a bus</b> to pick its country</span></li><li>${icon('swipe')}<span><b>Tap its travelers</b> fast. Numbers are groups: they must fit!</span></li><li>${icon('play')}<span><b>Tap GO</b> when full, then <b>swipe</b> to where it arrives</span></li><li>${icon('bag')}<span><b>Tap the gold bus</b> in time to cash in</span></li></ol>`:`<p class="intro-hint">${levelHint(run.n)}</p>`}
      <p class="intro-hearts">${icon('heart','heart full')}${icon('heart','heart full')}${icon('heart','heart full')} <span>A heart is lost when a group doesn't fit or a claim is missed.</span></p>
      <div class="overlay-actions"><button class="btn green big" id="start-btn">${icon('play')} START</button><button class="btn ghost" id="home-btn">${icon('home')}</button></div>`;}
  else if(kind==='pause'){
    card.innerHTML=`<small class="eyebrow">LEVEL ${run.n}</small><h1>Paused</h1><p class="pause-goal">${euro(run.earned)} of ${euro(cfg.target)} · ${clock(run.remaining)} left</p>
      <div class="overlay-actions column"><button class="btn green big" id="resume-btn">${icon('play')} RESUME</button><button class="btn orange" id="restart-btn">${icon('retry')} RESTART</button><button class="btn ghost" id="home-btn">${icon('home')} HOME</button></div>`;}
  else{const r=run.result,pct=Math.min(100,Math.round(run.earned/cfg.target*100));
    card.innerHTML=r.won?`<small class="eyebrow">LEVEL ${run.n}</small><h1 class="win">Shift complete!</h1>${starsMarkup(r.stars,'big reveal')}
        <div class="result-stats"><div><strong>${euro(run.earned)}</strong><span>claimed</span></div><div><strong>${run.bestCombo}</strong><span>best combo</span></div><div><strong>${clock(run.remaining)}</strong><span>to spare</span></div></div>
        <div class="result-bonus chip gold">${icon('coin')} ${euro(run.earned)} added to your coins</div>
        <div class="overlay-actions"><button class="btn green big" id="next-btn">NEXT LEVEL ${icon('right')}</button><button class="btn ghost" id="home-btn">${icon('home')}</button></div>`
      :`<small class="eyebrow">LEVEL ${run.n}</small><h1 class="lose">${r.reason==='hearts'?'Out of hearts!':'Time’s up!'}</h1>
        <div class="goal-track big"><i style="width:${pct}%"></i></div><p class="pause-goal">${euro(run.earned)} of ${euro(cfg.target)} · ${pct}%</p>
        <p class="intro-hint">${r.reason==='hearts'?'Watch the red numbers: a group that does not fit costs a heart. Claim gold buses before their timer runs out.':'Keep buses moving: fill one while others travel, and swipe to claim the moment they arrive.'}</p>
        <p class="kept">${icon('coin')} You keep the ${euro(run.earned)} you claimed.</p>
        <div class="overlay-actions"><button class="btn orange big" id="retry-btn">${icon('retry')} RETRY</button><button class="btn ghost" id="home-btn">${icon('home')}</button></div>`;
    if(r.won)card.querySelectorAll('.stars.reveal .star').forEach((star,i)=>setTimeout(()=>{star.classList.add('shown');if(star.classList.contains('on')){play('ping',.8,1+i*.25);play('vip',.6,1+i*.15);}},500+i*350));}}
// One line about what makes this level different.
function levelHint(n){const cfg=levelConfig(n),prev=n>1?levelConfig(n-1):null;
  if(!prev)return 'Learn the ropes: two cities, plenty of buses.';
  if(cfg.stations.length>prev.stations.length)return `New country: ${city[cfg.stations.at(-1)].name}! More destinations, longer routes, bigger fares.`;
  if(cfg.buses<prev.buses)return `One bus fewer than last time: keep every bus busy.`;
  return 'Higher goal, faster travelers, bigger groups.';}
function buyUpgrade(key){const level=game.upgrades[key],cost=upgradeCost(level);if(level>=UPGRADE_MAX||game.coins<cost)return;game.coins-=cost;shownCoins=game.coins;game.upgrades[key]++;save();play('purchase',.9);play('buy',.6);if(mode==='home'){prepareRun(game.level);showOverlay('home');}}
// ---------------------------------------------------------------------------------------------------------------
// 3D scene: a small low-poly station; the sky and the flag on the pole change with the station.
// ---------------------------------------------------------------------------------------------------------------
const scene=new THREE.Scene();scene.background=new THREE.Color(0xbbe3e5);scene.fog=new THREE.Fog(0xbbe3e5,16,34);
const canvas=$('scene'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;
const camera=new THREE.OrthographicCamera(-4,4,5,-5,.1,70);camera.position.set(2.8,8.4,10);camera.lookAt(0,.15,.7);
scene.add(new THREE.HemisphereLight(0xffffff,0x93bfa3,2.1));const sunlight=new THREE.DirectionalLight(0xfff0cc,2.2);sunlight.position.set(-4,11,6);sunlight.castShadow=true;sunlight.shadow.mapSize.set(1024,1024);sunlight.shadow.camera.left=-9;sunlight.shadow.camera.right=9;sunlight.shadow.camera.top=9;sunlight.shadow.camera.bottom=-9;sunlight.shadow.normalBias=.025;scene.add(sunlight);
const staticGroup=new THREE.Group(),busGroup=new THREE.Group(),crowdGroup=new THREE.Group(),departureEffects=[],entryEffects=[],smokeEffects=[],boardingEffects=[],vanishEffects=[];const pendingMoves={};scene.add(staticGroup,busGroup,crowdGroup);
const material=(color,more={})=>new THREE.MeshLambertMaterial({color,flatShading:true,...more});
const mats={grass:material(0x9bd49e),grass2:material(0xb7dca5),platform:material(0xf7eacb),tile:material(0xfff4df),road:material(0x80a9a6),stripe:material(0xfff5dc),orange:material(0xf7863e),orangeDark:material(0xdd6d2c),cream:material(0xfffaf0),glass:material(0x6fb7bc),coachGlass:material(0x2b5962,{side:THREE.DoubleSide}),glassShine:material(0x83aeb4,{side:THREE.DoubleSide}),dark:material(0x405b5e),trim:material(0x2f3d40),wheel:material(0x344347),wheelHub:material(0xdfd8c4),trunk:material(0x997c56),leaf:material(0x71b885),leaf2:material(0x84c99a),skin:material(0xf3c29f),hair:material(0x624d3c),pole:material(0xe9e4d6)};
const shirtMats=Object.fromEntries([...STATIONS.map(s=>[s.id,material(s.shirt)]),...Object.entries(SPECIALS).map(([kind,s])=>[kind,material(s.color)])]);
const sharedMats=new Set([...Object.values(mats),...Object.values(shirtMats)]);
function put(group,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function box(group,w,h,d,mat,x,y,z){return put(group,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
function disposeTree(object){object.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.material&&!sharedMats.has(o.material)&&!Array.isArray(o.material))o.material.dispose();});}
function clear(group){for(const child of [...group.children]){group.remove(child);disposeTree(child);}}
function busModel(id){return busGroup.children.find(child=>child.userData.pick?.id===id)||departureEffects.find(effect=>effect.model.userData.pick?.id===id)?.model;}
function clearBoardingAnimations(){for(const effect of [...boardingEffects,...vanishEffects]){scene.remove(effect.model);disposeTree(effect.model);}boardingEffects.length=0;vanishEffects.length=0;}
function detachPerson(id){const model=crowdGroup.children.find(child=>child.userData.travelerId===id);if(!model)return null;crowdGroup.remove(model);scene.add(model);return model;}
function launchBoardingAnimation(travelerId,busId){const model=detachPerson(travelerId),bus=busModel(busId);if(!model||!bus)return;const materials=[];model.traverse(child=>{if(!child.isMesh)return;child.material=child.material.clone();child.material.transparent=true;child.material.depthWrite=false;materials.push(child.material);});boardingEffects.push({model,busId,from:model.position.clone(),to:new THREE.Vector3(),materials,started:performance.now()});}
// A traveler who gives up shrinks away in a blink.
function launchVanish(travelerId){const model=detachPerson(travelerId);if(model)vanishEffects.push({model,started:performance.now()});}
function launchVisualDeparture(id){const model=busGroup.children.find(child=>child.userData.pick?.id===id);if(!model)return;for(const child of [...model.children])if(child.userData.selectionPad){model.remove(child);disposeTree(child);}busGroup.remove(model);scene.add(model);departureEffects.push({model,started:performance.now(),x:model.position.x,lastSmoke:0});}
function emitSmoke(model,now){for(let i=0;i<3;i++){const p=model.localToWorld(new THREE.Vector3((i-1)*.35,.3,-1.68));const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(.17+Math.random()*.07,0),new THREE.MeshBasicMaterial({color:0xe5e9df,transparent:true,opacity:.72,depthWrite:false}));puff.position.copy(p);scene.add(puff);smokeEffects.push({puff,started:now,vx:(Math.random()-.5)*.5});}}
function tree(group,x,z,s=1){put(group,new THREE.CylinderGeometry(.1*s,.15*s,.78*s,6),mats.trunk,x,.4*s,z);put(group,new THREE.IcosahedronGeometry(.58*s,0),Math.random()>.5?mats.leaf:mats.leaf2,x,1.18*s,z);}
function textTexture(text,color='#416358',background='#fff6e5'){const el=document.createElement('canvas');el.width=768;el.height=140;const cx=el.getContext('2d');cx.fillStyle=background;cx.fillRect(0,0,768,140);cx.fillStyle=color;cx.textAlign='center';cx.textBaseline='middle';cx.font='bold 76px Arial';cx.fillText(text,384,75);const texture=new THREE.CanvasTexture(el);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
// Flag textures are drawn from the SVG flags once they load.
const flagTextures={};
function flagTexture(id){if(flagTextures[id])return flagTextures[id];const el=document.createElement('canvas');el.width=192;el.height=128;const texture=new THREE.CanvasTexture(el);texture.colorSpace=THREE.SRGBColorSpace;const img=new Image();img.onload=()=>{el.getContext('2d').drawImage(img,0,0,192,128);texture.needsUpdate=true;};img.src=`./flags/${city[id].code.toLowerCase()}.svg`;return flagTextures[id]=texture;}
let stationFlag=null;
function buildStatic(){
  clear(staticGroup);const sky=new THREE.Color(0xbbe3e5).lerp(new THREE.Color(city[currentStation].accent),.28);scene.background=sky;scene.fog.color=sky;
  const ground=put(staticGroup,new THREE.PlaneGeometry(100,100),mats.grass,0,-.13,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
  // Three broad lanes in an open-air yard, with room for trees behind and in front.
  box(staticGroup,15.4,.25,11.7,mats.platform,0,-.08,.5);
  box(staticGroup,15.1,.025,6.2,mats.road,0,.065,0);
  box(staticGroup,14.9,.035,1.05,mats.grass2,0,.07,-4.45);
  for(const z of [-3.05,3.05])box(staticGroup,14.8,.014,.06,mats.stripe,0,.091,z);
  for(const z of [-1.02,1.02])for(let x=-6.75;x<=6.75;x+=1.5)box(staticGroup,.75,.014,.045,mats.stripe,x,.091,z);
  // Each marked lane is a working boarding bay.
  for(const bay of BAYS)for(const side of [-1,1])box(staticGroup,.075,.014,.82,mats.stripe,bay.x+side*(coachTemplate?1.8:1.48),.093,bay.z);
  for(const bay of BAYS)box(staticGroup,.07,.014,.82,mats.stripe,5.1,.093,bay.z);
  // One raised walkway: the travelers' sidewalk plus a sawtooth that steps up behind each bay, with rounded corners.
  const [e0,e1,e2]=BAYS.map((_,i)=>platformEdge(i)),[l0,l1,l2,l3]=LANE_EDGES;
  const outline=roundedPolygon([[-7.68,l0],[e0,l0,1],[e0,l1,1],[e1,l1,1],[e1,l2,1],[e2,l2,1],[e2,l3,1],[7.68,l3],[7.68,6.33],[-7.68,6.33]],.32);
  put(staticGroup,new THREE.ExtrudeGeometry(outline,{depth:.07,bevelEnabled:false,curveSegments:6}).rotateX(Math.PI/2).translate(0,.105,0),mats.platform).castShadow=false;
  for(const x of [-6.6,-3,0,3,6.6])tree(staticGroup,x,-4.5,.96+Math.random()*.15);
  for(const x of [-6.5,-3.7,3.7,6.5])tree(staticGroup,x,5.35,.92+Math.random()*.16);
  for(const x of [-5.5,5.5]){put(staticGroup,new THREE.CylinderGeometry(.21,.24,.32,6),mats.cream,x,.16,5.3);put(staticGroup,new THREE.IcosahedronGeometry(.35,0),mats.leaf2,x,.52,5.3);}
  for(let i=0;i<24;i++){const x=-7.2+Math.random()*14.4,z=-5+Math.random()*11;if(Math.abs(z)<3.4||Math.abs(x)<2.5&&z>3.4)continue;const flower=put(staticGroup,new THREE.IcosahedronGeometry(.05,0),material(i%2?0xffd694:0xffffff),x,.13,z);flower.castShadow=false;}
  // The station's flag waves on a pole behind the road.
  put(staticGroup,new THREE.CylinderGeometry(.035,.045,2.6,8),mats.pole,1.5,1.3,-4.35);
  stationFlag=put(staticGroup,new THREE.PlaneGeometry(1.05,.7,8,1),new THREE.MeshLambertMaterial({map:flagTexture(currentStation),side:THREE.DoubleSide}),2.05,2.2,-4.35);stationFlag.castShadow=false;
}
const busTexture=textTexture('SouSou Bus','#bd5a28','#fff9e9');
function sideBrandTexture(){const el=document.createElement('canvas');el.width=768;el.height=160;const ctx=el.getContext('2d');ctx.clearRect(0,0,768,160);ctx.fillStyle='#fff8e9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 112px Arial';ctx.lineJoin='round';ctx.lineWidth=14;ctx.strokeStyle='#b4521f';ctx.strokeText('SouSou Bus',384,83);ctx.fillText('SouSou Bus',384,83);const texture=new THREE.CanvasTexture(el);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
const sideBrand=sideBrandTexture();
// Low-poly Irizar i6 coach: flat-colour parts are named in the GLB and mapped to the game palette.
const COACH_PARTS={Body:mats.orange,Trim:mats.trim,Chrome:mats.wheelHub,Glass:mats.coachGlass,Lights:mats.cream,Tire:mats.wheel,Rim:mats.wheelHub};
let coachTemplate=null;
const coachTemplatePromise=new GLTFLoader().loadAsync(`./models/souha-bus.glb?v=${BUILD}`).then(gltf=>{const model=gltf.scene;model.scale.set(.325,.25,.25);model.traverse(o=>{if(!o.isMesh)return;o.material=COACH_PARTS[o.material.name]||mats.dark;o.geometry.userData.shared=true;o.castShadow=true;o.receiveShadow=true;});return model;}).catch(error=>{console.warn('SouSou Bus model failed to load; using the built-in coach.',error);return null;});
function addModelCoach(g){
  g.add(coachTemplate.clone());
  for(const side of [-1,1]){const brand=put(g,new THREE.PlaneGeometry(1.75,.29),new THREE.MeshBasicMaterial({map:sideBrand,transparent:true,side:THREE.DoubleSide,depthWrite:false}),side*.475,.42,-.05);brand.rotation.y=side*Math.PI/2;brand.castShadow=false;}
  const frontBrand=put(g,new THREE.PlaneGeometry(.5,.1),new THREE.MeshBasicMaterial({map:busTexture,side:THREE.DoubleSide}),0,.22,1.715);frontBrand.castShadow=false;
}
function coachPanel(group,points,mat){const geometry=new THREE.BufferGeometry(),vertices=[...points[0],...points[1],...points[2],...points[0],...points[2],...points[3]];geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return put(group,geometry,mat);}
function buildBus(bus,x,z){
  const g=new THREE.Group();g.position.set(x,.09,z);g.rotation.y=Math.PI/2;g.userData.pick={kind:'bus',id:bus.id};busGroup.add(g);
  if(coachTemplate)addModelCoach(g);else addBuiltInCoach(g);
  if(bus.id===selectedBus&&!bus.payout)addSelectionPad(g,0x6fdc9c,0x22b866);
  else if(bus.payout>0)addSelectionPad(g,0xffe08a,0xf2b705);
  // The destination flag rides on the roof so you can read each bus's country at a glance.
  if(bus.dest){const flag=put(g,new THREE.PlaneGeometry(.54,.36),new THREE.MeshBasicMaterial({map:flagTexture(bus.dest),side:THREE.DoubleSide}),0,1.28,.9);flag.rotation.y=-Math.PI/2;flag.castShadow=false;}
  const hit=put(g,new THREE.BoxGeometry(1.38,1.45,3.55),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),0,.7,0);hit.castShadow=false;hit.receiveShadow=false;
  return g;
}
function roundedRect(path,w,h,r){const x=-w/2,y=-h/2;path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);path.lineTo(x+r,y+h);path.quadraticCurveTo(x,y+h,x,y+h-r);path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);return path;}
// points are [x,z,round?]; rounded corners are cut back by r and joined with a curve.
function roundedPolygon(points,r){const shape=new THREE.Shape();points.forEach(([x,y,round],i)=>{if(!round){i?shape.lineTo(x,y):shape.moveTo(x,y);return;}const [px,py]=points[(i+points.length-1)%points.length],[nx,ny]=points[(i+1)%points.length],a=Math.hypot(px-x,py-y),b=Math.hypot(nx-x,ny-y);shape.lineTo(x+(px-x)/a*r,y+(py-y)/a*r);shape.quadraticCurveTo(x,y,x+(nx-x)/b*r,y+(ny-y)/b*r);});shape.closePath();return shape;}
// Selected bus: a glowing green rounded rectangle; a bus holding fares: gold. Both pulse gently (see animate).
const pads=[];
function addSelectionPad(g,fillColor,lineColor){
  const w=1.46,h=3.95,border=.12,pad=new THREE.Group();pad.position.y=.012;g.add(pad);
  const outline=roundedRect(new THREE.Shape(),w,h,.26);outline.holes.push(roundedRect(new THREE.Path(),w-border*2,h-border*2,.26-border));
  const fill=new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(new THREE.Shape(),w-border*2,h-border*2,.26-border)).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:fillColor,transparent:true,opacity:.32,depthWrite:false}));
  const line=new THREE.Mesh(new THREE.ShapeGeometry(outline).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:lineColor}));
  for(const mesh of [fill,line]){mesh.renderOrder=1;pad.add(mesh);}
  pad.userData.selectionPad=true;pad.userData.fill=fill.material;pads.push(pad);}
function addBuiltInCoach(g){
  // The long side profile and angled nose follow a modern touring coach.
  box(g,1.01,.19,3.02,mats.dark,0,.25,-.01);
  const profile=new THREE.Shape();profile.moveTo(-1.53,.26);profile.lineTo(1.37,.26);profile.lineTo(1.58,.4);profile.lineTo(1.65,.61);profile.lineTo(1.5,1.12);profile.lineTo(1.29,1.24);profile.lineTo(-1.43,1.24);profile.lineTo(-1.55,1.1);profile.closePath();
  const body=new THREE.ExtrudeGeometry(profile,{depth:1.08,bevelEnabled:false});body.rotateY(-Math.PI/2);body.translate(.54,0,0);put(g,body,mats.orange);
  box(g,.99,.07,2.74,mats.orangeDark,0,1.25,-.08);
  coachPanel(g,[[-.46,1.15,1.51],[.46,1.15,1.51],[.47,.65,1.64],[-.47,.65,1.64]],mats.coachGlass);
  for(const side of [-1,1]){
    const xx=side*.555;box(g,.014,.4,2.55,mats.coachGlass,xx,.97,-.16);
    const brand=put(g,new THREE.PlaneGeometry(1.7,.27),new THREE.MeshBasicMaterial({map:sideBrand,transparent:true,side:THREE.DoubleSide,depthWrite:false}),side*.575,.55,-.29);brand.rotation.y=side*Math.PI/2;brand.castShadow=false;
    for(const zz of [-1.08,.9]){const wheel=put(g,new THREE.CylinderGeometry(.22,.22,.09,14),mats.wheel,side*.6,.22,zz);wheel.rotation.z=Math.PI/2;}
  }
  const frontBrand=put(g,new THREE.PlaneGeometry(.53,.12),new THREE.MeshBasicMaterial({map:busTexture,side:THREE.DoubleSide}),0,.42,1.7);frontBrand.castShadow=false;
}

// ---------------------------------------------------------------------------------------------------------------
// Walkway spots: travelers stand on random spots over the walkway that are visible on this screen.
// ---------------------------------------------------------------------------------------------------------------
const CROWD_SPOTS=[];let crowdSeed=1729;
function crowdRandom(){crowdSeed=(crowdSeed*1664525+1013904223)>>>0;return crowdSeed/4294967296;}
const CROWD_OBSTACLES=[[-6.5,5.35],[-3.7,5.35],[3.7,5.35],[6.5,5.35],[-5.5,5.3],[5.5,5.3]];
function onWalkway(x,z){if(CROWD_OBSTACLES.some(([ox,oz])=>Math.hypot(x-ox,z-oz)<.5))return false;if(z>=3.45&&z<=6.1)return Math.abs(x)<=7.3;return BAYS.some((_,i)=>z>=LANE_EDGES[i]+.28&&z<=LANE_EDGES[i+1]-.28&&x>=-7.35&&x<=platformEdge(i)-.3);}
for(let attempts=0;CROWD_SPOTS.length<240&&attempts<60000;attempts++){const x=-7.35+crowdRandom()*14.65,z=-2.85+crowdRandom()*8.95;if(onWalkway(x,z)&&CROWD_SPOTS.every(([px,pz])=>Math.hypot(x-px,z-pz)>.3))CROWD_SPOTS.push([x,z]);}
// Spots that show on screen, clear of the top bar, the bottom bar, the side arrows and the bus button (recomputed on resize).
let onScreenSpots=null;
function computeOnScreenSpots(){const v=new THREE.Vector3(),w=innerWidth,h=innerHeight,top=$('mult-badge').getBoundingClientRect().bottom+46,bottom=document.querySelector('.bottom-area').getBoundingClientRect().top-6;
  return new Set(CROWD_SPOTS.map(([x,z],i)=>{v.set(x,.4,z).project(camera);const px=(v.x*.5+.5)*w,py=(-v.y*.5+.5)*h;return px>52&&px<w-52&&py>top&&py<bottom?i:-1;}).filter(i=>i>=0));}
function buildPerson(traveler){
  const [x,z]=CROWD_SPOTS[traveler.spot],g=new THREE.Group();g.position.set(x,.1,z);g.scale.setScalar(PERSON_SCALE);g.userData.travelerId=traveler.id;crowdGroup.add(g);
  // Shirts show the traveler's country (or their bonus colour), and faded travelers stand slightly smaller.
  const offsets=[[0,0],[-.34,.18],[.34,.14]].slice(0,Math.min(3,traveler.size||1));
  for(const [ox,oz] of offsets){put(g,new THREE.CylinderGeometry(.11,.16,.33,6),shirtMats[traveler.special||traveler.dest],ox,.3,oz);put(g,new THREE.IcosahedronGeometry(.14,0),mats.skin,ox,.61,oz);put(g,new THREE.IcosahedronGeometry(.145,0),mats.hair,ox,.69,oz-.045);
    for(const xx of [-.075,.075])put(g,new THREE.CylinderGeometry(.035,.04,.18,5),mats.dark,ox+xx,.08,oz);}
  g.userData.pop=performance.now();return g;}

// ---------------------------------------------------------------------------------------------------------------
// Rendering buses, travelers and their HTML tags
// ---------------------------------------------------------------------------------------------------------------
let busLabels=[],crowdLabels=[];
function renderBuses(){
  syncSelectedBus();const visible=bayBuses(),moving=new Map(entryEffects.map(e=>[e.id,{x:e.model.position.x,z:e.model.position.z}]));entryEffects.length=0;pads.length=0;clear(busGroup);busLabels=[];
  for(const bus of visible){const {x,z}=BAYS[bus.bay],g=buildBus(bus,x,z),origin=pendingMoves[bus.id]?{x:10.5,z}:moving.get(bus.id);
    if(origin&&Math.hypot(origin.x-x,origin.z-z)>.1){g.position.set(origin.x,.09,origin.z);entryEffects.push({id:bus.id,model:g,started:performance.now()+(pendingMoves[bus.id]?250:0),fromX:origin.x,fromZ:origin.z,toX:x,toZ:z});}
    delete pendingMoves[bus.id];busLabels.push({kind:'bus',id:bus.id,object:g,anchor:new THREE.Vector3(0,1.62,-.15)});}
  renderLabels();}
function renderCrowd(){
  const known=new Set(crowd.map(p=>p.id));
  for(const child of [...crowdGroup.children])if(!known.has(child.userData.travelerId)){crowdGroup.remove(child);disposeTree(child);}
  const built=new Set(crowdGroup.children.map(c=>c.userData.travelerId));for(const p of crowd)if(!built.has(p.id))buildPerson(p);
  crowdLabels=crowd.map(p=>({kind:'traveler',id:p.id,object:crowdGroup.children.find(c=>c.userData.travelerId===p.id),anchor:new THREE.Vector3(0,.96,0)}));
  renderLabels();}
// Tags are kept and updated in place (keyed by kind and id), so their pop-in and countdown animations never restart.
const tagElements=new Map();
function busTagMarkup(b,now){
  if(b.payout>0){const left=Math.max(0,b.claimBy-now),total=run.cfg.claim;return {className:'bus-tag collect'+(left<3500?' hurry':''),label:`Claim ${euro(b.payout)}`,html:`<strong>${icon('bag')} ${euro(b.payout)}</strong><small>TAP TO CLAIM · <span class="claim-left">${Math.ceil(left/1000)}</span>s</small><span class="claim-timer" style="animation-duration:${total}ms;animation-delay:-${total-left}ms"></span>`,sig:`pay${b.payout}-${b.claimBy}`};}
  const full=b.passengers>=CAPACITY,dest=b.dest?`${flagMarkup(b.dest,'bus-flag')}<b class="bus-dest">${city[b.dest].name}</b>`:'';
  return {className:`bus-tag${b.id===selectedBus?' selected':''}${full?' full':''}`,label:`Bus to ${b.dest?city[b.dest].name:'nowhere'}, ${b.passengers} of ${CAPACITY} aboard${full?', tap to send':''}`,
    html:full?`<span class="bus-tag-heading">${dest}</span><strong>${icon('bus')} GO!</strong><small class="bus-fare">${euro(b.revenue)}</small>`:`<span class="bus-tag-heading">${dest}</span><small>${b.passengers}/${CAPACITY}${b.revenue?` · ${euro(b.revenue)}`:''}</small><span class="bus-progress"><i style="width:${b.passengers/CAPACITY*100}%"></i></span>`,
    sig:`${b.dest}-${b.passengers}-${b.revenue}`};}
function renderLabels(){
  const now=Date.now(),selected=getSelectedBus(),tappableDest=canBoard(selected)?selected.dest:null,freeSeats=canBoard(selected)?CAPACITY-selected.passengers:0,host=$('scene-labels'),seen=new Set();
  const upsert=(key,attr,id,className,label,html,sig)=>{seen.add(key);let tag=tagElements.get(key);
    if(!tag){const el=document.createElement('button');el.dataset[attr]=id;host.appendChild(el);tag={el,sig:null};tagElements.set(key,tag);}
    if(tag.sig!==sig){tag.el.innerHTML=html;tag.sig=sig;}if(tag.el.className!==className)tag.el.className=className;tag.el.setAttribute('aria-label',label);return tag.el;};
  for(const entry of busLabels){const b=run.buses.find(x=>x.id===entry.id);if(!b)continue;const m=busTagMarkup(b,now);entry.el=upsert('bus'+b.id,'bus',b.id,m.className,m.label,m.html,m.sig);}
  for(const entry of crowdLabels){const p=crowd.find(x=>x.id===entry.id);if(!p)continue;const faded=p.dest!==tappableDest,special=p.special&&SPECIALS[p.special],life=p.until-p.born;
    const size=p.size||1,tooBig=!faded&&size>freeSeats;
    entry.el=upsert('t'+p.id,'traveler',p.id,`traveler-tag${faded?' faded':''}${special?` special special-${p.special}`:''}${size>1?' group':''}${tooBig?' too-big':''}`,`${special?special.label+' ':''}${size>1?`group of ${size} `:''}traveler to ${city[p.dest].name}${faded?', board a bus to that country first':tooBig?', does not fit':''}`,
      `${flagMarkup(p.dest)}${size>1?`<span class="group-badge">${size}</span>`:''}${special?`<span class="special-glow"></span><span class="special-badge">${icon(special.icon)}</span>`:''}<span class="life-timer" style="animation-duration:${life}ms;animation-delay:-${Math.max(0,now-p.born)}ms"></span>`,'t');}
  for(const [key,tag] of tagElements)if(!seen.has(key)){tag.el.remove();tagElements.delete(key);}
  positionLabels();}
function positionLabels(){
  const r=canvas.getBoundingClientRect();
  for(const entry of [...busLabels,...crowdLabels]){const el=entry.el;if(!entry.object||!el)continue;const p=entry.object.localToWorld(entry.anchor.clone()).project(camera);let x=(p.x*.5+.5)*r.width,y=(-p.y*.5+.5)*r.height;const half=el.offsetWidth/2;x=THREE.MathUtils.clamp(x,half+5,r.width-half-5);y=THREE.MathUtils.clamp(y,el.offsetHeight+8,r.height-5);el.style.left=x+'px';el.style.top=y+'px';}}
// The camera frames the station in the free space between the HUD and the bottom bar on any screen: all three buses
// fully visible (with room above for their labels) and the sidewalk where travelers wait just above the bottom bar.
const FRAME_BUSES=BAYS.flatMap(b=>[[b.x-1.75,0,b.z-.5],[b.x+1.75,0,b.z+.5],[b.x-1.75,1.35,b.z],[b.x+1.75,1.35,b.z]]),FRAME_WALK=[[-3.2,0,6.3],[0,0,6.3],[3.2,0,6.3]];
function frameCamera(w,h){
  camera.position.set(2.8,8.4,10);camera.lookAt(0,.15,.7);camera.updateMatrixWorld();
  const inv=camera.matrixWorldInverse,toCam=p=>new THREE.Vector3(...p).applyMatrix4(inv),buses=FRAME_BUSES.map(toCam),all=[...buses,...FRAME_WALK.map(toCam)];
  const top=$('mult-badge').getBoundingClientRect().bottom+64,bottom=document.querySelector('.bottom-area').getBoundingClientRect().top-10,margin=14;
  const xMin=Math.min(...buses.map(p=>p.x)),xMax=Math.max(...buses.map(p=>p.x)),yMin=Math.min(...all.map(p=>p.y)),yMax=Math.max(...all.map(p=>p.y));
  const halfW=Math.max((xMax-xMin)/2/(1-2*margin/w),(yMax-yMin)*h/(2*Math.max(120,bottom-top))*w/h),halfH=halfW*h/w;
  const cx=(xMin+xMax)/2,cy=(yMin+yMax)/2-halfH*(1-(top+bottom)/h);
  camera.left=cx-halfW;camera.right=cx+halfW;camera.top=cy+halfH;camera.bottom=cy-halfH;camera.updateProjectionMatrix();}
function resize(){
  const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);frameCamera(w,h);
  onScreenSpots=computeOnScreenSpots();crowd=crowd.filter(p=>onScreenSpots.size<8||onScreenSpots.has(p.spot));if(run)renderCrowd();}
addEventListener('resize',resize);

// ---------------------------------------------------------------------------------------------------------------
// Input: tap tags or buses; swipe sideways anywhere to change station; buttons for the overlays.
// ---------------------------------------------------------------------------------------------------------------
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let press=null;
addEventListener('pointerdown',e=>{press=mode==='play'?{x:e.clientX,y:e.clientY,t:performance.now()}:null;},{capture:true});
addEventListener('pointerup',e=>{
  if(!press)return;const dx=e.clientX-press.x,dy=e.clientY-press.y,quick=performance.now()-press.t<800;press=null;
  if(quick&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&stationsInRun().length>1)switchStation(neighbour(dx<0?1:-1),dx<0?1:-1);},{capture:true});
// Travelers and buses react the moment a finger touches them (tag, body or coach), so quick taps that wobble a little still count.
$('scene-labels').addEventListener('pointerdown',e=>{const traveler=e.target.closest('[data-traveler]'),bus=e.target.closest('[data-bus]');if(traveler){e.preventDefault();tapTraveler(Number(traveler.dataset.traveler));}else if(bus){e.preventDefault();tapBus(Number(bus.dataset.bus));}});
canvas.addEventListener('pointerdown',e=>{if(mode!=='play')return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);for(const hit of raycaster.intersectObjects([...crowdGroup.children,...busGroup.children],true)){let o=hit.object;while(o&&o.userData.travelerId===undefined&&!o.userData.pick)o=o.parent;if(!o)continue;if(o.userData.pick)tapBus(o.userData.pick.id);else tapTraveler(o.userData.travelerId);break;}});
// Tabs and money pills redraw every second, so they react on touch-down (a tap can never land mid-redraw).
$('station-tabs').addEventListener('pointerdown',e=>{const tab=e.target.closest('[data-station]');if(tab){e.preventDefault();switchStation(tab.dataset.station);}});
$('claims-bar').addEventListener('pointerdown',e=>{const pill=e.target.closest('[data-station]');if(pill){e.preventDefault();switchStation(pill.dataset.station);}});
$('pause-btn').addEventListener('click',pause);
$('overlay').addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.id==='play-btn')openLevel(game.level);else if(button.id==='start-btn')startCountdown();else if(button.id==='resume-btn')resume();
  else if(button.id==='restart-btn'||button.id==='retry-btn')openLevel(run.n);else if(button.id==='next-btn')openLevel(game.level);else if(button.id==='home-btn'){play('select');goHome();}
  else if(button.dataset.level)openLevel(Number(button.dataset.level));else if(button.dataset.upgrade)buyUpgrade(button.dataset.upgrade);});
addEventListener('keydown',e=>{if(e.key==='Escape')mode==='play'?pause():mode==='paused'&&resume();if(mode==='play'&&e.key==='ArrowRight')switchStation(neighbour(1),1);if(mode==='play'&&e.key==='ArrowLeft')switchStation(neighbour(-1),-1);});
function renderSoundButton(){$('sound').innerHTML=icon(sound?'sound-on':'sound-off');$('sound').setAttribute('aria-label',sound?'Mute sound':'Turn sound on');}
$('sound').addEventListener('click',()=>{sound=!sound;localStorage.setItem('souha-sound',sound?'on':'off');renderSoundButton();play('select');});

// ---------------------------------------------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------------------------------------------
let shownCoins=game.coins;
function animate(){
  requestAnimationFrame(animate);const now=performance.now(),clockNow=Date.now();
  // Coin counters and the goal bar roll toward what has landed.
  const coinGoal=game.coins-coinsInFlight;if(shownCoins!==coinGoal){const gap=coinGoal-shownCoins;shownCoins+=Math.abs(gap)<2?gap:Math.round(gap*.14)||Math.sign(gap);for(const el of document.querySelectorAll('.coin-pill strong'))el.textContent=Math.round(shownCoins).toLocaleString('en-US');}
  if(run){const earnedGoal=run.earned-(mode==='play'||mode==='paused'?coinsInFlight:0);if(shownEarned!==earnedGoal){const gap=earnedGoal-shownEarned;shownEarned+=Math.abs(gap)<2?gap:Math.round(gap*.14)||Math.sign(gap);renderGoal();}}
  if(mode==='play'){if(combo.count&&clockNow-combo.last>run.cfg.combo&&clockNow>combo.frozenUntil)endCombo();renderCombo(clockNow);}
  for(const pad of pads){const pulse=Math.sin(now/260);pad.scale.set(1+pulse*.025,1,1+pulse*.012);pad.userData.fill.opacity=.42+pulse*.12;}
  if(stationFlag){const pos=stationFlag.geometry.attributes.position;for(let i=0;i<pos.count;i++){const x=pos.getX(i)+.525;pos.setZ(i,Math.sin(now/260+x*5)*.06*x);}pos.needsUpdate=true;}
  // New travelers pop in with a little bounce.
  for(const g of crowdGroup.children){const t=Math.min(1,(now-g.userData.pop)/220);g.scale.setScalar(PERSON_SCALE*(t<1?1-Math.pow(1-t,3)*(1-Math.sin(t*Math.PI)*.4):1));}
  for(let i=departureEffects.length-1;i>=0;i--){const effect=departureEffects[i],t=Math.min(1,(now-effect.started)/450),ease=1-(1-t)**3;effect.model.position.x=THREE.MathUtils.lerp(effect.x,10.5,ease);if(now-effect.lastSmoke>45&&t<.85){emitSmoke(effect.model,now);effect.lastSmoke=now;}if(t>=1){scene.remove(effect.model);disposeTree(effect.model);departureEffects.splice(i,1);}}
  let entriesFinished=false;for(let i=entryEffects.length-1;i>=0;i--){const effect=entryEffects[i],t=THREE.MathUtils.clamp((now-effect.started)/550,0,1),ease=1-(1-t)**3;effect.model.position.x=THREE.MathUtils.lerp(effect.fromX,effect.toX,ease);effect.model.position.z=THREE.MathUtils.lerp(effect.fromZ,effect.toZ,ease);if(t>=1){entryEffects.splice(i,1);entriesFinished=true;}}if(entriesFinished&&!entryEffects.length){renderLabels();renderHud();}
  for(let i=boardingEffects.length-1;i>=0;i--){const effect=boardingEffects[i],t=THREE.MathUtils.clamp((now-effect.started)/260,0,1),ease=t*t*(3-2*t),bus=busModel(effect.busId);if(bus)effect.to.copy(bus.localToWorld(new THREE.Vector3(-.58,.55,1.18)));effect.model.position.lerpVectors(effect.from,effect.to,ease);effect.model.position.y+=Math.sin(Math.PI*t)*.9;effect.model.scale.setScalar(PERSON_SCALE*(1-.18*t));const fade=t<.35?1:(1-t)/.65;for(const m of effect.materials)m.opacity=fade;if(t>=1){scene.remove(effect.model);disposeTree(effect.model);boardingEffects.splice(i,1);}}
  for(let i=vanishEffects.length-1;i>=0;i--){const effect=vanishEffects[i],t=Math.min(1,(now-effect.started)/180);effect.model.scale.setScalar(PERSON_SCALE*(1-t));effect.model.position.y=.1+t*.15;if(t>=1){scene.remove(effect.model);disposeTree(effect.model);vanishEffects.splice(i,1);}}
  for(let i=smokeEffects.length-1;i>=0;i--){const effect=smokeEffects[i],t=Math.min(1,(now-effect.started)/620);effect.puff.position.y+=.006;effect.puff.position.x+=effect.vx*.016;effect.puff.scale.setScalar(1+t*2.5);effect.puff.material.opacity=.82*(1-t);if(t>=1){scene.remove(effect.puff);effect.puff.geometry.dispose();effect.puff.material.dispose();smokeEffects.splice(i,1);}}
  // Claim countdowns tick down on the gold tags without re-rendering them.
  if(run)for(const el of document.querySelectorAll('.claim-left')){const bus=run.buses.find(b=>b.id===Number(el.closest('[data-bus]').dataset.bus));if(bus){const s=Math.max(0,Math.ceil((bus.claimBy-clockNow)/1000));if(el.textContent!==String(s))el.textContent=s;el.closest('.bus-tag').classList.toggle('hurry',bus.claimBy-clockNow<3500);}}
  positionLabels();renderer.render(scene,camera);}

coachTemplate=await coachTemplatePromise;
renderSoundButton();prepareRun(game.level);buildStatic();resize();goHome();animate();setInterval(tick,90);
