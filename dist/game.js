import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

// ---------------------------------------------------------------------------------------------------------------
// Rules and tuning
// ---------------------------------------------------------------------------------------------------------------
const STATIONS = [
  {id:'tunis',name:'Tunis',country:'Tunisia',code:'TN',cost:0,accent:0xf7a86a,shirt:0xe8833f},
  {id:'paris',name:'Paris',country:'France',code:'FR',cost:0,accent:0xa5c9ed,shirt:0x5b8fd6},
  {id:'rome',name:'Rome',country:'Italy',code:'IT',cost:6000,accent:0xeec99b,shirt:0x52a86b},
  {id:'barcelona',name:'Barcelona',country:'Spain',code:'ES',cost:15000,accent:0xf5bca2,shirt:0xe0b13a},
  {id:'berlin',name:'Berlin',country:'Germany',code:'DE',cost:35000,accent:0xbbc9da,shirt:0x6d6f78},
  {id:'istanbul',name:'Istanbul',country:'Türkiye',code:'TR',cost:70000,accent:0xcbb2d6,shirt:0xd2475a}
];
const city=Object.fromEntries(STATIONS.map(s=>[s.id,s]));
const $=id=>document.getElementById(id);
const flagMarkup=(id,className='flag-icon')=>`<img class="${className}" src="./flags/${city[id].code.toLowerCase()}.svg" alt="" aria-hidden="true">`;
// Icons are single-colour SVGs (Streamline Plump Solid) used as CSS masks, so they take the text colour.
const icon=(name,className='')=>`<i class="ico ${className}" style="--i:url(./icons/${name}.svg)" aria-hidden="true"></i>`;
const euro=n=>'€'+Math.floor(n).toLocaleString('en-US');
const busName=bus=>`Bus #${String(bus.id).padStart(2,'0')}`;
const SAVE_KEY='souha-bus-station-stories-v1',CAPACITY=20,PERSON_SCALE=.58;
const BAYS=[{x:-2.15,z:-2},{x:0,z:0},{x:2.15,z:2}],LANE_EDGES=[-3.1,-1.02,1.02,3.1];
// Where the raised walkway stops behind bay i (just past the rear of a parked coach).
const platformEdge=i=>BAYS[i].x-1.98;
// Travelers arrive every SPAWN_MS while there is room on screen and leave after LIFE_MS; bonus travelers leave after BONUS_LIFE_MS.
const SPAWN_MS=170,LIFE_MS=[2600,3800],BONUS_LIFE_MS=500;
// An arrived bus holds its fares for CLAIM_MS: tap it in time or the money is lost.
const CLAIM_MS=12000;
// Combo: boardings less than COMBO_MS apart keep it going, and every COMBO_STEP boardings add +0.5 to its multiplier.
const COMBO_MS=1500,COMBO_STEP=4;
const SPECIALS={
  vip:{icon:'star',label:'VIP · combo ×2',chance:.06,color:0xffc93c},
  gift:{icon:'gift',label:'Gift',chance:.06,color:0xff7ab8,bonus:60},
  heart:{icon:'heart',label:'Friends +3',chance:.05,color:0xff5f6d},
  rush:{icon:'flash',label:'Rush · combo frozen',chance:.04,color:0x48c8ff},
  diamond:{icon:'diamond',label:'Diamond',chance:.015,color:0x8ee8ff,bonus:250}};
const SPECIAL_CSS={vip:'#ffc800',gift:'#ff86d0',heart:'#ff4b4b',rush:'#1cb0f6',diamond:'#7fe3ff'};
const stationIndex=id=>STATIONS.findIndex(s=>s.id===id);
const distance=(a,b)=>Math.abs(stationIndex(a)-stationIndex(b));
// Why grow: every bus beyond the first five adds +5% to every fare, every station beyond the first two adds +15%,
// and every player level adds +2%; new stations also open longer routes, and longer routes pay more per traveler.
const BUS_BOOST=.05,STATION_BOOST=.15,LEVEL_BOOST=.02;
const boostParts=()=>({buses:BUS_BOOST*Math.max(0,game.buses.length-5),stations:STATION_BOOST*Math.max(0,game.open.length-2),level:LEVEL_BOOST*((game.level||1)-1)});
const boost=()=>{const p=boostParts();return 1+p.buses+p.stations+p.level;};
const shortEuro=n=>n>=1000?'€'+(n/1000).toFixed(n%1000?1:0).replace(/\.0$/,'')+'k':euro(n);
const pct=v=>`+${Math.round(v*100)}%`;
const fareFor=(origin,dest)=>Math.round((12+6*distance(origin,dest))*boost());
const tripTime=(origin,dest)=>(7+2*distance(origin,dest))*1000;
// Each bus beyond the starting five costs 20% more than the last.
const busCost=()=>Math.round(1500*1.2**Math.max(0,game.buses.length-5)/10)*10;

// ---------------------------------------------------------------------------------------------------------------
// Saved game: coins, unlocked stations and buses. Travelers are not saved; they come and go every few seconds.
// ---------------------------------------------------------------------------------------------------------------
function newBus(id,location){return {id,location,status:'idle',dest:null,passengers:0,revenue:0,payout:0,claimBy:0,readyAt:Date.now()};}
function freshGame(){const buses=[];for(let id=1;id<=5;id++)buses.push(newBus(id,id<=3?'tunis':'paris'));return {version:2,coins:360,open:['tunis','paris'],buses,nextBus:6,bestCombo:0,xp:0,level:1};}
// Version 1 saves keep their coins (plus any fares still on buses), stations and buses; every bus is parked at a station.
function migrate(old){
  const open=old.open.filter(id=>city[id]),parked=b=>b.status==='idle'&&open.includes(b.location)?b.location:open.includes(b.destination)?b.destination:open[0];
  const owed=old.buses.reduce((sum,b)=>sum+(b.payout||0)+(b.revenue||0),0);
  return {version:2,coins:Math.floor((old.coins||0)+owed),open,buses:old.buses.map(b=>newBus(b.id,parked(b))),nextBus:old.nextBus||old.buses.length+1,bestCombo:0};}
