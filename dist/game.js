import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

const STATIONS = [
  {id:'tunis',name:'Tunis',country:'Tunisia',code:'TN',cost:0,accent:0xf7a86a},
  {id:'paris',name:'Paris',country:'France',code:'FR',cost:0,accent:0xa5c9ed},
  {id:'rome',name:'Rome',country:'Italy',code:'IT',cost:1200,accent:0xeec99b},
  {id:'barcelona',name:'Barcelona',country:'Spain',code:'ES',cost:2200,accent:0xf5bca2},
  {id:'berlin',name:'Berlin',country:'Germany',code:'DE',cost:3500,accent:0xbbc9da},
  {id:'istanbul',name:'Istanbul',country:'Türkiye',code:'TR',cost:5000,accent:0xcbb2d6}
];
const city = Object.fromEntries(STATIONS.map(s=>[s.id,s]));
const $ = id=>document.getElementById(id);
const flagMarkup=(id,className='flag-icon')=>`<img class="${className}" src="./flags/${city[id].code.toLowerCase()}.svg" alt="" aria-hidden="true">`;
const PERSON_SCALE=.58,CAPACITY=10, START_QUEUE=30, TARGET_QUEUE=30, MAX_WAITING=50, SAVE_KEY='souha-bus-station-stories-v1';
const BAYS=[{x:-2.15,z:-2},{x:0,z:0},{x:2.15,z:2}],LANE_EDGES=[-3.1,-1.02,1.02,3.1];
// Where the raised walkway stops behind bay i (just past the rear of a parked coach).
const platformEdge=i=>BAYS[i].x-1.98;
const euro=n=>'€'+Math.floor(n).toLocaleString('en-US');
let currentStation='tunis',selectedBus=1,sheet=null,sound=localStorage.getItem('souha-sound')!=='off';
let game;const recentBoardings=[];

function newPassenger(origin,dest,id){return {id,origin,dest};}
// Travelers only ride between unlocked stations.
function destinationsFrom(origin){return game.open.filter(id=>id!==origin);}
// While a bus is filling here, a third of arrivals want its destination so it can be filled quickly.
function randomDestination(origin){const choices=destinationsFrom(origin),filling=origin===currentStation?getSelectedBus()?.destination:null;if(filling&&Math.random()<.33)return filling;return choices[Math.floor(Math.random()*choices.length)];}
// Each bus beyond the starting five costs 18% more than the last.
function busCost(){return Math.round(400*1.18**Math.max(0,game.buses.length-5)/10)*10;}
function freshGame(){const passengers=[],buses=[];let nextPassenger=1;for(const [origin,count] of [['tunis',START_QUEUE],['paris',START_QUEUE]]){for(let i=0;i<count;i++)passengers.push(newPassenger(origin,origin==='tunis'?'paris':'tunis',nextPassenger++));}for(let id=1;id<=5;id++)buses.push({id,location:id<=3?'tunis':'paris',status:'idle',passengers:0,destination:null,origin:null,departed:0,arrival:0,fare:0,revenue:0});return {version:1,coins:360,moved:0,satisfaction:100,lastSatisfactionTick:Date.now(),mixedDestinations:true,capacity20Ready:true,routeLockReady:true,economyV2:true,openDestinations:true,open:['tunis','paris'],buses,passengers,nextPassenger,nextBus:6,lastSpawn:Date.now()};}
function load(){try{const data=JSON.parse(localStorage.getItem(SAVE_KEY));if(data?.version===1&&Array.isArray(data.buses)&&Array.isArray(data.passengers)&&Array.isArray(data.open))return data;}catch{}return freshGame();}
game=load();
function enforceQueueLimit(){const counts={};game.passengers=game.passengers.filter(passenger=>{const count=counts[passenger.origin]||0;if(count>=MAX_WAITING)return false;counts[passenger.origin]=count+1;return true;});}
enforceQueueLimit();
if(!game.mixedDestinations){for(const passenger of game.passengers){const choices=destinationsFrom(passenger.origin);passenger.dest=choices[(passenger.id*2+1)%choices.length];}game.mixedDestinations=true;}
if(!game.capacity20Ready){for(const origin of game.open){let count=game.passengers.filter(p=>p.origin===origin).length;const choices=destinationsFrom(origin);while(count<100){game.passengers.push(newPassenger(origin,choices[count%choices.length],game.nextPassenger++));count++;}}game.capacity20Ready=true;save();}
if(!Number.isFinite(game.satisfaction))game.satisfaction=100;
if(!Number.isFinite(game.lastSatisfactionTick))game.lastSatisfactionTick=Date.now();
for(const bus of game.buses){if(!Number.isFinite(bus.revenue))bus.revenue=bus.destination?ticketPrice(bus.origin||bus.location,bus.destination)*bus.passengers:0;if(!Array.isArray(bus.destinations))bus.destinations=bus.destination?Array(bus.passengers).fill(bus.destination):[];}
if(!game.routeLockReady){for(const bus of game.buses){if(bus.status!=='idle'||!bus.passengers)continue;const destination=bus.destinations[0]||bus.destination;bus.destination=destination;bus.destinations=Array(bus.passengers).fill(destination);bus.multiStop=false;bus.routeStops=[];}game.routeLockReady=true;save();}
if(!game.economyV2){const kept={};game.passengers=game.passengers.filter(p=>(kept[p.origin]=(kept[p.origin]||0)+1)<=START_QUEUE);game.satisfaction=100;game.lastSatisfactionTick=game.lastSpawn=Date.now();game.economyV2=true;save();}
if(!game.openDestinations){for(const p of game.passengers)if(!game.open.includes(p.dest))p.dest=randomDestination(p.origin);game.openDestinations=true;save();}
// Coaches now carry 10: trim any bus that was loaded beyond that under the old 20-seat rule.
for(const bus of game.buses)if(bus.status==='idle'&&bus.passengers>CAPACITY){bus.revenue=Math.round(bus.revenue*CAPACITY/bus.passengers);bus.passengers=CAPACITY;bus.destinations=bus.destinations.slice(0,CAPACITY);}
function save(){localStorage.setItem(SAVE_KEY,JSON.stringify(game));}
function availableBuses(){return game.buses.filter(b=>b.status==='idle'&&b.location===currentStation).sort((a,b)=>(a.readyAt||0)-(b.readyAt||0)||a.id-b.id);}
function bayBuses(){const buses=availableBuses(),occupied=new Set();for(const bus of buses){if(!Number.isInteger(bus.bay)||bus.bay<0||bus.bay>=BAYS.length||occupied.has(bus.bay))bus.bay=null;else occupied.add(bus.bay);}for(const bus of buses){if(bus.bay!==null)continue;const free=BAYS.findIndex((_,i)=>!occupied.has(i));if(free<0)break;bus.bay=free;occupied.add(free);}return buses.filter(bus=>bus.bay!==null).sort((a,b)=>a.bay-b.bay);}
function getSelectedBus(){return game.buses.find(b=>b.id===selectedBus&&b.status==='idle'&&b.location===currentStation);}
function syncSelectedBus(){const visible=bayBuses();if(!visible.some(bus=>bus.id===selectedBus))selectedBus=visible[0]?.id??null;}
function stationQueue(id){return game.passengers.filter(p=>p.origin===id).length;}
function ticketPrice(origin,dest){const a=STATIONS.findIndex(s=>s.id===origin),b=STATIONS.findIndex(s=>s.id===dest);return 15+Math.abs(a-b)*5;}
function tripTime(origin,dest){const a=STATIONS.findIndex(s=>s.id===origin),b=STATIONS.findIndex(s=>s.id===dest);return (8+Math.abs(a-b)*2)*1000;}
// Sound effects: CC0 samples from Kenney.nl and OpenGameArt (see sounds/CREDITS.txt), played through one shared Web Audio context.
// Phones only allow audio after a tap, so the context is created/resumed on the first touch, click or key press.
const SOUND_NAMES=['board','bus-full','select','depart','coins','buy','station-open','switch','error','menu-open','arrival'];
const soundFiles=Object.fromEntries(SOUND_NAMES.map(name=>[name,fetch(`./sounds/${name}.mp3`).then(r=>r.arrayBuffer()).catch(()=>null)]));
let audioCtx=null;const soundBuffers={};
function unlockAudio(){if(audioCtx){if(audioCtx.state!=='running')audioCtx.resume().catch(()=>{});return;}const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return;try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}audioCtx=new AudioCtx();audioCtx.resume().catch(()=>{});for(const name of SOUND_NAMES)soundFiles[name].then(data=>data&&audioCtx.decodeAudioData(data)).then(buffer=>{if(buffer)soundBuffers[name]=buffer;}).catch(()=>{});}
for(const type of ['pointerdown','touchend','click','keydown'])addEventListener(type,unlockAudio,{capture:true});
function play(name,volume=1,rate=1){if(!sound||!audioCtx||!soundBuffers[name])return;if(audioCtx.state!=='running')audioCtx.resume().catch(()=>{});const source=audioCtx.createBufferSource(),gain=audioCtx.createGain();source.buffer=soundBuffers[name];source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain).connect(audioCtx.destination);source.start();}
// The boarding pop rises in pitch as the coach fills, then a chime when it is full.
function boardingSound(aboard){play('board',.9,.85+aboard/CAPACITY*.5);if(aboard>=CAPACITY)play('bus-full',.8);}
function toast(message,error=false){if(error)play('error',.7);const node=document.createElement('div');node.className='toast'+(error?' error':'');node.textContent=message;$('toast-stack').appendChild(node);setTimeout(()=>node.remove(),2700);}