function load(){try{const data=JSON.parse(localStorage.getItem(SAVE_KEY));if(data?.version===2&&Array.isArray(data.buses))return data;if(data?.version===1&&Array.isArray(data.buses))return migrate(data);}catch{}return freshGame();}
const game=load();game.xp??=0;game.level??=1;
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));}catch{}}
// Every parked bus waiting for travelers has a random destination among the other unlocked stations.
function assignDest(bus){const options=game.open.filter(id=>id!==bus.location);bus.dest=options[Math.floor(Math.random()*options.length)]||null;}
for(const bus of game.buses)if(bus.status==='idle'&&!bus.payout&&!bus.dest)assignDest(bus);
let currentStation=game.buses.find(b=>b.status==='idle')?.location||game.open[0],selectedBus=null,sheet=null,sound=localStorage.getItem('souha-sound')!=='off';
save();

// ---------------------------------------------------------------------------------------------------------------
// Sound: CC0 samples (see sounds/CREDITS.txt) through one shared Web Audio context, unlocked by the first tap.
// ---------------------------------------------------------------------------------------------------------------
const SOUND_NAMES=['board','bus-full','select','depart','coins','buy','station-open','switch','error','menu-open','arrival','vip','gift','heart','rush','diamond','combo','tick','lost','note','pop-a','pop-b','pop-c','ping','coin-jingle','purchase'];
const soundFiles=Object.fromEntries(SOUND_NAMES.map(name=>[name,fetch(`./sounds/${name}.mp3`).then(r=>r.arrayBuffer()).catch(()=>null)]));
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
// Buses: tap one to choose it, fill it with travelers for its country, tap it again when full to send it.
// It parks at its destination holding the fares; tap it there within CLAIM_MS or the money is lost.
// ---------------------------------------------------------------------------------------------------------------
const busesHere=()=>game.buses.filter(b=>b.status==='idle'&&b.location===currentStation);
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
  const bus=bayBuses().find(b=>b.id===id);if(!bus)return;
  if(bus.payout>0)return claim(bus);
  if(entering(bus))return;
  if(bus.passengers>=CAPACITY)return depart(bus);
  if(selectedBus!==id){selectedBus=id;play('select');vibrate(8);renderBuses();renderCrowd();renderHud();}}
function depart(bus){
  const tagRect=document.querySelector(`[data-bus="${bus.id}"]`)?.getBoundingClientRect(),vacated=bus.bay;launchVisualDeparture(bus.id);
  Object.assign(bus,{status:'trip',origin:bus.location,departed:Date.now(),arrival:Date.now()+tripTime(bus.location,bus.dest),bay:null});
  const replacement=bayBuses().find(b=>b.bay===vacated);if(replacement)pendingMoves[replacement.id]=true;
  selectedBus=null;syncSelectedBus();save();renderBuses();renderCrowd();renderHud();play('depart',.9);vibrate(20);
  if(tagRect){floatText(tagRect.left+tagRect.width/2,tagRect.top,`${icon('bus')} ${euro(bus.revenue)} → ${city[bus.dest].name}`,'depart');gainXp(10,tagRect.left+tagRect.width/2,tagRect.top+34);}else gainXp(10);}
function arrive(bus,now){
  Object.assign(bus,{status:'idle',location:bus.dest,dest:null,payout:bus.revenue,revenue:0,passengers:0,claimBy:now+CLAIM_MS,readyAt:now,bay:null});
  if(bus.location===currentStation){pendingMoves[bus.id]=true;play('arrival',.9);}
  else toast(`${icon('bag')} ${euro(bus.payout)} waiting in <b>${city[bus.location].name}</b> · ${CLAIM_MS/1000}s!`,'claim');}
function claim(bus){
  const amount=bus.payout;bus.payout=0;bus.claimBy=0;game.coins+=amount;coinsInFlight+=amount;assignDest(bus);
  const tag=document.querySelector(`[data-bus="${bus.id}"]`)?.getBoundingClientRect();if(tag)floatText(tag.left+tag.width/2,tag.top,`${icon('bag')} +${euro(amount)}`,'cash');gainXp(5,tag&&tag.left+tag.width/2,tag&&tag.top+40);
  playCash(amount);burstAt(tag,'#ffc800',16,true);if(tag)flyCoins(tag.left+tag.width/2,tag.top+tag.height/2,amount);else coinsInFlight-=amount;vibrate([20,30,20]);save();renderBuses();renderCrowd();renderHud();}
function loseClaim(bus){
  const lost=bus.payout;bus.payout=0;bus.claimBy=0;assignDest(bus);play('lost',.8);vibrate(60);
  toast(`${icon('timer')} ${euro(lost)} lost in ${city[bus.location].name}`,'error-soft');}
function buyBus(){
  const cost=busCost();if(game.coins<cost)return toast(`Earn ${euro(cost-game.coins)} more for a bus.`,'error');
  game.coins-=cost;const bus=newBus(game.nextBus++,currentStation);assignDest(bus);game.buses.push(bus);pendingMoves[bus.id]=true;
  gainXp(25);save();closeSheet();renderBuses();renderCrowd();renderHud();showPurchase(icon('bus'),`New ${busName(bus)}`,[`${pct(BUS_BOOST)} every fare`,`Fares now ${pct(boost()-1)}`]);play('purchase',.9);play('buy',.6);}
function buyStation(id){
  const target=city[id];if(!target||game.open.includes(id))return;if(game.coins<target.cost)return toast(`Earn ${euro(target.cost-game.coins)} more to open ${target.name}.`,'error');
  game.coins-=target.cost;game.open.push(id);
  // The new station starts with a bus of its own so you can play there right away.
  const bus=newBus(game.nextBus++,id);assignDest(bus);game.buses.push(bus);
  gainXp(100);save();switchStation(id);showPurchase(flagMarkup(id,'flag-large'),`${target.name} is open!`,[`${pct(STATION_BOOST)} every fare`,'+1 free bus',`Fares now ${pct(boost()-1)}`]);play('station-open');}