function boardPassenger(id){const bus=getSelectedBus(),passenger=game.passengers.find(p=>p.id===id&&p.origin===currentStation);if(!passenger)return;if(!bus)return toast('This station needs a bus. Send one here from another station.',true);if(entryEffects.some(e=>e.id===bus.id))return toast('The next coach is pulling into the bay!');if(bus.passengers>=CAPACITY)return toast('This bus is full! Tap it to start the trip.');if(bus.destination&&bus.destination!==passenger.dest)return toast(`Tap the ${city[bus.destination].name} flag for this bus.`,true);const fare=Math.floor(ticketPrice(currentStation,passenger.dest)*Math.floor(game.satisfaction)/100);game.satisfaction=Math.min(100,game.satisfaction+1.2);launchBoardingAnimation(id,bus.id);recentBoardings.push(Date.now());if(recentBoardings.length>60)recentBoardings.shift();bus.destination=passenger.dest;bus.destinations.push(passenger.dest);bus.passengers++;bus.revenue+=fare;game.passengers=game.passengers.filter(p=>p.id!==id);save();renderDynamic();renderHUD();boardingSound(bus.passengers);}
function tapBus(id){const bus=bayBuses().find(b=>b.id===id);if(!bus)return;if(entryEffects.some(e=>e.id===id))return toast('The coach is pulling into the bay!');if(bus.passengers===CAPACITY)return departBus(bus);selectedBus=id;renderDynamic();renderHUD();play('select');}
function departBus(bus){if(bus.passengers<CAPACITY)return toast('Fill the bus before starting the trip.',true);const vacatedBay=bus.bay,stops=[...new Set(bus.destinations)];launchVisualDeparture(bus.id);bus.origin=bus.location;bus.destination=stops[stops.length-1];bus.routeStops=stops;bus.multiStop=stops.length>1;bus.departed=Date.now();bus.arrival=bus.departed+Math.max(...stops.map(stop=>tripTime(bus.origin,stop)))+(stops.length-1)*1000;bus.status='trip';bus.bay=null;const replacement=bayBuses().find(b=>b.bay===vacatedBay);pendingMoves=replacement?{[replacement.id]:true}:null;if(selectedBus===bus.id)selectedBus=replacement?.id??null;save();renderDynamic();renderHUD();toast(bus.multiStop?`Bus #${String(bus.id).padStart(2,'0')} is off to ${stops.length} countries!`:`Bus #${String(bus.id).padStart(2,'0')} is off to ${city[bus.destination].name}!`);play('depart',.9);}
function arriveAt(bus,now){if(bus.location===currentStation){(pendingMoves??={})[bus.id]=true;play('arrival',.9);}bus.status='idle';bus.readyAt=now;bus.origin=null;bus.destination=null;bus.destinations=[];bus.routeStops=[];bus.multiStop=false;bus.passengers=0;bus.departed=0;bus.arrival=0;bus.fare=0;bus.revenue=0;}
// Keeps every station supplied: when a station has two or more fewer buses (parked + on their way) than another,
// the coach that has waited longest at the busiest station drives over empty. Buses parked in view at your current station are never taken.
function rebalanceFleet(now){
  const supply=id=>game.buses.filter(b=>b.status==='idle'&&b.location===id||b.status==='transfer'&&b.destination===id).length;let moved=false;
  for(const target of [...game.open].sort((a,b)=>supply(a)-supply(b))){
    if(supply(target)>=BAYS.length)continue;
    const donor=game.open.filter(id=>id!==target&&supply(id)-supply(target)>=2).sort((a,b)=>supply(b)-supply(a))[0];if(!donor)continue;
    const inView=new Set(donor===currentStation?bayBuses().map(b=>b.id):[]),bus=game.buses.filter(b=>b.status==='idle'&&b.location===donor&&!b.passengers&&!inView.has(b.id)).sort((a,b)=>(a.readyAt||0)-(b.readyAt||0))[0];if(!bus)continue;
    Object.assign(bus,{status:'transfer',origin:donor,destination:target,departed:now,arrival:now+tripTime(donor,target),bay:null});moved=true;
    if(target===currentStation)toast(`Bus #${String(bus.id).padStart(2,'0')} is on its way from ${city[donor].name}!`);}
  return moved;}