// ---------------------------------------------------------------------------------------------------------------
// Travelers: they pop up all over the visible walkway, each heading to a country, and leave after a few seconds.
// Only travelers for the selected bus's country can be tapped; the others are faded.
// ---------------------------------------------------------------------------------------------------------------
let crowd=[],nextTravelerId=1,lastSpawn=0;
function rollSpecial(){let roll=Math.random();for(const [kind,special] of Object.entries(SPECIALS)){if(roll<special.chance)return kind;roll-=special.chance;}return null;}
// Destinations favour the selected bus (so there is always someone to tap), then the other buses here, then any other country.
function travelerDest(){
  const others=game.open.filter(id=>id!==currentStation),selected=getSelectedBus(),bays=bayBuses().filter(b=>b.dest&&!b.payout).map(b=>b.dest),roll=Math.random();
  if(selected?.dest&&roll<.55)return selected.dest;if(bays.length&&roll<.8)return bays[Math.floor(Math.random()*bays.length)];return others[Math.floor(Math.random()*others.length)];}
// A flag needs about a tag-sized box of walkway (TAG_BOX) so tags never cover each other.
const TAG_BOX=[.64,.72];
function freeSpot(){
  const pool=onScreenSpots&&onScreenSpots.size>=8?[...onScreenSpots]:CROWD_SPOTS.map((_,i)=>i);
  const roomy=pool.filter(i=>crowd.every(p=>{const [x1,z1]=CROWD_SPOTS[i],[x2,z2]=CROWD_SPOTS[p.spot];return Math.abs(x1-x2)>=TAG_BOX[0]||Math.abs(z1-z2)>=TAG_BOX[1];}));
  return roomy.length?roomy[Math.floor(Math.random()*roomy.length)]:null;}
function spawnTraveler(now,dest=travelerDest()){
  const spot=freeSpot();if(spot===null||!dest)return false;const special=rollSpecial();
  crowd.push({id:nextTravelerId++,dest,spot,special,born:now,until:now+(special?BONUS_LIFE_MS:LIFE_MS[0]+Math.random()*(LIFE_MS[1]-LIFE_MS[0]))});return true;}
function tapTraveler(id){
  const traveler=crowd.find(p=>p.id===id),bus=getSelectedBus(),now=Date.now();if(!traveler)return;
  if(!canBoard(bus)||traveler.dest!==bus.dest){const tag=document.querySelector(`[data-traveler="${id}"]`);tag?.classList.remove('nope');void tag?.offsetWidth;tag?.classList.add('nope');return;}
  // Combo: fares go on the bus; the combo multiplier (+0.5 every COMBO_STEP boardings, ×2 per VIP) is paid on the combo's money when it ends.
  if(combo.count&&now-combo.last>COMBO_MS&&now>combo.frozenUntil)endCombo();
  combo.count++;combo.last=now;const special=traveler.special,fare=fareFor(currentStation,bus.dest);
  if(special==='vip')combo.vip*=2;else if(special==='rush')combo.frozenUntil=now+5000;
  combo.fares+=fare;combo.bonus+=SPECIALS[special]?.bonus||0;bus.revenue+=fare;bus.passengers++;
  crowd=crowd.filter(p=>p.id!==id);
  if(special==='heart')for(let i=0;i<3;i++)spawnTraveler(now,bus.dest);
  const tag=document.querySelector(`[data-traveler="${id}"]`)?.getBoundingClientRect();
  burstAt(tag,special?SPECIAL_CSS[special]:'#58cc02',special?14:5,!!special);
  gainXp(special?5:1,tag&&tag.left+tag.width/2,tag&&tag.top,!special);
  const level=Math.min(4,Math.floor(combo.count/COMBO_STEP));
  if(tag)floatText(tag.left+tag.width/2,tag.top,special?`${icon(SPECIALS[special].icon)} ${SPECIALS[special].label}${SPECIALS[special].bonus?' +'+euro(SPECIALS[special].bonus):''}`:`+${euro(fare)}${comboMultiplier()>1?`<em>×${comboMultiplier()}</em>`:''}`,special||`lvl${level}`);
  const shout=SHOUTS[combo.count];if(shout)showShout(shout);
  launchBoardingAnimation(id,bus.id);
  playComboNote(combo.count);if(special)play(special,.9);if(combo.count%10===0)play('combo',.7);
  if(bus.passengers>=CAPACITY){play('bus-full',.8);vibrate(35);}else vibrate(special?[15,40,15]:10);
  save();renderBuses();renderCrowd();renderHud();renderCombo();}

// ---------------------------------------------------------------------------------------------------------------
// Combo: money earned while the combo lasts is multiplied when it ends (fares already on buses get the extra part).
// ---------------------------------------------------------------------------------------------------------------
const combo={count:0,last:0,fares:0,bonus:0,vip:1,frozenUntil:0};
const SHOUTS={10:'NICE!',20:'GREAT!',30:'AMAZING!',45:'INCREDIBLE!',60:'UNSTOPPABLE!',80:'LEGENDARY!'};
const comboWorth=()=>Math.round((combo.fares+combo.bonus)*comboMultiplier());
const comboMultiplier=()=>(1+.5*Math.floor(combo.count/COMBO_STEP))*combo.vip;
const comboPayout=()=>Math.round(combo.fares*(comboMultiplier()-1)+combo.bonus*comboMultiplier());
function endCombo(){
  if(!combo.count)return;const payout=comboPayout(),count=combo.count,mult=comboMultiplier();
  Object.assign(combo,{count:0,last:0,fares:0,bonus:0,vip:1,frozenUntil:0});
  if(count>game.bestCombo)game.bestCombo=count;if(count>=5)gainXp(Math.floor(count/2));
  if(payout>0){game.coins+=payout;coinsInFlight+=payout;save();renderHud();flyCoins(...rectCentre(showComboBanner(count,mult,payout)),payout);play('combo',.8);playCash(payout,.6);vibrate([20,40,20]);}
  renderCombo();}