function tick(){let changed=false;const now=Date.now(),elapsed=Math.max(0,Math.min(60,(now-game.lastSatisfactionTick)/1000));if(elapsed>=5){
    // Satisfaction only drops when platforms are nearly full (over 80%), and recovers while they stay below 70%.
    const crowding=game.passengers.length/(MAX_WAITING*game.open.length),change=crowding>.8?-(crowding-.8)*3:crowding<.7?.3:0;
    if(change){game.satisfaction=THREE.MathUtils.clamp(game.satisfaction+change*elapsed,40,100);changed=true;}game.lastSatisfactionTick=now;}for(const bus of game.buses){
    // A coach parks at the station it delivered to and serves it next (it only drives home if that station is locked).
    if(bus.status==='trip'&&now>=bus.arrival){const earnings=bus.revenue,destination=bus.destination,multi=bus.multiStop;game.coins+=earnings;game.moved+=bus.passengers;bus.location=game.open.includes(destination)?destination:bus.origin;arriveAt(bus,now);changed=true;toast(multi?`Bus #${String(bus.id).padStart(2,'0')} completed its stops! +${euro(earnings)}`:`Bus #${String(bus.id).padStart(2,'0')} arrived in ${city[destination].name}! +${euro(earnings)}`);play('coins');}
    else if(bus.status==='transfer'&&now>=bus.arrival){const from=bus.origin;bus.location=bus.destination;arriveAt(bus,now);changed=true;if(bus.location===currentStation)toast(`Bus #${String(bus.id).padStart(2,'0')} arrived from ${city[from].name} to help!`);}}
  if(rebalanceFleet(now))changed=true;
  // Arrivals keep pace with the player: a refill when the platform drops below TARGET_QUEUE, one new traveler for every one boarded
  // at this station (over the last 10 s), and a slow trickle so an ignored station fills up over a few minutes.
  const dt=Math.min(30,Math.max(0,(now-game.lastSpawn)/1000)),boardRate=recentBoardings.filter(t=>now-t<10000).length/10;game.lastSpawn=now;game.spawnCarry??={};
  for(const origin of game.open){const queued=stationQueue(origin);if(queued>=MAX_WAITING)continue;const rate=Math.max(0,TARGET_QUEUE-queued)*.1+.15*(1-queued/MAX_WAITING)+(origin===currentStation?boardRate:0);let carry=(game.spawnCarry[origin]||0)+rate*dt;const count=Math.min(Math.floor(carry),MAX_WAITING-queued);carry-=Math.floor(carry);game.spawnCarry[origin]=carry;for(let i=0;i<count;i++)game.passengers.push(newPassenger(origin,randomDestination(origin),game.nextPassenger++));if(count)changed=true;}
  if(changed){save();if(!entryEffects.length)renderDynamic();renderHUD();if(sheet)renderSheet();}else if(sheet==='fleet')renderSheet();}
function switchStation(id){if(!game.open.includes(id))return;clearBoardingAnimations();currentStation=id;syncSelectedBus();closeSheet();buildStatic();renderDynamic();renderHUD();play('switch',.7);}
function buyStation(id){const target=city[id];if(!target||game.open.includes(id))return;if(game.coins<target.cost)return toast(`Earn ${euro(target.cost-game.coins)} more to open ${target.name}.`,true);game.coins-=target.cost;game.open.push(id);for(let i=0;i<START_QUEUE;i++)game.passengers.push(newPassenger(id,randomDestination(id),game.nextPassenger++));for(const origin of game.open.filter(x=>x!==id)){const arrivals=[],options=destinationsFrom(origin);for(let i=0;i<(origin===currentStation?6:2);i++)arrivals.push(newPassenger(origin,options[(i+options.indexOf(id))%options.length],game.nextPassenger++));if(origin===currentStation)game.passengers.unshift(...arrivals);else game.passengers.push(...arrivals);}enforceQueueLimit();save();toast(`${target.name} station is open!`);switchStation(id);play('station-open');}
function buyBus(){if(game.coins<busCost())return toast(`Earn ${euro(busCost()-game.coins)} more for a bus.`,true);game.coins-=busCost();const id=game.nextBus++;game.buses.push({id,location:currentStation,status:'idle',passengers:0,destination:null,destinations:[],origin:null,departed:0,arrival:0,fare:0,revenue:0,readyAt:Date.now()});save();closeSheet();renderDynamic();renderHUD();toast(`New Souha Bus #${String(id).padStart(2,'0')} joined the queue at ${city[currentStation].name}!`);play('buy');}