// ---------------------------------------------------------------------------------------------------------------
// Stations: swipe left/right (or use the side arrows) to move between unlocked stations.
// ---------------------------------------------------------------------------------------------------------------
const openInOrder=()=>STATIONS.filter(s=>game.open.includes(s.id)).map(s=>s.id);
function neighbour(step){const list=openInOrder(),i=list.indexOf(currentStation);return list[(i+step+list.length)%list.length];}
function switchStation(id,direction=0){
  if(!game.open.includes(id)||id===currentStation&&!direction)return;endCombo();clearBoardingAnimations();currentStation=id;selectedBus=null;crowd=[];
  syncSelectedBus();closeSheet();buildStatic();for(let i=0;i<6;i++)spawnTraveler(Date.now());renderBuses();renderCrowd();renderHud();
  const view=$('game');view.classList.remove('slide-from-left','slide-from-right');void view.offsetWidth;if(direction)view.classList.add(direction>0?'slide-from-right':'slide-from-left');
  play('depart',.35,1.7);play('switch',.5);}

// ---------------------------------------------------------------------------------------------------------------
// Clock: arrivals, claim deadlines, travelers coming and going.
// ---------------------------------------------------------------------------------------------------------------
let lastTickSecond=0;
function tick(){
  const now=Date.now();let busesChanged=false,crowdChanged=false;
  for(const bus of game.buses){
    if(bus.status==='trip'&&now>=bus.arrival){arrive(bus,now);busesChanged=true;}
    else if(bus.status==='idle'&&bus.payout>0&&now>bus.claimBy){loseClaim(bus);busesChanged=true;}}
  // Countdown ticks in the last 3 seconds of a claim at the station you are on.
  const second=Math.floor(now/1000);if(second!==lastTickSecond){lastTickSecond=second;if(bayBuses().some(b=>b.payout>0&&b.claimBy-now<3200&&b.claimBy>now))play('tick',.7);}
  const before=crowd.length;for(const p of crowd)if(now>=p.until)launchVanish(p.id);crowd=crowd.filter(p=>now<p.until);if(crowd.length!==before)crowdChanged=true;
  if(now-lastSpawn>=SPAWN_MS){lastSpawn=now;for(let i=Math.random()<.35?2:1;i>0;i--)if(spawnTraveler(now))crowdChanged=true;}
  if(busesChanged){syncSelectedBus();save();renderBuses();}
  if(busesChanged||crowdChanged)renderCrowd();
  if(busesChanged||second!==lastHudSecond)renderHud();}
let lastHudSecond=0;

// ---------------------------------------------------------------------------------------------------------------
// HUD, sheets and floating feedback
// ---------------------------------------------------------------------------------------------------------------
const floatLayer=document.createElement('div');floatLayer.className='float-layer';$('game').appendChild(floatLayer);
const comboHud=document.createElement('div');comboHud.className='combo-hud hidden';$('game').appendChild(comboHud);
function floatText(x,y,html,kind){const el=document.createElement('div');el.className='float-gain'+(kind?' special-'+kind:'');el.innerHTML=html;el.style.top=y+'px';floatLayer.appendChild(el);
  // Keep the whole label on screen, however long it is.
  const half=el.offsetWidth/2+8;el.style.left=Math.min(Math.max(x,half),innerWidth-half)+'px';setTimeout(()=>el.remove(),1000);}
function showShout(text){const el=document.createElement('div');el.className='shout';el.textContent=text;floatLayer.appendChild(el);setTimeout(()=>el.remove(),900);play('combo',.6,1.25);}
// The message rail under the top bar shows one message at a time (newest wins), so it never reaches the buses.
function showNotice(kind,html,ms=2200){const el=document.createElement('div');el.className='notice notice-'+kind;el.innerHTML=html;$('toast-stack').replaceChildren(el);setTimeout(()=>el.remove(),ms);return el.getBoundingClientRect();}
const rectCentre=r=>[r.left+r.width/2,r.top+r.height/2];
function showComboBanner(count,mult,payout){return showNotice('combo',`<span class="notice-art">${icon('crown')}</span><span>COMBO ${count}</span><b>+${euro(payout)}</b><span class="chip orange">×${mult}</span>`,1800);}
// A purchase pops a card listing exactly what it adds, so the benefit is always visible.
function showPurchase(art,title,perks){showNotice('buy',`<span class="notice-art">${art}</span><b>${title}</b>${perks.map(p=>`<span class="chip green">${p}</span>`).join('')}`,2600);}
// Particle burst at a screen rectangle: small CSS-animated dots that fly out and fade (no canvas or 3D work).
function burstAt(rect,color,count=10,big=false){if(!rect)return;const host=document.createElement('div');host.className='burst'+(big?' big':'');host.style.left=rect.left+rect.width/2+'px';host.style.top=rect.top+rect.height/2+'px';host.style.setProperty('--c',color);
  host.innerHTML='<i class="burst-ring"></i>'+Array.from({length:count},(_,i)=>{const a=i/count*Math.PI*2+Math.random()*.4,d=(big?46:30)+Math.random()*(big?34:20);return `<i style="--dx:${(Math.cos(a)*d).toFixed(1)}px;--dy:${(Math.sin(a)*d).toFixed(1)}px;--s:${(.6+Math.random()*.8).toFixed(2)}"></i>`;}).join('');
  floatLayer.appendChild(host);setTimeout(()=>host.remove(),650);}
function bump(el){el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}
function bumpCoins(){bump($('coins').closest('.coin-pill'));}
// Combo card (left): the streak, what it is worth and the time left. The money multiplier is shown big on the right.
comboHud.innerHTML=`<span class="combo-num">0</span><span class="combo-side"><b class="combo-word">${icon('crown')} COMBO</b><small class="combo-pot">€0</small></span><i class="combo-timer"></i>`;
const comboEls={num:comboHud.querySelector('.combo-num'),pot:comboHud.querySelector('.combo-pot'),timer:comboHud.querySelector('.combo-timer')};
let shownCombo=-1,shownMult='';
const multLevel=m=>m>=4?4:m>=3?3:m>=2?2:m>1?1:0;
function renderCombo(now=Date.now()){
  const mult=combo.count?comboMultiplier():1,label=`×${mult}`;
  if(label!==shownMult){shownMult=label;$('mult-value').textContent=label;$('mult-badge').dataset.level=multLevel(mult);if(mult>1)bump($('mult-badge'));}
  const active=combo.count>=2;comboHud.classList.toggle('hidden',!active);if(!active){shownCombo=-1;return;}
  if(shownCombo!==combo.count){shownCombo=combo.count;comboEls.num.textContent=combo.count;comboEls.pot.textContent=`worth ${euro(comboWorth())}`;bump(comboHud);}
  const frozen=now<combo.frozenUntil;comboEls.timer.classList.toggle('frozen',frozen);comboEls.timer.style.transform=`scaleX(${frozen?1:Math.max(0,1-(now-combo.last)/COMBO_MS).toFixed(3)})`;}
// XP and levels: every action earns XP; each level needs 25 XP more than the last, pays coins and adds +2% to every fare.
const xpToNext=level=>40+25*(level-1);
function xpProgress(xp=game.xp){let level=1;while(xp>=xpToNext(level)){xp-=xpToNext(level);level++;}return {level,into:xp,need:xpToNext(level)};}
// Money and XP "add up": the game state changes at once, but coins and XP orbs fly to the counters first and the
// numbers roll up as they land. coinsInFlight / xpInFlight hold what is still on its way.
let coinsInFlight=0,xpInFlight=0,shownXp=game.xp,shownLevel=xpProgress().level;const pendingLevelUps=[];
function gainXp(amount,x,y,quiet=false){
  game.xp+=amount;xpInFlight+=amount;
  if(x!==undefined&&y!==undefined){if(!quiet)floatText(x,y,`+${amount} XP`,'xp');flyTo(x,y,$('xp-fill'),'xp-orb','',1,()=>{xpInFlight-=amount;bump($('level-chip'));});}else xpInFlight-=amount;
  const {level}=xpProgress();while(game.level<level){game.level++;const reward=150*game.level;game.coins+=reward;coinsInFlight+=reward;pendingLevelUps.push({level:game.level,reward});}}
function renderXp(){const shown=Math.floor(shownXp),{level,into,need}=xpProgress(shown),fill=Math.min(100,(into+(shownXp-shown))/need*100);
  $('level-num').textContent=level;$('xp-fill').style.width=fill.toFixed(1)+'%';$('xp-text').textContent=`${into} / ${need} XP`;}
// Flying tokens use the Web Animations API on a few small elements, so they cost almost nothing.
function flyTo(x,y,target,className,html,count,onArrive,onEach){
  const to=target.getBoundingClientRect(),tx=target.id==='xp-fill'?to.right:to.left+to.width/2,ty=to.top+to.height/2;let landed=0;
  for(let i=0;i<count;i++){const el=document.createElement('div');el.className='flyer '+className;el.innerHTML=html;floatLayer.appendChild(el);
    const jx=(Math.random()-.5)*70,jy=(Math.random()-.5)*50-20,duration=520+i*55+Math.random()*80;let done=false;
    const land=()=>{if(done)return;done=true;el.remove();landed++;if(className==='coin-flyer'){bump($('coins').closest('.coin-pill'));play('ping',.12,2.2+Math.random()*.4);}onEach?.();if(landed===count)onArrive();};
    el.animate([{transform:`translate(${x}px,${y}px) scale(.4)`,opacity:0},{transform:`translate(${x+jx}px,${y+jy}px) scale(1.15)`,opacity:1,offset:.3},{transform:`translate(${tx}px,${ty}px) scale(.6)`,opacity:.9}],{duration,easing:'cubic-bezier(.45,0,.7,1)',delay:i*35,fill:'backwards'}).onfinish=land;
    setTimeout(land,duration+i*35+400);}}
// Each landing coin releases its share, so the counter climbs coin by coin.
function flyCoins(x,y,amount){const count=Math.max(3,Math.min(10,Math.round(2+Math.log10(Math.max(1,amount))*2))),share=Math.floor(amount/count);let released=0;
  flyTo(x,y,$('coins').closest('.coin-pill').querySelector('.coin-ico'),'coin-flyer',icon('coin'),count,()=>{coinsInFlight-=amount-released;},()=>{released+=share;coinsInFlight-=share;});}
function showLevelUp(level,reward){
  const rect=showNotice('level',`<span class="notice-art">${level}</span><b>LEVEL ${level}!</b><span class="chip gold">+${euro(reward)}</span><span class="chip green">${pct(LEVEL_BOOST)} fares</span>`,2600);
  play('arrival');play('station-open',.6);vibrate([30,50,30,50,60]);setTimeout(()=>flyCoins(...rectCentre(rect),reward),350);save();renderHud();}