function renderHUD(){syncSelectedBus();const farePercent=Math.floor(game.satisfaction),waiting=stationQueue(currentStation);$('coins').textContent=game.coins.toLocaleString('en-US');$('moved').textContent=farePercent+'%';$('fare-indicator').textContent=`Ticket price: ${farePercent}%`;$('satisfaction-hud').setAttribute('aria-label',`${farePercent}% satisfaction means each passenger pays ${farePercent}% of the full ticket price.`);$('satisfaction-hud').className='progress-hud'+(game.satisfaction<60?' low':game.satisfaction<80?' medium':'');$('station-flag').innerHTML=flagMarkup(currentStation,'flag-station');$('station-queue').textContent=`${waiting} / ${MAX_WAITING} WAITING`;$('station-name').textContent=city[currentStation].name+' Station';const price=busCost();$('quick-buy-bus').querySelector('small').textContent=euro(price);$('quick-buy-bus').setAttribute('aria-label',`Buy a Souha Bus for ${euro(price)} at this station`);const bus=getSelectedBus();$('scene-hint').textContent=!bus?'Choose a station with a bus to start boarding':bus.passengers===CAPACITY?'Bus is full! Tap GO to depart':bus.destination?`Tap ${city[bus.destination].name} flags · ${bus.passengers}/${CAPACITY}`:bayBuses().length>1?'Tap a bus to choose a lane, then board travelers':`${waiting} waiting · Tap a traveler to board`;}
function openSheet(kind){play('menu-open',.6);sheet=kind;$('modal-backdrop').classList.remove('hidden');renderSheet();}
function closeSheet(){sheet=null;$('modal-backdrop').classList.add('hidden');}
function renderSheet(){if(!sheet)return;const eyebrow=$('sheet-eyebrow'),title=$('sheet-title'),content=$('sheet-content');if(sheet==='stations'){eyebrow.textContent='HOP BETWEEN TERMINALS';title.textContent='Your stations';content.innerHTML=`<p class="sheet-intro">Visit another station to board its waiting travelers.</p><div class="sheet-list">${game.open.map(id=>`<button class="sheet-row ${id===currentStation?'selected':''}" data-station="${id}"><span class="sheet-row-icon">${flagMarkup(id,'flag-large')}</span><span><b>${city[id].name}</b><small>${city[id].country} · ${stationQueue(id)} waiting</small></span><span class="sheet-row-end">${id===currentStation?'HERE':'VISIT →'}</span></button>`).join('')}</div><div class="sheet-note">Travelers keep arriving while you play.</div>`;}
  else if(sheet==='fleet'){eyebrow.textContent='YOUR ORANGE FLEET';title.textContent=`${game.buses.length} Souha Buses`;const available=game.buses.filter(bus=>bus.status==='idle').length,onTrip=game.buses.length-available;content.innerHTML=`<p class="sheet-intro">Select buses in the station scene and tap GO when one is full.</p><div class="fleet-stats"><div><strong>${available}</strong><span>Available</span></div><div><strong>${onTrip}</strong><span>On trip</span></div></div><div class="buy-section"><h3>Add a bus at ${city[currentStation].name}</h3><p>A new bus starts here with room for ${CAPACITY} passengers.</p><button id="buy-bus" ${game.coins<busCost()?'disabled':''}>Buy Souha Bus · ${euro(busCost())}</button></div>`;}
  else{eyebrow.textContent='MORE PLACES TO EXPLORE';title.textContent='Open a station';const locked=STATIONS.filter(s=>!game.open.includes(s.id));content.innerHTML=`<p class="sheet-intro">Open a station to board travelers there. Coaches park at the station they deliver to, and empty coaches move over to stations that run short.</p><div class="sheet-list">${locked.length?locked.map(s=>`<div class="sheet-row"><span class="sheet-row-icon">${flagMarkup(s.id,'flag-large')}</span><span><b>${s.name}</b><small>${s.country}</small></span><button class="sheet-row-end build-action" data-build="${s.id}" ${game.coins<s.cost?'disabled':''}>${euro(s.cost)} ＋</button></div>`).join(''):'<p class="sheet-intro">Every station is open. Your network spans the whole world!</p>'}</div><div class="sheet-note">Earn fares when full buses finish their trips.</div>`;}}