function pendingClaims(id){return game.buses.filter(b=>b.status==='idle'&&b.location===id&&b.payout>0);}
const secondsLeft=claims=>Math.max(0,Math.ceil(Math.min(...claims.map(b=>b.claimBy-Date.now()))/1000));
function renderHud(){
  const now=Date.now(),parts=boostParts();lastHudSecond=Math.floor(now/1000);
  $('mult-boost').textContent=`${pct(boost()-1)} fares`;
  $('station-flag').innerHTML=flagMarkup(currentStation,'flag-station');$('station-name').textContent=city[currentStation].name;
  const here=busesHere().length,away=game.open.filter(id=>id!==currentStation).flatMap(pendingClaims);
  $('station-info').innerHTML=away.length?`${icon('bag')} ${secondsLeft(away)}s`:`${here} bus${here===1?'':'es'}`;
  $('station-switch').classList.toggle('alert',away.length>0);
  // The buy buttons say what each purchase is worth.
  const price=busCost(),quick=$('quick-buy-bus');quick.querySelector('small').textContent=euro(price);quick.classList.toggle('can-buy',game.coins>=price);quick.setAttribute('aria-label',`Buy a SouSou Bus for ${euro(price)}: ${pct(BUS_BOOST)} on every fare`);
  $('fleet-sub').textContent=`${game.buses.length} · ${pct(parts.buses)}`;
  const nextStation=STATIONS.find(st=>!game.open.includes(st.id));$('build-sub').textContent=nextStation?`${pct(STATION_BOOST)} · ${shortEuro(nextStation.cost)}`:'All open';$('build-button').classList.toggle('can-buy',!!nextStation&&game.coins>=nextStation.cost);
  // Side arrows show the neighbouring stations and any fares waiting there.
  const prev=neighbour(-1),next=neighbour(1),single=game.open.length<2;
  for(const [el,id,hidden] of [[$('nav-prev'),prev,single||prev===next],[$('nav-next'),next,single]]){
    el.hidden=hidden;if(hidden)continue;const claims=pendingClaims(id);
    el.dataset.station=id;el.classList.toggle('alert',claims.length>0);el.setAttribute('aria-label',`Go to ${city[id].name}`);
    el.innerHTML=`${icon(el.id==='nav-prev'?'left':'right','nav-arrow')}${flagMarkup(id,'nav-flag')}${claims.length?`<span class="nav-claim">${icon('bag')}${secondsLeft(claims)}s</span>`:''}`;}
  const bus=getSelectedBus();
  $('scene-hint').innerHTML=bayBuses().some(b=>b.payout>0)?`${icon('bag')} Tap the gold bus to claim its fares!`
    :!busesHere().length?`${icon('swipe')} No buses here · swipe to another station`
    :!bus?'Tap a bus to choose its country'
    :bus.passengers>=CAPACITY?`${icon('bus')} Bus full · tap it to send it to ${city[bus.dest].name}`
    :`Tap ${flagMarkup(bus.dest,'hint-flag')} fast · catch ${icon('star')}${icon('gift')}${icon('diamond')}${icon('flash')}${icon('heart')}`;}
function openSheet(kind){play('menu-open',.6);sheet=kind;$('modal-backdrop').classList.remove('hidden');renderSheet();}
function closeSheet(){sheet=null;$('modal-backdrop').classList.add('hidden');}
const boostRow=(art,name,detail,value,tone)=>`<div class="boost-row"><span class="boost-art ${tone}">${art}</span><span><b>${name}</b><small>${detail}</small></span><strong class="${tone}">${value}</strong></div>`;
function renderSheet(){
  if(!sheet)return;const eyebrow=$('sheet-eyebrow'),title=$('sheet-title'),content=$('sheet-content'),parts=boostParts();
  if(sheet==='stations'){eyebrow.textContent='SWIPE OR TAP TO TRAVEL';title.textContent='Your stations';
    content.innerHTML=`<div class="sheet-list">${openInOrder().map(id=>{const claims=pendingClaims(id),buses=game.buses.filter(b=>b.status==='idle'&&b.location===id).length;
      return `<button class="sheet-row ${id===currentStation?'selected':''}" data-station="${id}"><span class="sheet-row-icon">${flagMarkup(id,'flag-large')}</span><span><b>${city[id].name}</b><small>${buses} bus${buses===1?'':'es'} parked</small>${claims.length?`<span class="chip gold">${icon('bag')} ${euro(claims.reduce((sum,b)=>sum+b.payout,0))} · ${secondsLeft(claims)}s</span>`:''}</span><span class="sheet-row-end">${id===currentStation?'HERE':'GO'}</span></button>`;}).join('')}</div>`;}
  else if(sheet==='fleet'){eyebrow.textContent='FARE BOOST';title.textContent=`${pct(boost()-1)} on every fare`;
    const parked=game.buses.filter(b=>b.status==='idle').length,trip=game.buses.length-parked,{level}=xpProgress();
    content.innerHTML=`<div class="boost-list">
        ${boostRow(icon('bus'),'Buses',`${game.buses.length} owned · ${pct(BUS_BOOST)} each after 5`,pct(parts.buses),'orange')}
        ${boostRow(icon('pin'),'Stations',`${game.open.length} open · ${pct(STATION_BOOST)} each after 2`,pct(parts.stations),'blue')}
        ${boostRow(icon('crown'),'Level',`Level ${level} · ${pct(LEVEL_BOOST)} per level`,pct(parts.level),'purple')}
      </div>
      <div class="perk-card"><h3>Why buy another bus?</h3>
        <p>${icon('boost')} <span><b>${pct(BUS_BOOST)} on every fare</b>, everywhere, forever.</span></p>
        <p>${icon('bus')} <span><b>Never wait:</b> a bus stays parked and ready while the others travel, so your combo keeps going.</span></p>
        <p>${icon('route')} <span><b>More at once:</b> fill buses for several countries in the same station.</span></p>
        <button id="buy-bus" class="btn green" ${game.coins<busCost()?'disabled':''}>${icon('bus')} Buy bus · ${euro(busCost())}</button></div>
      <div class="fleet-stats"><div><strong>${parked}</strong><span>Parked</span></div><div><strong>${trip}</strong><span>On a trip</span></div><div><strong>${game.bestCombo||0}</strong><span>Best combo</span></div></div>`;}
  else{eyebrow.textContent='GROW YOUR NETWORK';title.textContent='Open a station';const locked=STATIONS.filter(st=>!game.open.includes(st.id));
    content.innerHTML=`<div class="perk-strip"><span class="chip green">${icon('boost')} ${pct(STATION_BOOST)} every fare</span><span class="chip blue">${icon('bus')} +1 free bus</span><span class="chip orange">${icon('route')} Longer routes pay more</span></div>
      <div class="sheet-list">${locked.length?locked.map(st=>{const from=game.open.reduce((a,o)=>distance(o,st.id)>distance(a,st.id)?o:a,game.open[0]),best=Math.round((12+6*distance(from,st.id))*(boost()+STATION_BOOST)),short=Math.max(0,st.cost-game.coins);
        return `<div class="sheet-row station-offer"><span class="sheet-row-icon">${flagMarkup(st.id,'flag-large')}</span><span><b>${st.name}</b><small>${icon('route')} ${city[from].name} → ${st.name}: ${euro(best)} per traveler</small></span><button class="btn ${short?'locked':'green'} build-action" data-build="${st.id}" ${short?'disabled':''}>${short?`${euro(st.cost)}<small>need ${euro(short)}</small>`:euro(st.cost)}</button></div>`;}).join(''):'<p class="sheet-intro">Every station is open. Your network spans the whole map!</p>'}</div>`;}}

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
const coachTemplatePromise=new GLTFLoader().loadAsync('./models/souha-bus.glb').then(gltf=>{const model=gltf.scene;model.scale.set(.325,.25,.25);model.traverse(o=>{if(!o.isMesh)return;o.material=COACH_PARTS[o.material.name]||mats.dark;o.geometry.userData.shared=true;o.castShadow=true;o.receiveShadow=true;});return model;}).catch(error=>{console.warn('SouSou Bus model failed to load; using the built-in coach.',error);return null;});
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
function computeOnScreenSpots(){const v=new THREE.Vector3();return new Set(CROWD_SPOTS.map(([x,z],i)=>{v.set(x,.4,z).project(camera);const sx=v.x*.5+.5,sy=-v.y*.5+.5;return sx>.12&&sx<.88&&sy>.34&&sy<.82&&!(sx>.76&&sy>.68)?i:-1;}).filter(i=>i>=0));}
function buildPerson(traveler){
  const [x,z]=CROWD_SPOTS[traveler.spot],g=new THREE.Group();g.position.set(x,.1,z);g.scale.setScalar(PERSON_SCALE);g.userData.travelerId=traveler.id;crowdGroup.add(g);
  // Shirts show the traveler's country (or their bonus colour), and faded travelers stand slightly smaller.
  put(g,new THREE.CylinderGeometry(.11,.16,.33,6),shirtMats[traveler.special||traveler.dest],0,.3,0);put(g,new THREE.IcosahedronGeometry(.14,0),mats.skin,0,.61,0);put(g,new THREE.IcosahedronGeometry(.145,0),mats.hair,0,.69,-.045);
  for(const xx of [-.075,.075])put(g,new THREE.CylinderGeometry(.035,.04,.18,5),mats.dark,xx,.08,0);
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
  const now=Date.now(),known=new Set(crowd.map(p=>p.id));
  for(const child of [...crowdGroup.children])if(!known.has(child.userData.travelerId)){crowdGroup.remove(child);disposeTree(child);}
  const built=new Set(crowdGroup.children.map(c=>c.userData.travelerId));for(const p of crowd)if(!built.has(p.id))buildPerson(p);
  crowdLabels=crowd.map(p=>({kind:'traveler',id:p.id,object:crowdGroup.children.find(c=>c.userData.travelerId===p.id),anchor:new THREE.Vector3(0,.96,0)}));
  renderLabels();}
// Tags are kept and updated in place (keyed by kind and id), so their pop-in and countdown animations never restart.
const tagElements=new Map();
function busTagMarkup(b,now){
  if(b.payout>0){const left=Math.max(0,b.claimBy-now);return {className:'bus-tag collect'+(left<3500?' hurry':''),label:`Claim ${euro(b.payout)} from ${busName(b)}`,html:`<strong>${icon('bag')} ${euro(b.payout)}</strong><small>TAP TO CLAIM · <span class="claim-left">${Math.ceil(left/1000)}</span>s</small><span class="claim-timer" style="animation-duration:${CLAIM_MS}ms;animation-delay:-${CLAIM_MS-left}ms"></span>`,sig:`pay${b.payout}-${b.claimBy}`};}
  const full=b.passengers>=CAPACITY,dest=b.dest?`${flagMarkup(b.dest,'bus-flag')}<b class="bus-dest">${city[b.dest].name}</b>`:'';
  return {className:`bus-tag${b.id===selectedBus?' selected':''}${full?' full':''}`,label:`${busName(b)} to ${b.dest?city[b.dest].name:'nowhere'}, ${b.passengers} of ${CAPACITY} aboard${full?', tap to send':''}`,
    html:full?`<span class="bus-tag-heading">${dest}</span><strong>${icon('bus')} GO!</strong><small class="bus-fare">${euro(b.revenue)}</small>`:`<span class="bus-tag-heading">${dest}</span><small>${b.passengers}/${CAPACITY}${b.revenue?` · ${euro(b.revenue)}`:''}</small><span class="bus-progress"><i style="width:${b.passengers/CAPACITY*100}%"></i></span>`,
    sig:`${b.dest}-${b.passengers}-${b.revenue}`};}
function renderLabels(){
  const now=Date.now(),selected=getSelectedBus(),tappableDest=canBoard(selected)?selected.dest:null,host=$('scene-labels'),seen=new Set();
  const upsert=(key,attr,id,className,label,html,sig)=>{seen.add(key);let tag=tagElements.get(key);
    if(!tag){const el=document.createElement('button');el.dataset[attr]=id;host.appendChild(el);tag={el,sig:null};tagElements.set(key,tag);}
    if(tag.sig!==sig){tag.el.innerHTML=html;tag.sig=sig;}if(tag.el.className!==className)tag.el.className=className;tag.el.setAttribute('aria-label',label);return tag.el;};
  for(const entry of busLabels){const b=game.buses.find(x=>x.id===entry.id);if(!b)continue;const m=busTagMarkup(b,now);entry.el=upsert('bus'+b.id,'bus',b.id,m.className,m.label,m.html,m.sig);}
  for(const entry of crowdLabels){const p=crowd.find(x=>x.id===entry.id);if(!p)continue;const faded=p.dest!==tappableDest,special=p.special&&SPECIALS[p.special],life=p.until-p.born;
    entry.el=upsert('t'+p.id,'traveler',p.id,`traveler-tag${faded?' faded':''}${special?` special special-${p.special}`:''}`,`${special?special.label+' ':''}traveler to ${city[p.dest].name}${faded?', board a bus to that country first':''}`,
      `${flagMarkup(p.dest)}${special?`<span class="special-glow"></span><span class="special-badge">${icon(special.icon)}</span>`:''}<span class="life-timer" style="animation-duration:${life}ms;animation-delay:-${Math.max(0,now-p.born)}ms"></span>`,'t');}
  for(const [key,tag] of tagElements)if(!seen.has(key)){tag.el.remove();tagElements.delete(key);}
  positionLabels();}