// A small low-poly station fills the screen. The scene changes when the player changes stations.
const scene=new THREE.Scene();scene.background=new THREE.Color(0xbbe3e5);scene.fog=new THREE.Fog(0xbbe3e5,16,34);
const canvas=$('scene'),renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.4;
const camera=new THREE.OrthographicCamera(-4,4,5,-5,.1,70);camera.position.set(2.8,8.4,10);camera.lookAt(0,.15,.7);
scene.add(new THREE.HemisphereLight(0xffffff,0x93bfa3,2.1));const sunlight=new THREE.DirectionalLight(0xfff0cc,2.2);sunlight.position.set(-4,11,6);sunlight.castShadow=true;sunlight.shadow.mapSize.set(1024,1024);sunlight.shadow.camera.left=-9;sunlight.shadow.camera.right=9;sunlight.shadow.camera.top=9;sunlight.shadow.camera.bottom=-9;sunlight.shadow.normalBias=.025;scene.add(sunlight);
const staticGroup=new THREE.Group(),dynamicGroup=new THREE.Group(),departureEffects=[],entryEffects=[],smokeEffects=[],boardingEffects=[];let pendingMoves=null;scene.add(staticGroup,dynamicGroup);
const material=(color,more={})=>new THREE.MeshLambertMaterial({color,flatShading:true,...more});
const mats={grass:material(0x9bd49e),grass2:material(0xb7dca5),platform:material(0xf7eacb),tile:material(0xfff4df),road:material(0x80a9a6),stripe:material(0xfff5dc),orange:material(0xf7863e),orangeDark:material(0xdd6d2c),cream:material(0xfffaf0),glass:material(0x6fb7bc),coachGlass:material(0x2b5962,{side:THREE.DoubleSide}),glassShine:material(0x83aeb4,{side:THREE.DoubleSide}),dark:material(0x405b5e),trim:material(0x2f3d40),wheel:material(0x344347),wheelHub:material(0xdfd8c4),trunk:material(0x997c56),leaf:material(0x71b885),leaf2:material(0x84c99a),skin:material(0xf3c29f),hair:material(0x624d3c)};
function put(group,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function box(group,w,h,d,mat,x,y,z){return put(group,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
function clear(group){for(const child of [...group.children]){group.remove(child);child.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.material&&!Object.values(mats).includes(o.material)&&!Array.isArray(o.material))o.material.dispose();});}}
function busModel(id){return dynamicGroup.children.find(child=>child.userData.pick?.kind==='bus'&&child.userData.pick.id===id)||departureEffects.find(effect=>effect.model.userData.pick?.id===id)?.model;}
function disposeBoardingEffect(effect){scene.remove(effect.model);effect.model.traverse(child=>{if(child.geometry)child.geometry.dispose();if(child.material)child.material.dispose();});}
function clearBoardingAnimations(){for(const effect of boardingEffects)disposeBoardingEffect(effect);boardingEffects.length=0;}
function launchBoardingAnimation(passengerId,busId){const model=dynamicGroup.children.find(child=>child.userData.passengerId===passengerId),bus=busModel(busId);if(!model||!bus)return;dynamicGroup.remove(model);scene.add(model);const materials=[];model.traverse(child=>{if(!child.isMesh)return;child.material=child.material.clone();child.material.transparent=true;child.material.depthWrite=false;materials.push({material:child.material,opacity:child.material.opacity});});boardingEffects.push({model,busId,from:model.position.clone(),to:bus.localToWorld(new THREE.Vector3(-.58,.55,1.18).multiplyScalar(coachSize())),materials,started:performance.now()});}
function launchVisualDeparture(id){const model=dynamicGroup.children.find(child=>child.userData.pick?.kind==='bus'&&child.userData.pick.id===id);if(!model)return;for(const child of [...model.children])if(child.userData.selectionPad){model.remove(child);child.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}dynamicGroup.remove(model);scene.add(model);departureEffects.push({model,started:performance.now(),x:model.position.x,lastSmoke:0});}
function emitSmoke(model,now){for(let i=0;i<3;i++){const p=model.localToWorld(new THREE.Vector3((i-1)*.35,.3,-1.68).multiplyScalar(coachSize()));const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(.17+Math.random()*.07,0),new THREE.MeshBasicMaterial({color:0xe5e9df,transparent:true,opacity:.72,depthWrite:false}));puff.position.copy(p);scene.add(puff);smokeEffects.push({puff,started:now,vx:(Math.random()-.5)*.5});}}
function tree(group,x,z,s=1){put(group,new THREE.CylinderGeometry(.1*s,.15*s,.78*s,6),mats.trunk,x,.4*s,z);put(group,new THREE.IcosahedronGeometry(.58*s,0),Math.random()>.5?mats.leaf:mats.leaf2,x,1.18*s,z);}
function textTexture(text,color='#416358',background='#fff6e5'){const el=document.createElement('canvas');el.width=768;el.height=140;const cx=el.getContext('2d');cx.fillStyle=background;cx.fillRect(0,0,768,140);cx.fillStyle=color;cx.textAlign='center';cx.textBaseline='middle';cx.font='bold 76px Arial';cx.fillText(text,384,75);const texture=new THREE.CanvasTexture(el);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
function buildStatic(){
  clear(staticGroup);scene.background=new THREE.Color(currentStation==='paris'?0xc6e6ed:0xbbe3e5);
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
}
const busTexture=textTexture('Souha Bus','#bd5a28','#fff9e9');
function sideBrandTexture(){const el=document.createElement('canvas');el.width=768;el.height=160;const ctx=el.getContext('2d');ctx.clearRect(0,0,768,160);ctx.fillStyle='#fff8e9';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 112px Arial';ctx.lineJoin='round';ctx.lineWidth=14;ctx.strokeStyle='#b4521f';ctx.strokeText('Souha Bus',384,83);ctx.fillText('Souha Bus',384,83);const texture=new THREE.CanvasTexture(el);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
const sideBrand=sideBrandTexture();
// Low-poly Irizar i6 coach: flat-colour parts are named in the GLB and mapped to the game palette.
const COACH_PARTS={Body:mats.orange,Trim:mats.trim,Chrome:mats.wheelHub,Glass:mats.coachGlass,Lights:mats.cream,Tire:mats.wheel,Rim:mats.wheelHub};
let coachTemplate=null;
const coachTemplatePromise=new GLTFLoader().loadAsync('./models/souha-bus.glb').then(gltf=>{const model=gltf.scene;model.scale.set(.325,.25,.25);model.traverse(o=>{if(!o.isMesh)return;o.material=COACH_PARTS[o.material.name]||mats.dark;o.geometry.userData.shared=true;o.castShadow=true;o.receiveShadow=true;});return model;}).catch(error=>{console.warn('Souha Bus model failed to load; using the built-in coach.',error);return null;});
// Positions tied to the bus (boarding target, smoke, label) use coachSize() so the coach can be resized in one place.
const COACH_SIZE=1;
function coachSize(){return coachTemplate?COACH_SIZE:1;}
function addModelCoach(parent){
  const g=new THREE.Group();g.scale.setScalar(COACH_SIZE);parent.add(g);
  g.add(coachTemplate.clone());
  for(const side of [-1,1]){const brand=put(g,new THREE.PlaneGeometry(1.75,.29),new THREE.MeshBasicMaterial({map:sideBrand,transparent:true,side:THREE.DoubleSide,depthWrite:false}),side*.475,.42,-.05);brand.rotation.y=side*Math.PI/2;brand.castShadow=false;}
  const frontBrand=put(g,new THREE.PlaneGeometry(.5,.1),new THREE.MeshBasicMaterial({map:busTexture,side:THREE.DoubleSide}),0,.22,1.715);frontBrand.castShadow=false;
}
function coachPanel(group,points,mat){const geometry=new THREE.BufferGeometry(),vertices=[...points[0],...points[1],...points[2],...points[0],...points[2],...points[3]];geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return put(group,geometry,mat);}
function buildBus(bus,x,z){
  const g=new THREE.Group();g.position.set(x,.09,z);g.rotation.y=Math.PI/2;g.userData.pick={kind:'bus',id:bus.id};dynamicGroup.add(g);
  if(coachTemplate)addModelCoach(g);else addBuiltInCoach(g);
  if(bus.id===selectedBus)addSelectionPad(g);
  const hit=put(g,new THREE.BoxGeometry(1.38*coachSize(),1.45*coachSize(),3.55*coachSize()),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),0,.7*coachSize(),0);hit.castShadow=false;hit.receiveShadow=false;
  return g;
}
// The selected bus sits on a glowing green rounded rectangle: a soft fill plus a bright outline that gently pulses (see animate).
function roundedRect(path,w,h,r){const x=-w/2,y=-h/2;path.moveTo(x+r,y);path.lineTo(x+w-r,y);path.quadraticCurveTo(x+w,y,x+w,y+r);path.lineTo(x+w,y+h-r);path.quadraticCurveTo(x+w,y+h,x+w-r,y+h);path.lineTo(x+r,y+h);path.quadraticCurveTo(x,y+h,x,y+h-r);path.lineTo(x,y+r);path.quadraticCurveTo(x,y,x+r,y);return path;}
// points are [x,z,round?]; rounded corners are cut back by r and joined with a curve.
function roundedPolygon(points,r){const shape=new THREE.Shape();points.forEach(([x,y,round],i)=>{if(!round){i?shape.lineTo(x,y):shape.moveTo(x,y);return;}const [px,py]=points[(i+points.length-1)%points.length],[nx,ny]=points[(i+1)%points.length],a=Math.hypot(px-x,py-y),b=Math.hypot(nx-x,ny-y);shape.lineTo(x+(px-x)/a*r,y+(py-y)/a*r);shape.quadraticCurveTo(x,y,x+(nx-x)/b*r,y+(ny-y)/b*r);});shape.closePath();return shape;}
let selectionPad=null;
function addSelectionPad(g){
  const k=coachSize(),w=1.46*k,h=3.95*k,border=.12,pad=new THREE.Group();pad.position.y=.012;g.add(pad);
  const outline=roundedRect(new THREE.Shape(),w,h,.26);outline.holes.push(roundedRect(new THREE.Path(),w-border*2,h-border*2,.26-border));
  const fill=new THREE.Mesh(new THREE.ShapeGeometry(roundedRect(new THREE.Shape(),w-border*2,h-border*2,.26-border)).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x6fdc9c,transparent:true,opacity:.32,depthWrite:false}));
  const line=new THREE.Mesh(new THREE.ShapeGeometry(outline).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0x22b866}));
  for(const mesh of [fill,line]){mesh.renderOrder=1;pad.add(mesh);}
  pad.userData.selectionPad=true;pad.userData.fill=fill.material;selectionPad=pad;
}
function addBuiltInCoach(g){
  // The long side profile and angled nose follow a modern touring coach.
  box(g,1.01,.19,3.02,mats.dark,0,.25,-.01);
  const profile=new THREE.Shape();profile.moveTo(-1.53,.26);profile.lineTo(1.37,.26);profile.lineTo(1.58,.4);profile.lineTo(1.65,.61);profile.lineTo(1.5,1.12);profile.lineTo(1.29,1.24);profile.lineTo(-1.43,1.24);profile.lineTo(-1.55,1.1);profile.closePath();
  const body=new THREE.ExtrudeGeometry(profile,{depth:1.08,bevelEnabled:false});body.rotateY(-Math.PI/2);body.translate(.54,0,0);put(g,body,mats.orange);
  box(g,.99,.07,2.74,mats.orangeDark,0,1.25,-.08);
  coachPanel(g,[[-.46,1.15,1.51],[.46,1.15,1.51],[.47,.65,1.64],[-.47,.65,1.64]],mats.coachGlass);
  coachPanel(g,[[-.39,1.11,1.522],[.12,1.11,1.522],[.12,1.08,1.535],[-.39,1.08,1.535]],mats.glassShine);
  box(g,.9,.09,.07,mats.orangeDark,0,.61,1.65);
  box(g,.95,.075,.08,mats.cream,0,.37,1.65);
  for(const side of [-1,1]){
    const xx=side*.555;
    box(g,.014,.4,2.55,mats.coachGlass,xx,.97,-.16);
    coachPanel(g,[[xx,.77,1.1],[xx,1.17,1.1],[xx,1.12,1.46],[xx,.67,1.58]],mats.coachGlass);
    for(const zz of [-.75,.28])box(g,.018,.39,.025,mats.orangeDark,xx+side*.012,.97,zz);
    box(g,.025,.025,2.75,mats.cream,xx+side*.008,.75,-.05);
    box(g,.025,.015,2.68,mats.orangeDark,xx+side*.008,.32,-.04);
    for(const zz of [-.55,.32])box(g,.026,.22,.016,mats.orangeDark,xx+side*.01,.49,zz);
    const brand=put(g,new THREE.PlaneGeometry(1.7,.27),new THREE.MeshBasicMaterial({map:sideBrand,transparent:true,side:THREE.DoubleSide,depthWrite:false}),side*.575,.55,-.29);
    brand.rotation.y=side*Math.PI/2;brand.castShadow=false;
    for(const zz of [-1.08,.9]){
      const wheel=put(g,new THREE.CylinderGeometry(.22,.22,.09,14),mats.wheel,side*.6,.22,zz);wheel.rotation.z=Math.PI/2;
      const hub=put(g,new THREE.CylinderGeometry(.09,.09,.095,14),mats.wheelHub,side*.6,.22,zz);hub.rotation.z=Math.PI/2;
    }
    box(g,.22,.035,.045,mats.dark,side*.65,1.09,1.31);
    box(g,.14,.18,.11,mats.cream,side*.78,1.06,1.34);
    box(g,.15,.09,.05,mats.cream,side*.35,.49,1.66);
  }
  box(g,.53,.05,.72,mats.cream,0,1.31,-.4);
  const frontBrand=put(g,new THREE.PlaneGeometry(.53,.12),new THREE.MeshBasicMaterial({map:busTexture,side:THREE.DoubleSide}),0,.42,1.7);frontBrand.castShadow=false;
}
const shirtColors=[0xf6a776,0x82b8d2,0xc8a7d8,0x8fc398,0xf0cb75,0xd8a28c];
const CROWD_SPOTS=[[-1.48,3.84],[-.59,3.65],[.44,3.99],[1.46,3.71],[-1.13,4.51],[-.12,4.39],[.9,4.61],[1.68,4.36],[-1.66,5.18],[-.66,5.3],[.34,5.08],[1.28,5.36]];
const FRONT_CROWD=12;let crowdSeed=1729;function crowdRandom(){crowdSeed=(crowdSeed*1664525+1013904223)>>>0;return crowdSeed/4294967296;}
// Waiting travelers spread over the whole walkway: the sidewalk and every sawtooth step, keeping clear of trees and planters.
const CROWD_OBSTACLES=[[-6.5,5.35],[-3.7,5.35],[3.7,5.35],[6.5,5.35],[-5.5,5.3],[5.5,5.3]];
function onWalkway(x,z){if(CROWD_OBSTACLES.some(([ox,oz])=>Math.hypot(x-ox,z-oz)<.5))return false;if(z>=3.45&&z<=6.1)return Math.abs(x)<=7.3;return BAYS.some((_,i)=>z>=LANE_EDGES[i]+.28&&z<=LANE_EDGES[i+1]-.28&&x>=-7.35&&x<=platformEdge(i)-.3);}
for(let attempts=0;CROWD_SPOTS.length<MAX_WAITING&&attempts<60000;attempts++){const x=-7.35+crowdRandom()*14.65,z=-2.85+crowdRandom()*8.95;if(onWalkway(x,z)&&CROWD_SPOTS.every(([px,pz])=>Math.hypot(x-px,z-pz)>.3))CROWD_SPOTS.push([x,z]);}
function buildPerson(passenger,x,z,index){const g=new THREE.Group();g.position.set(x,.1,z);g.scale.setScalar(PERSON_SCALE);g.userData.passengerId=passenger.id;dynamicGroup.add(g);put(g,new THREE.CylinderGeometry(.11,.16,.33,6),material(shirtColors[index%shirtColors.length]),0,.3,0);put(g,new THREE.IcosahedronGeometry(.14,0),mats.skin,0,.61,0);put(g,new THREE.IcosahedronGeometry(.145,0),mats.hair,0,.69,-.045);for(const xx of [-.075,.075])put(g,new THREE.CylinderGeometry(.035,.04,.18,5),mats.dark,xx,.08,0);return g;}
function buildBackCrowd(passengers){if(!passengers.length)return;const n=passengers.length,body=new THREE.InstancedMesh(new THREE.CylinderGeometry(.11,.16,.33,6),material(0xffffff),n),heads=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.14,0),mats.skin,n),hair=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.145,0),mats.hair,n),legs=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.04,.18,5),mats.dark,n*2),dummy=new THREE.Object3D();const place=(mesh,i,x,y,z)=>{dummy.position.set(x,y,z);dummy.scale.setScalar(PERSON_SCALE);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);};for(let i=0;i<n;i++){const [x,z]=CROWD_SPOTS[i+FRONT_CROWD];place(body,i,x,.34,z);body.setColorAt(i,new THREE.Color(shirtColors[(i+FRONT_CROWD)%shirtColors.length]));place(heads,i,x,.588,z);place(hair,i,x,.652,z-.036);place(legs,i*2,x-.06,.164,z);place(legs,i*2+1,x+.06,.164,z);}for(const mesh of [body,heads,hair,legs]){mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;dynamicGroup.add(mesh);}body.instanceColor.needsUpdate=true;}
let labels=[];function renderDynamic(){syncSelectedBus();const visible=bayBuses(),moving=new Map(entryEffects.map(e=>[e.id,{x:e.model.position.x,z:e.model.position.z}]));entryEffects.length=0;clear(dynamicGroup);labels=[];
  for(const bus of visible){const {x,z}=BAYS[bus.bay],g=buildBus(bus,x,z),origin=pendingMoves?.[bus.id]?{x:10.5,z}:moving.get(bus.id);if(origin&&Math.hypot(origin.x-x,origin.z-z)>.1){g.position.set(origin.x,.09,origin.z);entryEffects.push({id:bus.id,model:g,started:performance.now()+(pendingMoves?.[bus.id]?250:180),fromX:origin.x,fromZ:origin.z,toX:x,toZ:z});}labels.push({kind:'bus',id:bus.id,object:g,anchor:new THREE.Vector3(0,1.49,-.15).multiplyScalar(coachSize())});}pendingMoves=null;
  const queue=game.passengers.filter(p=>p.origin===currentStation),selected=getSelectedBus(),matching=selected?.destination?queue.filter(p=>p.dest===selected.destination).slice(0,8):[],front=selected?.destination?[...matching,...queue.filter(p=>p.dest!==selected.destination).slice(0,FRONT_CROWD-matching.length)]:queue.slice(0,FRONT_CROWD),frontIds=new Set(front.map(p=>p.id)),passengers=[...front,...queue.filter(p=>!frontIds.has(p.id))].slice(0,CROWD_SPOTS.length);for(let i=0;i<Math.min(FRONT_CROWD,passengers.length);i++){const [x,z]=CROWD_SPOTS[i],g=buildPerson(passengers[i],x,z,i);labels.push({kind:'passenger',id:passengers[i].id,object:g,anchor:new THREE.Vector3(0,.96,0)});}buildBackCrowd(passengers.slice(FRONT_CROWD));
  renderLabels();}