function positionLabels(){
  const r=canvas.getBoundingClientRect();
  for(const entry of [...busLabels,...crowdLabels]){const el=entry.el;if(!entry.object||!el)continue;const p=entry.object.localToWorld(entry.anchor.clone()).project(camera);let x=(p.x*.5+.5)*r.width,y=(-p.y*.5+.5)*r.height;const half=el.offsetWidth/2;x=THREE.MathUtils.clamp(x,half+5,r.width-half-5);y=THREE.MathUtils.clamp(y,el.offsetHeight+8,r.height-5);el.style.left=x+'px';el.style.top=y+'px';}}
function resize(){
  const w=innerWidth,h=innerHeight,aspect=w/h,halfW=aspect<1?4.05:Math.min(8.2,aspect*4.5);renderer.setSize(w,h,false);camera.lookAt(0,.15,h<700?1.25:.7);camera.left=-halfW;camera.right=halfW;camera.top=halfW/aspect;camera.bottom=-halfW/aspect;camera.updateProjectionMatrix();
  onScreenSpots=computeOnScreenSpots();crowd=crowd.filter(p=>onScreenSpots.size<8||onScreenSpots.has(p.spot));renderCrowd();}
addEventListener('resize',resize);

// ---------------------------------------------------------------------------------------------------------------
// Input: tap tags or buses; swipe sideways anywhere to change station.
// ---------------------------------------------------------------------------------------------------------------
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let press=null;
addEventListener('pointerdown',e=>{press=sheet?null:{x:e.clientX,y:e.clientY,t:performance.now()};},{capture:true});
addEventListener('pointerup',e=>{
  if(!press)return;const dx=e.clientX-press.x,dy=e.clientY-press.y,quick=performance.now()-press.t<800;press=null;
  if(quick&&Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5&&game.open.length>1){switchStation(neighbour(dx<0?1:-1),dx<0?1:-1);}},{capture:true});
// Travelers and buses react the moment a finger touches them (tag, body or coach), so quick taps that wobble a little still count.
$('scene-labels').addEventListener('pointerdown',e=>{const traveler=e.target.closest('[data-traveler]'),bus=e.target.closest('[data-bus]');if(traveler){e.preventDefault();tapTraveler(Number(traveler.dataset.traveler));}else if(bus){e.preventDefault();tapBus(Number(bus.dataset.bus));}});
canvas.addEventListener('pointerdown',e=>{const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);for(const hit of raycaster.intersectObjects([...crowdGroup.children,...busGroup.children],true)){let o=hit.object;while(o&&o.userData.travelerId===undefined&&!o.userData.pick)o=o.parent;if(!o)continue;if(o.userData.pick)tapBus(o.userData.pick.id);else tapTraveler(o.userData.travelerId);break;}});

for(const id of ['nav-prev','nav-next'])$(id).addEventListener('click',()=>switchStation($(id).dataset.station,id==='nav-next'?1:-1));
$('station-switch').addEventListener('click',()=>openSheet('stations'));$('fleet-button').addEventListener('click',()=>openSheet('fleet'));$('mult-badge').addEventListener('click',()=>openSheet('fleet'));$('level-chip').addEventListener('click',()=>openSheet('fleet'));$('quick-buy-bus').addEventListener('click',buyBus);$('build-button').addEventListener('click',()=>openSheet('build'));$('close-sheet').addEventListener('click',closeSheet);
$('modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')return closeSheet();const station=e.target.closest('[data-station]'),build=e.target.closest('[data-build]');if(station)switchStation(station.dataset.station);else if(build)buyStation(build.dataset.build);else if(e.target.closest('#buy-bus'))buyBus();});
addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();if(!sheet&&e.key==='ArrowRight')switchStation(neighbour(1),1);if(!sheet&&e.key==='ArrowLeft')switchStation(neighbour(-1),-1);});
function renderSoundButton(){$('sound').innerHTML=icon(sound?'sound-on':'sound-off');$('sound').setAttribute('aria-label',sound?'Mute sound':'Turn sound on');}
$('sound').addEventListener('click',()=>{sound=!sound;localStorage.setItem('souha-sound',sound?'on':'off');renderSoundButton();play('select');});

// ---------------------------------------------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------------------------------------------
let shownCoins=0;
function animate(){
  requestAnimationFrame(animate);const now=performance.now(),clock=Date.now();
  const coinTarget=game.coins-coinsInFlight;if(shownCoins!==coinTarget){const gap=coinTarget-shownCoins;shownCoins+=Math.abs(gap)<2?gap:Math.round(gap*.14)||Math.sign(gap);$('coins').textContent=Math.round(shownCoins).toLocaleString('en-US');}
  const xpTarget=game.xp-xpInFlight;if(Math.abs(xpTarget-shownXp)>.001){const gap=xpTarget-shownXp;shownXp=Math.abs(gap)<.05?xpTarget:shownXp+gap*.12+Math.sign(gap)*.03;renderXp();const level=xpProgress(Math.floor(shownXp)).level;if(level>shownLevel){shownLevel=level;const up=pendingLevelUps.shift();if(up)showLevelUp(up.level,up.reward);}}
  if(combo.count&&clock-combo.last>COMBO_MS&&clock>combo.frozenUntil)endCombo();renderCombo(clock);
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
  for(const el of document.querySelectorAll('.claim-left')){const bus=game.buses.find(b=>b.id===Number(el.closest('[data-bus]').dataset.bus));if(bus){const s=Math.max(0,Math.ceil((bus.claimBy-clock)/1000));if(el.textContent!==String(s))el.textContent=s;el.closest('.bus-tag').classList.toggle('hurry',bus.claimBy-clock<3500);}}
  positionLabels();renderer.render(scene,camera);}

coachTemplate=await coachTemplatePromise;
renderSoundButton();renderXp();buildStatic();resize();syncSelectedBus();for(let i=0;i<6;i++)spawnTraveler(Date.now());renderBuses();renderCrowd();renderHud();animate();setInterval(tick,90);