function renderLabels(){const host=$('scene-labels'),selected=getSelectedBus();host.innerHTML=labels.map(entry=>{if(entry.kind==='bus'){const b=game.buses.find(x=>x.id===entry.id),full=b.passengers===CAPACITY,route=b.destination?`<span class="bus-route-flag">${flagMarkup(b.destination)}</span>`:'';return `<button class="bus-tag ${entry.id===selectedBus?'selected':''} ${full?'full':''}" data-bus="${entry.id}" aria-label="Bus ${entry.id}, ${b.passengers} of ${CAPACITY} travelers aboard${b.destination?`, going to ${city[b.destination].name}`:''}${full?', ready to go':''}">${full?`${route}<strong>GO!</strong>`:`<span class="bus-tag-heading">${route}<small>${b.passengers}/${CAPACITY}</small></span><span class="bus-progress"><i style="width:${b.passengers/CAPACITY*100}%"></i></span>`}</button>`;}const p=game.passengers.find(x=>x.id===entry.id),mismatch=selected?.destination&&selected.destination!==p.dest;return `<button class="passenger-tag ${mismatch?'mismatch':''}" data-passenger="${entry.id}" title="To ${city[p.dest].name}" aria-label="Board passenger for ${city[p.dest].name}${mismatch?', another bus needed':''}">${flagMarkup(p.dest)}</button>`}).join('');positionLabels();}
function positionLabels(){const r=canvas.getBoundingClientRect();for(const entry of labels){const el=$('scene-labels').querySelector(`[data-${entry.kind==='bus'?'bus':'passenger'}="${entry.id}"]`);if(!el)continue;const p=entry.object.localToWorld(entry.anchor.clone()).project(camera);let x=(p.x*.5+.5)*r.width,y=(-p.y*.5+.5)*r.height;const half=el.offsetWidth/2;x=THREE.MathUtils.clamp(x,half+5,r.width-half-5);y=THREE.MathUtils.clamp(y,el.offsetHeight+8,r.height-5);el.style.left=x+'px';el.style.top=y+'px';el.style.display=p.z>1?'none':'';}}
function resize(){const w=innerWidth,h=innerHeight,aspect=w/h,halfW=aspect<1?4.05:Math.min(8.2,aspect*4.5);renderer.setSize(w,h,false);camera.lookAt(0,.15,h<700?1.25:.7);camera.left=-halfW;camera.right=halfW;camera.top=halfW/aspect;camera.bottom=-halfW/aspect;camera.updateProjectionMatrix();positionLabels();}addEventListener('resize',resize);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});canvas.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>12){down=null;return;}down=null;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(dynamicGroup.children,true);for(const hit of hits){let o=hit.object;while(o&&!o.userData.pick)o=o.parent;if(o?.userData.pick?.kind==='bus'){tapBus(o.userData.pick.id);break;}}});
$('scene-labels').addEventListener('click',e=>{const passenger=e.target.closest('[data-passenger]'),bus=e.target.closest('[data-bus]');if(passenger)boardPassenger(Number(passenger.dataset.passenger));else if(bus)tapBus(Number(bus.dataset.bus));});$('station-switch').addEventListener('click',()=>openSheet('stations'));$('fleet-button').addEventListener('click',()=>openSheet('fleet'));$('quick-buy-bus').addEventListener('click',buyBus);$('build-button').addEventListener('click',()=>openSheet('build'));$('close-sheet').addEventListener('click',closeSheet);$('modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeSheet();const station=e.target.closest('[data-station]'),build=e.target.closest('[data-build]'),fleet=e.target.closest('[data-fleet-bus]');if(station)switchStation(station.dataset.station);else if(build)buyStation(build.dataset.build);else if(fleet){const bus=game.buses.find(b=>b.id===Number(fleet.dataset.fleetBus));if(bus.status!=='idle')return toast(`Bus #${String(bus.id).padStart(2,'0')} is still traveling.`);currentStation=bus.location;closeSheet();buildStatic();if(!bayBuses().some(b=>b.id===bus.id))toast(`Bus #${String(bus.id).padStart(2,'0')} is waiting for an open lane.`);else selectedBus=bus.id;renderDynamic();renderHUD();}else if(e.target.id==='buy-bus')buyBus();});addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet();});$('sound').addEventListener('click',()=>{sound=!sound;play('select');localStorage.setItem('souha-sound',sound?'on':'off');$('sound').textContent=sound?'♫':'♩';toast(sound?'Sound on':'Sound off');});
function animate(){requestAnimationFrame(animate);const now=performance.now();if(selectionPad){const pulse=Math.sin(now/260);selectionPad.scale.set(1+pulse*.025,1,1+pulse*.012);selectionPad.userData.fill.opacity=.42+pulse*.12;}for(let i=departureEffects.length-1;i>=0;i--){const effect=departureEffects[i],t=Math.min(1,(now-effect.started)/450),ease=1-(1-t)**3;effect.model.position.x=THREE.MathUtils.lerp(effect.x,10.5,ease);effect.model.position.y=.09;if(now-effect.lastSmoke>45&&t<.85){emitSmoke(effect.model,now);effect.lastSmoke=now;}if(t>=1){scene.remove(effect.model);effect.model.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();});departureEffects.splice(i,1);}}
  let entriesFinished=false;for(let i=entryEffects.length-1;i>=0;i--){const effect=entryEffects[i],t=THREE.MathUtils.clamp((now-effect.started)/550,0,1),ease=1-(1-t)**3;effect.model.position.x=THREE.MathUtils.lerp(effect.fromX,effect.toX,ease);effect.model.position.z=THREE.MathUtils.lerp(effect.fromZ,effect.toZ,ease);effect.model.position.y=.09;if(t>=1){entryEffects.splice(i,1);entriesFinished=true;}}if(entriesFinished&&!entryEffects.length)renderDynamic();
  for(let i=boardingEffects.length-1;i>=0;i--){const effect=boardingEffects[i],t=THREE.MathUtils.clamp((now-effect.started)/560,0,1),ease=t*t*(3-2*t),bus=busModel(effect.busId);if(bus)effect.to.copy(bus.localToWorld(new THREE.Vector3(-.58,.55,1.18).multiplyScalar(coachSize())));effect.model.position.lerpVectors(effect.from,effect.to,ease);effect.model.position.y+=Math.sin(Math.PI*t)*2.2;effect.model.scale.setScalar(PERSON_SCALE*(1-.18*t));const fade=t<.58?1:(1-t)/.42;for(const item of effect.materials)item.material.opacity=item.opacity*fade;if(t>=1){disposeBoardingEffect(effect);boardingEffects.splice(i,1);}}
  for(let i=smokeEffects.length-1;i>=0;i--){const effect=smokeEffects[i],t=Math.min(1,(now-effect.started)/620);effect.puff.position.y+=.006;effect.puff.position.x+=effect.vx*.016;effect.puff.scale.setScalar(1+t*2.5);effect.puff.material.opacity=.82*(1-t);if(t>=1){scene.remove(effect.puff);effect.puff.geometry.dispose();effect.puff.material.dispose();smokeEffects.splice(i,1);}}
  positionLabels();renderer.render(scene,camera);}coachTemplate=await coachTemplatePromise;tick();syncSelectedBus();buildStatic();renderDynamic();renderHUD();resize();animate();setInterval(tick,1000);
