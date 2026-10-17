import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';

// Build stamp from the page (index.html loads game.js?v=<commit>), added to sounds and the model so a new release never mixes with cached files.
const BUILD=new URL(import.meta.url).searchParams.get('v')||'dev';

// ---------------------------------------------------------------------------------------------------------------
// SouSou Bus is played in levels. Each level is a timed shift with a money goal: fill buses with travelers for their
// country, send them, swipe to where they arrive and claim the fares. Reach the goal to win; run out of time or let
// the travelers' mood drain to zero (each group that does not fit or missed claim upsets them) and you lose.
// Stars come from the mood left at the end.
// The stations and buses of a level are part of its design and its difficulty; coins only buy small boosters.
// ---------------------------------------------------------------------------------------------------------------
// accent tints the sky at that station; shirt is the clothing colour of travelers heading there.
const STATIONS = [
  {id:'tunis',name:'Tunis',country:'Tunisia',code:'TN',accent:0xf7a86a,shirt:0xe25d4b},
  {id:'paris',name:'Paris',country:'France',code:'FR',accent:0xa5c9ed,shirt:0x4f86d9},
  {id:'amsterdam',name:'Amsterdam',country:'Netherlands',code:'NL',accent:0xf7c28d,shirt:0xf39a2b},
  {id:'brussels',name:'Brussels',country:'Belgium',code:'BE',accent:0xf3dc8a,shirt:0xf2c94c},
  {id:'istanbul',name:'Istanbul',country:'Türkiye',code:'TR',accent:0xcbb2d6,shirt:0xc44569},
  {id:'madrid',name:'Madrid',country:'Spain',code:'ES',accent:0xf5bca2,shirt:0x9b59b6},
  {id:'rome',name:'Rome',country:'Italy',code:'IT',accent:0xb8dcb0,shirt:0x3fa65f}
];
const city=Object.fromEntries(STATIONS.map(s=>[s.id,s]));

// ---------------------------------------------------------------------------------------------------------------
// Languages: English (default), French and Arabic (right to left). t(key, ...args) returns the text in the current
// language; entries that take values are functions. City names are switched on the station objects themselves.
// ---------------------------------------------------------------------------------------------------------------
const LANGS={en:'English',fr:'Français',ar:'العربية'},LANG_CODES={en:'EN',fr:'FR',ar:'عربي'};
let lang=(()=>{try{const saved=localStorage.getItem('souha-lang');if(LANGS[saved])return saved;}catch{}return 'en';})();
const CITY_NAMES={tunis:['Tunis','Tunis','تونس'],paris:['Paris','Paris','باريس'],amsterdam:['Amsterdam','Amsterdam','أمستردام'],brussels:['Brussels','Bruxelles','بروكسل'],istanbul:['Istanbul','Istanbul','إسطنبول'],madrid:['Madrid','Madrid','مدريد'],rome:['Rome','Rome','روما']};
const STRINGS={
  en:{
    waitingIn:(a,c,s)=>`${a} waiting in <b>${c}</b> · ${s}s!`,lostIn:(a,c)=>`${a} lost in ${c}`,wontFit:n=>`${n} won't fit!`,didntFit:n=>`${n} travelers didn't fit!`,
    seats:n=>`${n} seats`,moodMinus:h=>`mood −${h}`,perfect:'PERFECT FIT!',shouts:{10:'NICE!',20:'GREAT!',30:'AMAZING!',45:'INCREDIBLE!',60:'UNSTOPPABLE!',80:'LEGENDARY!'},
    go:'GO!',combo:'COMBO',onTheBus:'on the bus',levelCaps:n=>`LEVEL ${n}`,level:n=>`Level ${n}`,goalShort:'goal',
    goal:'GOAL',time:'time',buses:'buses',stations:'stations',sec:n=>`${n}s`,
    boosters:'BOOSTERS',ready:n=>`${n} ready`,howToPlay:'HOW TO PLAY',bestCombo:'Best combo',reset:'RESET PROGRESS',resetConfirm:'TAP AGAIN TO RESET',
    nextShift:'NEXT SHIFT',replay:'REPLAY',shift:n=>`SHIFT ${n}`,start:'START',play:'PLAY',paused:'Paused',pauseGoal:(e,g,l)=>`${e} of ${g} · ${l} left`,
    resume:'RESUME',restart:'RESTART',home:'HOME',musicOn:'MUSIC ON',musicOff:'MUSIC OFF',won:'Shift complete!',claimed:'claimed',bestComboLow:'best combo',toSpare:'to spare',
    replayNoCoins:'Replay: stars only, no coins',added:a=>`${a} added to your coins`,nextLevel:'NEXT LEVEL',loseMood:'Travelers are upset!',loseTime:'Time’s up!',
    ofPct:(e,g,p)=>`${e} of ${g} · ${p}%`,tipMood:'Watch the red numbers: a group that does not fit upsets everyone. Claim gold buses before their timer runs out.',
    tipTime:'Keep buses moving: fill one while others travel, and swipe to claim the moment they arrive.',keptReplay:'Replays earn stars, not coins.',kept:a=>`You keep the ${a} you claimed.`,retry:'RETRY',
    boostersTitle:'Boosters',boostersSub:'Bought with the coins you claim. They make every level kinder.',notOwned:'Not owned yet',next:x=>`next ${x}`,max:'MAX',
    goalsTitle:'Daily goals',goalsSub:'Each goal done: your next level starts with ⚡ +50.',goalDone:'Daily goal done! Next level starts with ⚡ +50',
    goalText:{specials:n=>`Catch ${n} special travelers`,rush:n=>`Trigger ${n} Rush hours`,perfect:n=>`Make ${n} perfect fits`,combo:n=>`Reach a ${n} combo`,buses:n=>`Send ${n} full buses`,levels:n=>`Win ${n} levels`},
    albumTitle:'Sticker album',albumSub:'Catch each special traveler in every country.',newSticker:'New sticker!',bonusRush:'Daily bonus: RUSH HOUR!',
    howTabs:['Basics','Specials'],specialInfo:{rush:'5 s: everyone boards your bus, fares ×2',magnet:'Boards every matching traveler at once',golden:'This bus pays ×3 when it leaves',gift:'Surprise: coins or a power special',heart:'Travelers smile again: mood +25',vip:'Your combo multiplier ×2'},
    specialsNote:'Specials glow and fit any bus. They stay about a second: tap fast! Board travelers to fill the ⚡ meter: when it is full, Rush hour starts.',
    howTitle:'How to play',how:['<b>Tap a bus</b> to pick its country','<b>Tap its travelers</b> fast. Numbers are groups: they must fit!','<b>Tap GO</b> when full, then <b>swipe</b> to where it arrives','<b>Tap the gold bus</b> in time to cash in',
      '<b>Keep travelers smiling:</b> each group that doesn\'t fit or missed claim drains the face a step. Empty face, level lost. Each new level only refills it by 25%.'],
    tips:['Stars come from the smile left when you finish. Replays earn stars, not coins.','Tap glowing specials fast: they fit any bus. Fill the ⚡ meter for RUSH HOUR!'],gotIt:'GOT IT',
    tapToClaim:'TAP TO CLAIM',language:'Language',
    specials:{vip:'VIP · combo ×2',gift:'Mystery gift',heart:'Smile · mood +25',rush:'Rush hour',magnet:'Magnet',golden:'Golden ticket'},rushShout:'RUSH HOUR!',vipShout:'COMBO ×2!',goldenShout:'GOLDEN TICKET ×3!',magnetShout:'MAGNET!',rush:'RUSH',
    up:{patience:['Patient travelers',l=>`Travelers wait ${l*12}% longer`,'+12% waiting'],claim:['Longer claims',l=>`+${l*2} s to claim buses`,'+2 s to claim'],
      combo:['Combo keeper',l=>`Combos last +${(l*.25).toFixed(2)} s`,'+0.25 s combo'],mood:['Good mood',l=>`Mistakes upset travelers ${l*20}% less`,'−20% mood loss']}},
  fr:{
    waitingIn:(a,c,s)=>`${a} vous attendent à <b>${c}</b> · ${s} s !`,lostIn:(a,c)=>`${a} perdus à ${c}`,wontFit:n=>`${n} n'entrent pas !`,didntFit:n=>`${n} voyageurs n'ont pas pu monter !`,
    seats:n=>`${n} places`,moodMinus:h=>`humeur −${h}`,perfect:'PILE POIL !',shouts:{10:'SUPER !',20:'GÉNIAL !',30:'INCROYABLE !',45:'FANTASTIQUE !',60:'IMBATTABLE !',80:'LÉGENDAIRE !'},
    go:'GO !',combo:'COMBO',onTheBus:'dans le bus',levelCaps:n=>`NIVEAU ${n}`,level:n=>`Niveau ${n}`,goalShort:'objectif',
    goal:'OBJECTIF',time:'temps',buses:'bus',stations:'stations',sec:n=>`${n} s`,
    boosters:'BONUS',ready:n=>`${n} dispo`,howToPlay:'COMMENT JOUER',bestCombo:'Meilleur combo',reset:'RÉINITIALISER',resetConfirm:'TOUCHEZ ENCORE POUR CONFIRMER',
    nextShift:'PROCHAIN SERVICE',replay:'REJOUER',shift:n=>`SERVICE ${n}`,start:'C’EST PARTI',play:'JOUER',paused:'Pause',pauseGoal:(e,g,l)=>`${e} sur ${g} · encore ${l}`,
    resume:'REPRENDRE',restart:'RECOMMENCER',home:'ACCUEIL',musicOn:'MUSIQUE : OUI',musicOff:'MUSIQUE : NON',won:'Service terminé !',claimed:'encaissé',bestComboLow:'meilleur combo',toSpare:'restant',
    replayNoCoins:'Rejouer : étoiles seulement, pas de pièces',added:a=>`${a} ajoutés à vos pièces`,nextLevel:'NIVEAU SUIVANT',loseMood:'Les voyageurs sont fâchés !',loseTime:'Temps écoulé !',
    ofPct:(e,g,p)=>`${e} sur ${g} · ${p} %`,tipMood:'Attention aux chiffres rouges : un groupe qui ne rentre pas fâche tout le monde. Encaissez les bus dorés avant la fin de leur minuteur.',
    tipTime:'Faites rouler les bus : remplissez-en un pendant que les autres voyagent, et glissez pour encaisser dès leur arrivée.',keptReplay:'Rejouer rapporte des étoiles, pas de pièces.',kept:a=>`Vous gardez les ${a} encaissés.`,retry:'RÉESSAYER',
    boostersTitle:'Bonus',boostersSub:'Achetés avec les pièces encaissées. Ils rendent chaque niveau plus facile.',notOwned:'Pas encore acheté',next:x=>`suivant ${x}`,max:'MAX',
    goalsTitle:'Objectifs du jour',goalsSub:'Chaque objectif atteint : ⚡ +50 au début du prochain niveau.',goalDone:'Objectif atteint ! ⚡ +50 au prochain niveau',
    goalText:{specials:n=>`Attrapez ${n} voyageurs spéciaux`,rush:n=>`Déclenchez ${n} heures de pointe`,perfect:n=>`Réussissez ${n} remplissages parfaits`,combo:n=>`Atteignez un combo de ${n}`,buses:n=>`Envoyez ${n} bus pleins`,levels:n=>`Gagnez ${n} niveaux`},
    albumTitle:'Album d’autocollants',albumSub:'Attrapez chaque voyageur spécial dans chaque pays.',newSticker:'Nouvel autocollant !',bonusRush:'Bonus du jour : HEURE DE POINTE !',
    howTabs:['Bases','Spéciaux'],specialInfo:{rush:'5 s : tout le monde monte dans votre bus, recettes ×2',magnet:'Fait monter d’un coup tous les voyageurs du bon pays',golden:'Ce bus rapporte ×3 en partant',gift:'Surprise : des pièces ou un spécial puissant',heart:'Les voyageurs resourient : humeur +25',vip:'Votre multiplicateur de combo ×2'},
    specialsNote:'Les spéciaux brillent et vont dans n’importe quel bus. Ils restent environ une seconde : touchez vite ! Chaque voyageur embarqué remplit la jauge ⚡ : pleine, c’est l’heure de pointe.',
    howTitle:'Comment jouer',how:['<b>Touchez un bus</b> pour choisir son pays','<b>Touchez ses voyageurs</b> vite. Les chiffres sont des groupes : ils doivent tenir !','<b>Touchez GO</b> quand il est plein, puis <b>glissez</b> vers son arrivée','<b>Touchez le bus doré</b> à temps pour encaisser',
      '<b>Gardez les voyageurs souriants :</b> chaque groupe qui ne rentre pas ou encaissement raté vide le visage d’un cran. Visage vide, niveau perdu. Chaque nouveau niveau ne le remplit que de 25 %.'],
    tips:['Les étoiles dépendent du sourire restant à la fin. Rejouer rapporte des étoiles, pas de pièces.','Touchez vite les voyageurs brillants : ils vont dans n’importe quel bus. Remplissez la jauge ⚡ pour l’HEURE DE POINTE !'],gotIt:'COMPRIS',
    tapToClaim:'TOUCHER POUR ENCAISSER',language:'Langue',
    specials:{vip:'VIP · combo ×2',gift:'Cadeau mystère',heart:'Sourire · humeur +25',rush:'Heure de pointe',magnet:'Aimant',golden:'Ticket doré'},rushShout:'HEURE DE POINTE !',vipShout:'COMBO ×2 !',goldenShout:'TICKET DORÉ ×3 !',magnetShout:'AIMANT !',rush:'RUSH',
    up:{patience:['Voyageurs patients',l=>`Les voyageurs attendent ${l*12} % de plus`,'+12 % d’attente'],claim:['Encaissement prolongé',l=>`+${l*2} s pour encaisser`,'+2 s pour encaisser'],
      combo:['Combo durable',l=>`Les combos durent +${(l*.25).toFixed(2).replace('.',',')} s`,'+0,25 s de combo'],mood:['Bonne humeur',l=>`Les erreurs fâchent ${l*20} % moins`,'−20 % de perte d’humeur']}},
  ar:{
    waitingIn:(a,c,s)=>`${a} بانتظارك في <b>${c}</b> · ${s} ث!`,lostIn:(a,c)=>`ضاع ${a} في ${c}`,wontFit:n=>`${n} لا يتّسع لهم المكان!`,didntFit:n=>`${n} مسافرين لم يتّسع لهم المكان!`,
    seats:n=>`${n} مقاعد`,moodMinus:h=>`المزاج −${h}`,perfect:'مقاس مثالي!',shouts:{10:'رائع!',20:'ممتاز!',30:'مذهل!',45:'خرافي!',60:'لا يُوقَف!',80:'أسطوري!'},
    go:'انطلق!',combo:'كومبو',onTheBus:'في الحافلة',levelCaps:n=>`المستوى ${n}`,level:n=>`المستوى ${n}`,goalShort:'الهدف',
    goal:'الهدف',time:'الوقت',buses:'حافلات',stations:'محطات',sec:n=>`${n} ث`,
    boosters:'المعزّزات',ready:n=>`${n} جاهزة`,howToPlay:'طريقة اللعب',bestCombo:'أفضل كومبو',reset:'إعادة التقدّم',resetConfirm:'اضغط مرة أخرى للتأكيد',
    nextShift:'الرحلة القادمة',replay:'إعادة',shift:n=>`الرحلة ${n}`,start:'ابدأ',play:'العب',paused:'متوقّف',pauseGoal:(e,g,l)=>`${e} من ${g} · بقي ${l}`,
    resume:'متابعة',restart:'إعادة',home:'الرئيسية',musicOn:'الموسيقى: تشغيل',musicOff:'الموسيقى: إيقاف',won:'أحسنت! انتهت الرحلة',claimed:'المحصّل',bestComboLow:'أفضل كومبو',toSpare:'المتبقي',
    replayNoCoins:'إعادة: نجوم فقط، بلا عملات',added:a=>`أُضيفت ${a} إلى عملاتك`,nextLevel:'المستوى التالي',loseMood:'المسافرون غاضبون!',loseTime:'انتهى الوقت!',
    ofPct:(e,g,p)=>`${e} من ${g} · ${p}%`,tipMood:'انتبه للأرقام الحمراء: المجموعة التي لا يتّسع لها المكان تُغضب الجميع. حصّل الحافلات الذهبية قبل انتهاء وقتها.',
    tipTime:'أبقِ الحافلات تتحرك: املأ واحدة بينما تسافر الأخرى، واسحب للتحصيل فور وصولها.',keptReplay:'الإعادة تمنح نجومًا لا عملات.',kept:a=>`تحتفظ بـ ${a} التي حصّلتها.`,retry:'أعد المحاولة',
    boostersTitle:'المعزّزات',boostersSub:'تُشترى بالعملات التي تحصّلها، وتجعل كل مستوى أسهل.',notOwned:'غير مملوك بعد',next:x=>`التالي ${x}`,max:'الأقصى',
    goalsTitle:'أهداف اليوم',goalsSub:'كل هدف تحققه: يبدأ مستواك التالي بـ ⚡ +50.',goalDone:'تحقق هدف اليوم! ⚡ +50 في المستوى التالي',
    goalText:{specials:n=>`التقط ${n} مسافرين مميزين`,rush:n=>`فعّل ساعة الذروة ${n} مرات`,perfect:n=>`حقق ${n} مقاسات مثالية`,combo:n=>`صل إلى كومبو ${n}`,buses:n=>`أرسل ${n} حافلات ممتلئة`,levels:n=>`اربح ${n} مستويات`},
    albumTitle:'ألبوم الملصقات',albumSub:'التقط كل مسافر مميز في كل دولة.',newSticker:'ملصق جديد!',bonusRush:'مكافأة اليوم: ساعة الذروة!',
    howTabs:['الأساسيات','المميزون'],specialInfo:{rush:'5 ث: الجميع يركب حافلتك، والأرباح ×2',magnet:'يُركب كل المسافرين المطابقين دفعة واحدة',golden:'هذه الحافلة تربح ×3 عند انطلاقها',gift:'مفاجأة: عملات أو مسافر مميز قوي',heart:'يبتسم المسافرون من جديد: مزاج +25',vip:'مضاعف الكومبو ×2'},
    specialsNote:'المسافرون المميزون يتوهّجون ويركبون أي حافلة. يبقون نحو ثانية: اضغط بسرعة! كل مسافر تُركبه يملأ عدّاد ⚡، وعند امتلائه تبدأ ساعة الذروة.',
    howTitle:'طريقة اللعب',how:['<b>اضغط على حافلة</b> لاختيار وجهتها','<b>اضغط على مسافريها</b> بسرعة. الأرقام مجموعات: يجب أن يتّسع لها المكان!','<b>اضغط انطلق</b> عندما تمتلئ، ثم <b>اسحب</b> إلى محطة وصولها','<b>اضغط على الحافلة الذهبية</b> في الوقت لتحصيل العملات',
      '<b>حافظ على ابتسامة المسافرين:</b> كل مجموعة لا يتّسع لها المكان أو تحصيل فائت يُفرغ الوجه درجة. وجه فارغ يعني خسارة المستوى. كل مستوى جديد يملؤه بـ25% فقط.'],
    tips:['النجوم تأتي من الابتسامة المتبقية عند النهاية. الإعادة تمنح نجومًا لا عملات.','اضغط بسرعة على المسافرين المتوهّجين: يركبون أي حافلة. املأ عدّاد ⚡ لساعة الذروة!'],gotIt:'فهمت',
    tapToClaim:'اضغط للتحصيل',language:'اللغة',
    specials:{vip:'VIP · كومبو ×2',gift:'هدية مفاجئة',heart:'ابتسامة · مزاج +25',rush:'ساعة الذروة',magnet:'مغناطيس',golden:'تذكرة ذهبية'},rushShout:'ساعة الذروة!',vipShout:'كومبو ×2!',goldenShout:'تذكرة ذهبية ×3!',magnetShout:'مغناطيس!',rush:'ذروة',
    up:{patience:['مسافرون صبورون',l=>`ينتظر المسافرون أطول بـ${l*12}%`,'+12% انتظار'],claim:['وقت تحصيل أطول',l=>`+${l*2} ث للتحصيل`,'+2 ث للتحصيل'],
      combo:['حافظ الكومبو',l=>`الكومبو يدوم +${(l*.25).toFixed(2)} ث`,'+0.25 ث كومبو'],mood:['مزاج جيد',l=>`الأخطاء تُزعج المسافرين أقل بـ${l*20}%`,'−20% فقدان المزاج']}}};
const t=(key,...args)=>{const v=STRINGS[lang][key]??STRINGS.en[key];return typeof v==='function'?v(...args):v;};
// Applies the language to the page: direction, Arabic font, city names and the HUD's fixed texts.
function applyLanguage(){
  const index=Object.keys(LANGS).indexOf(lang);for(const station of STATIONS)station.name=CITY_NAMES[station.id]?.[index]??station.name;
  document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';}
applyLanguage();
const $=id=>document.getElementById(id);
const flagMarkup=(id,className='flag-icon')=>`<img class="${className}" src="./flags/${city[id].code.toLowerCase()}.svg" alt="" aria-hidden="true">`;
// Icons are single-colour SVGs (Streamline Plump Solid) used as CSS masks, so they take the text colour.
const icon=(name,className='')=>`<i class="ico ${className}" style="--i:url(./icons/${name}.svg)" aria-hidden="true"></i>`;
const num=n=>Math.floor(n).toLocaleString('en-US');
const shortNum=n=>n>=1000?(n/1000).toFixed(n%1000?1:0).replace(/\.0$/,'')+'k':num(n);
// Money is game coins, never a real currency: every amount shows the coin icon.
const coins=n=>`<span class="amt">${icon('coin-diagonal')}${num(n)}</span>`;
const shortCoins=n=>`<span class="amt">${icon('coin-diagonal')}${shortNum(n)}</span>`;
const bulk=coins;
const SAVE_KEY='souha-bus-station-stories-v1',CAPACITY=20,PERSON_SCALE=.58,COMBO_STEP=4;
// Travelers' mood (0–100), shown as one smiling face filled with colour up to the mood: a group that does not fit
// costs 15, a missed claim 25 (less with the Good mood booster); a Smile traveler gives 25 back. At 0 the level is lost.
// The mood carries over: each level starts with the mood the last one ended with, refilled by 25.
const MOOD_MAX=100,MOOD_HIT={misfit:15,claim:25},MOOD_SMILE=25,MOOD_REFILL=25,MOOD_FACE='smiley-very-happy-1';
const MOOD_STATES=[[80,'great','smiley-very-happy-1'],[60,'good','smiley-happy'],[40,'meh','smiley-indiferent'],[20,'ok','smiley-worried'],[0,'bad','smiley-crying-1']];
const moodState=mood=>MOOD_STATES.find(([min])=>mood>=min);
const moodStars=mood=>mood>=70?3:mood>=40?2:1;
const BAYS=[{x:-2.15,z:-2},{x:0,z:0},{x:2.15,z:2}],LANE_EDGES=[-3.1,-1.02,1.02,3.1];
// Where the raised walkway stops behind bay i (just past the rear of a parked coach).
const platformEdge=i=>BAYS[i].x-1.98;
// Special travelers: rare (one every 6-10 s), placed at the front of the crowd, fit ANY bus that can board, and stay a
// fair 1.6 s (1.1 s by level 16). Each one changes play for a moment. weight = how often it is picked.
const SPECIALS={
  vip:{icon:'star',weight:24,color:0xffc93c,sound:'vip'},
  magnet:{icon:'magnet',weight:20,color:0xa070ff,sound:'diamond'},
  gift:{icon:'gift',weight:18,color:0xff7ab8,sound:'gift'},
  golden:{icon:'ticket',weight:16,color:0xffb300,sound:'gift'},
  heart:{icon:MOOD_FACE,weight:12,color:0x58cc02,sound:'heart'},
  rush:{icon:'flash',weight:10,color:0x48c8ff,sound:'rush'}};
const SPECIAL_CSS={vip:'#ffc800',magnet:'#a070ff',gift:'#ff86d0',golden:'#ffb300',heart:'#58cc02',rush:'#1cb0f6'};
// Rush meter: every boarded seat fills it (perfect fits and specials fill more); full = RUSH HOUR for 5 s:
// every traveler goes your way, spawns double, fares ×2.
const RUSH_MS=5000,RUSH_PER_SEAT=1.3,RUSH_PERFECT=12,RUSH_SPECIAL=8;
const stationIndex=id=>STATIONS.findIndex(s=>s.id===id);
const distance=(a,b)=>Math.abs(stationIndex(a)-stationIndex(b));
// Longer routes pay more per traveler and take longer to drive.
const fareFor=(origin,dest)=>12+6*distance(origin,dest);
const tripTime=(origin,dest)=>(7+2*distance(origin,dest))*1000;

// Boosters: the only things coins buy. They make every level kinder, never change the level itself. A new level pays
// about its goal (2k coins at level 1, 8.5k at level 10, 14k at level 20; ~47k by level 10, ~170k by level 20) and a
// replay pays nothing; early levels also overshoot by about one bus (~1.5k). So it is about one booster per
// level early on, and maxing everything takes ~21 levels.
const TIER_COSTS=[2500,5000,9000,15000,24000];
// Replaying a finished level is for stars only: claims count toward its goal but pay no coins, so boosters can't be
// farmed on easy levels before moving on.
const UPGRADES={
  patience:{name:'Patient travelers',icon:'timer',costs:TIER_COSTS,effect:level=>`Travelers wait ${level*12}% longer`,next:'+12% waiting'},
  claim:{name:'Longer claims',icon:'coin-diagonal',costs:TIER_COSTS,effect:level=>`+${level*2} s to claim buses`,next:'+2 s to claim'},
  combo:{name:'Combo keeper',icon:'crown',costs:TIER_COSTS,effect:level=>`Combos last +${(level*.25).toFixed(2)} s`,next:'+0.25 s combo'},
  mood:{name:'Good mood',icon:MOOD_FACE,costs:[7000,18000],effect:level=>`Mistakes upset travelers ${level*20}% less`,next:'−20% mood loss'}};
const upgradeMax=key=>UPGRADES[key].costs.length,upgradeCost=(key,level)=>UPGRADES[key].costs[level];

// Level design: every 3 levels a new country joins (more destinations, longer and better-paid routes); inside each
// group of 3 the level gives one bus fewer. Traveler patience, bonus speed, groups and claim time get tougher over the
// first 16 levels (t: 0 → 1); after that the levels keep growing (e: 0 → 1 over the next 24): fewer buses, shorter
// claims, faster travelers, bigger groups. Goals are a share of what a quick player earns in a full shift (measured
// with a test player): 22% at level 1, 70% by level 16, then +1% per level up to 95%.
function levelConfig(n){
  const k=Math.min(STATIONS.length,2+Math.floor((n-1)/3)),stations=STATIONS.slice(0,k).map(s=>s.id),up=game.upgrades;
  const t=Math.min(1,(n-1)/15),e=Math.min(1,Math.max(0,n-16)/24),patience=(1+.12*up.patience)*(1-.2*e);
  const potential=9500*(1+.25*(k-2)),share=n<=16?.22+.48*t:Math.min(.95,.7+.01*(n-16));
  return {n,stations,buses:Math.max(k+2,2*k+2-(n-1)%3-Math.floor(4*e)),duration:(60+10*(k-2))*1000,
    target:Math.round(potential*share/50)*50,
    life:[(2800-1000*t)*patience,(4000-1300*t)*patience],specialLife:Math.max(1000,1600-500*t-100*e),
    claim:Math.max(6000,12000-3500*t-2000*e)+2000*up.claim,combo:1500-200*t-150*e+250*up.combo,
    groupChance:.25+.3*t+.1*e,maxGroup:3+Math.round(2*t+e),spawn:190-50*t};}

// ---------------------------------------------------------------------------------------------------------------
// Saved progress: coins, the next level to play, best stars per level and boosters. A level in progress is not saved.
// ---------------------------------------------------------------------------------------------------------------
function freshGame(){return {version:3,coins:0,level:1,stars:{},upgrades:{patience:0,claim:0,combo:0,mood:0},mood:MOOD_MAX,bestCombo:0,daily:null,album:{},rushBonus:0};}
// Earlier saves (free play) keep their coins, including fares still sitting on buses, and start at level 1.
function migrate(old){const owed=(old.buses||[]).reduce((sum,b)=>sum+(b.payout||0)+(b.revenue||0),0);return {...freshGame(),coins:Math.floor((old.coins||0)+owed),bestCombo:old.bestCombo||0};}
function load(){try{const data=JSON.parse(localStorage.getItem(SAVE_KEY));if(data?.version===3)return data;if(data&&(data.version===1||data.version===2))return migrate(data);}catch{}return freshGame();}
const game=load();game.upgrades={...freshGame().upgrades,...game.upgrades};
// The Extra heart booster became Good mood: keep the tiers already bought.
if('hearts' in game.upgrades){game.upgrades.mood=Math.max(game.upgrades.mood,game.upgrades.hearts);delete game.upgrades.hearts;}
// Developer switch for balancing (?calibrate): levels never end early, so a test player can measure a full shift.
const CALIBRATE=new URLSearchParams(location.search).has('calibrate');
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));}catch{}}
save();
let sound=localStorage.getItem('souha-sound')!=='off';

// ---------------------------------------------------------------------------------------------------------------
// Sound: CC0 samples (see sounds/CREDITS.txt) through one shared Web Audio context, unlocked by the first tap.
// ---------------------------------------------------------------------------------------------------------------
const SOUND_NAMES=['board','bus-full','select','depart','coins','buy','station-open','switch','error','menu-open','arrival','vip','gift','heart','rush','diamond','combo','tick','lost','note','pop-a','pop-b','pop-c','ping','coin-jingle','purchase','win','lose'];
const soundFiles=Object.fromEntries(SOUND_NAMES.map(name=>[name,fetch(`./sounds/${name}.mp3?v=${BUILD}`).then(r=>r.arrayBuffer()).catch(()=>null)]));
// Coming back to the tab: phones (iOS above all) can hand back a context that is stuck ("interrupted"/suspended) or
// running but silent, and resume() only works inside a tap. So a context that may be stale is rebuilt inside the next
// tap (a context created in a gesture always plays); decoded sounds are kept and reused, the music restarts.
let audioCtx=null,audioStale=false;const soundBuffers={};
const IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
function createAudio(){
  const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return false;
  try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
  const ctx=audioCtx=new AudioCtx();ctx.resume().catch(()=>{});ctx.onstatechange=()=>{if(ctx===audioCtx&&ctx.state==='interrupted')audioStale=true;};
  for(const name of SOUND_NAMES)if(!soundBuffers[name])soundFiles[name].then(data=>data&&ctx.decodeAudioData(data.slice(0))).then(buffer=>{if(buffer)soundBuffers[name]=buffer;}).catch(()=>{});
  loadMusic();return true;}
// Only events that count as a user gesture may create or resume audio (a touch's pointerdown does not; its touchend
// does). Browsers without navigator.userActivation are trusted as before.
const gestureActive=()=>navigator.userActivation?navigator.userActivation.isActive:true;
const everInteracted=()=>navigator.userActivation?navigator.userActivation.hasBeenActive:true;
function unlockAudio(){
  if(!gestureActive())return;
  if(audioCtx&&audioStale){audioStale=false;const old=audioCtx;audioCtx=null;musicTrack=null;try{old.close();}catch{}}
  if(!audioCtx){if(!createAudio())return;}else if(audioCtx.state!=='running')audioCtx.resume().catch(()=>{});
  // A silent one-sample blip inside the tap makes sure the output really starts (iOS).
  try{const blip=audioCtx.createBufferSource();blip.buffer=audioCtx.createBuffer(1,1,22050);blip.connect(audioCtx.destination);blip.start(0);}catch{}}
function backToForeground(){
  if(!audioCtx)return;const ctx=audioCtx;if(everInteracted())ctx.resume().catch(()=>{});if(IOS){audioStale=true;return;}
  const t0=ctx.currentTime;setTimeout(()=>{if(ctx===audioCtx&&(ctx.state!=='running'||ctx.currentTime-t0<.1))audioStale=true;},600);}
for(const type of ['pointerdown','touchend','click','keydown'])addEventListener(type,unlockAudio,{capture:true});
function play(name,volume=1,rate=1,delay=0){if(!sound||!audioCtx||!soundBuffers[name])return;if(audioCtx.state!=='running'&&gestureActive())audioCtx.resume().catch(()=>{});const source=audioCtx.createBufferSource(),gain=audioCtx.createGain();source.buffer=soundBuffers[name];source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain).connect(audioCtx.destination);source.start(audioCtx.currentTime+delay);}
// Music: two CC0 loops on their own gain, under the effects: a calm piano tune on the menus and an island tune in the
// levels (a touch faster in the last 10 seconds). It ducks under the pause card and makes room for the win/lose jingle.
const MUSIC={menu:{file:'music-menu',volume:.2},play:{file:'music-play',volume:.2}};
let musicOn=localStorage.getItem('souha-music')!=='off',musicWanted=null,musicTrack=null,musicDuck=1;const musicBuffers={};
const musicFiles={};
function loadMusic(){const ctx=audioCtx;for(const [name,m] of Object.entries(MUSIC))(musicFiles[name]??=fetch(`./sounds/${m.file}.mp3?v=${BUILD}`).then(r=>r.arrayBuffer()))
  .then(data=>musicBuffers[name]||ctx.decodeAudioData(data.slice(0))).then(buffer=>{musicBuffers[name]=buffer;if(ctx===audioCtx&&musicWanted===name&&!musicTrack)startMusic(name);}).catch(()=>{});}
const musicTarget=()=>sound&&musicOn&&musicTrack?MUSIC[musicTrack.name].volume*musicDuck:0;
function rampGain(gain,value,seconds){const t=audioCtx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setValueAtTime(gain.gain.value,t);gain.gain.linearRampToValueAtTime(value,t+seconds);}
function applyMusicVolume(seconds=.4){if(musicTrack)rampGain(musicTrack.gain,musicTarget(),seconds);}
function startMusic(name){
  if(!audioCtx||!musicBuffers[name])return;const source=audioCtx.createBufferSource(),gain=audioCtx.createGain();
  source.buffer=musicBuffers[name];source.loop=true;gain.gain.value=0;
  source.connect(gain).connect(audioCtx.destination);source.start();musicTrack={name,source,gain};applyMusicVolume(.9);}
function stopMusic(seconds=.5){if(!musicTrack)return;const {source,gain}=musicTrack;rampGain(gain,0,seconds);source.stop(audioCtx.currentTime+seconds+.05);musicTrack=null;}
function setMusic(name){musicWanted=name;musicDuck=1;if(musicTrack?.name===name){musicTrack.source.playbackRate.value=1;applyMusicVolume();return;}stopMusic();if(name)startMusic(name);}
function duckMusic(level){musicDuck=level;applyMusicVolume(.3);}
function setMusicRate(rate){if(musicTrack)musicTrack.source.playbackRate.setTargetAtTime(rate,audioCtx.currentTime,.25);}
function hurryMusic(){if(!rushActive())setMusicRate(1.08);}
// Rising three-note sting each time the combo multiplier steps up, a semitone higher every step.
function playStepUp(step){[0,4,7].forEach((note,i)=>play('ping',.32,.9*2**((note+Math.min(step,12))/12),i*.045));}
// Counters rolling up: a soft high ping every few frames, rising as the bar fills (like a slot counter).
let lastRollTick=0;function rollTick(now,progress){if(now-lastRollTick<70)return;lastRollTick=now;play('ping',.07,2.4+Math.min(1,progress)*.8);}
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
function prepareRun(n){$('game').classList.remove('rush');
  const cfg=levelConfig(n),buses=[];for(let i=0;i<cfg.buses;i++)buses.push(newBus(cfg.stations[i%cfg.stations.length]));
  run={n,cfg,buses,replay:n<game.level,paid:0,rushMeter:0,rushUntil:0,nextSpecialAt:0,started:0,mood:Math.min(MOOD_MAX,(game.mood??MOOD_MAX)+MOOD_REFILL),earned:0,endsAt:0,remaining:cfg.duration,bestCombo:0,result:null};
  for(const bus of buses)assignDest(bus);currentStation=cfg.stations[0];selectedBus=null;crowd=[];shownEarned=0;coinsInFlight=0;resetCombo();}
const stationsInRun=()=>run.cfg.stations;
// Every parked bus waiting for travelers has a random destination among the level's other stations.
function assignDest(bus){const options=stationsInRun().filter(id=>id!==bus.location);bus.dest=options[Math.floor(Math.random()*options.length)]||null;}
const timeLeft=()=>mode==='play'?Math.max(0,run.endsAt-Date.now()):run.remaining;

// ---------------------------------------------------------------------------------------------------------------
// Buses: tap one to choose it, fill it with travelers for its country, tap it again when full to send it.
// It parks at its destination holding the fares; tap it there in time or the money is lost and the travelers get upset.
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
  if(bus.golden){bus.revenue*=3;bus.golden=false;play('win',.5);}
  goalProgress('buses');
  Object.assign(bus,{status:'trip',origin:bus.location,departed:Date.now(),arrival:Date.now()+tripTime(bus.location,bus.dest),bay:null});
  const replacement=bayBuses().find(b=>b.bay===vacated);if(replacement)pendingMoves[replacement.id]=true;
  selectedBus=null;syncSelectedBus();renderBuses();renderCrowd();renderHud();play('depart',.9);vibrate(20);
  if(tagRect)floatText(tagRect.left+tagRect.width/2,tagRect.top,`${bulk(bus.revenue)} ${lang==='ar'?'←':'→'} ${city[bus.dest].name}`,'depart');}
function arrive(bus,now){
  Object.assign(bus,{status:'idle',location:bus.dest,dest:null,payout:bus.revenue,revenue:0,passengers:0,claimBy:now+run.cfg.claim,readyAt:now,bay:null});
  if(bus.location===currentStation){pendingMoves[bus.id]=true;play('arrival',.9);}
  else{toast(t('waitingIn',bulk(bus.payout),city[bus.location].name,Math.round(run.cfg.claim/1000)),'claim');play('ping',.6,1.6);play('ping',.6,2,.09);vibrate([25,40,25]);}}
// Claimed money counts toward the level goal and is yours to keep.
function claim(bus){
  const amount=bus.payout,paid=run.replay?0:amount;bus.payout=0;bus.claimBy=0;run.earned+=amount;run.paid+=paid;game.coins+=paid;coinsInFlight+=amount;assignDest(bus);save();
  kickBus(bus.id,{y:1,roll:(Math.random()-.5)*.5});burstCoins(busModel(bus.id),amount);
  const tag=document.querySelector(`[data-bus="${bus.id}"]`)?.getBoundingClientRect();if(tag)floatText(tag.left+tag.width/2,tag.top,`+${bulk(amount)}`,'cash');
  playCash(amount);burstAt(tag,'#ffc800',16,true);if(tag)flyCoins(tag.left+tag.width/2,tag.top+tag.height/2,amount);else coinsInFlight-=amount;vibrate([20,30,20]);
  renderBuses();renderCrowd();renderHud();if(run.earned>=run.cfg.target&&!CALIBRATE)finishRun(true);}
function loseClaim(bus){
  const lost=bus.payout;bus.payout=0;bus.claimBy=0;assignDest(bus);
  upsetTravelers('claim',t('lostIn',bulk(lost),city[bus.location].name));}

// ---------------------------------------------------------------------------------------------------------------
// Travelers: they pop up all over the visible walkway, each heading to a country, and leave after a few seconds.
// Only travelers for the selected bus's country can be tapped; the others are faded.
// ---------------------------------------------------------------------------------------------------------------
let crowd=[],nextTravelerId=1,lastSpawn=0;
function rollSpecial(){
  const pool=Object.entries(SPECIALS).filter(([kind])=>!(kind==='heart'&&run.mood>=90)&&!(kind==='rush'&&rushActive()));
  let roll=Math.random()*pool.reduce((sum,[,sp])=>sum+sp.weight,0);for(const [kind,sp] of pool){if(roll<sp.weight)return kind;roll-=sp.weight;}return 'vip';}
const rushActive=(now=Date.now())=>run&&run.rushUntil>now;
// Destinations favour the selected bus (so there is always someone to tap), then the other buses here, then any other country.
function travelerDest(){
  if(rushActive()){const target=[getSelectedBus(),...bayBuses()].find(canBoard);if(target)return target.dest;}
  const others=stationsInRun().filter(id=>id!==currentStation),selected=getSelectedBus(),bays=bayBuses().filter(b=>b.dest&&!b.payout).map(b=>b.dest),roll=Math.random();
  if(selected?.dest&&roll<.55)return selected.dest;if(bays.length&&roll<.8)return bays[Math.floor(Math.random()*bays.length)];return others[Math.floor(Math.random()*others.length)];}
// A flag needs about a tag-sized box of walkway (TAG_BOX) so tags never cover each other.
const TAG_BOX=[.64,.72];
function freeSpot(front=false){
  let pool=onScreenSpots&&onScreenSpots.size>=8?[...onScreenSpots]:CROWD_SPOTS.map((_,i)=>i);
  // Specials stand at the front edge of the sidewalk, right below the buses.
  if(front){const near=pool.filter(i=>CROWD_SPOTS[i][1]>=3.45&&CROWD_SPOTS[i][1]<=4.7);if(near.length)pool=near;}
  const roomy=pool.filter(i=>crowd.every(p=>{const [x1,z1]=CROWD_SPOTS[i],[x2,z2]=CROWD_SPOTS[p.spot];return Math.abs(x1-x2)>=TAG_BOX[0]||Math.abs(z1-z2)>=TAG_BOX[1];}));
  return roomy.length?roomy[Math.floor(Math.random()*roomy.length)]:null;}
// Groups: a traveler tag can carry 2 or more people (more often, and bigger, in later levels). A group fills that
// many seats in one tap; a group that does not fit the selected bus costs its fares, upsets the travelers and breaks the combo.
// Filling the bus exactly with a group is a PERFECT FIT worth 5 extra fares.
const PERFECT_FIT_FARES=5;
function rollGroup(){if(Math.random()>=run.cfg.groupChance)return 1;return 2+Math.floor(Math.random()**1.6*(run.cfg.maxGroup-1));}
function spawnTraveler(now,dest=travelerDest()){
  const spot=freeSpot();if(spot===null||!dest)return false;const [lo,hi]=run.cfg.life;
  crowd.push({id:nextTravelerId++,dest,spot,special:null,size:rollGroup(),born:now,until:now+lo+Math.random()*(hi-lo)});return true;}
// A special appears with a shimmer at the front of the crowd; it fits any bus that can board (it rides with the bus).
function spawnSpecial(now){
  const bus=[getSelectedBus(),...bayBuses()].find(canBoard),spot=freeSpot(true);if(!bus||spot===null)return false;
  crowd.push({id:nextTravelerId++,dest:bus.dest,spot,special:rollSpecial(),size:1,born:now,until:now+run.cfg.specialLife});
  play('ping',.45,2.4);play('ping',.4,3,.07);play('ping',.35,3.6,.14);return true;}
// Daily goals: three per day (picked from the date), each done gives the next level a head start on the Rush meter
// (never coins: money only comes from claiming buses). Sticker album: each special in each country.
const GOAL_RANGES={specials:[8,12],rush:[3,5],perfect:[4,6],combo:[35,50],buses:[10,16],levels:[3,4]};
function ensureDaily(){
  const day=new Date().toLocaleDateString('en-CA');if(game.daily?.day===day)return game.daily;
  let seed=[...day].reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,7);const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const kinds=Object.keys(GOAL_RANGES).sort(()=>rnd()-.5).slice(0,3);
  game.daily={day,goals:kinds.map(kind=>{const [lo,hi]=GOAL_RANGES[kind];return {kind,target:lo+Math.floor(rnd()*(hi-lo+1)),progress:0,done:false};})};save();return game.daily;}
function goalProgress(kind,amount=1,asMax=false){
  const goal=ensureDaily().goals.find(g=>g.kind===kind&&!g.done);if(!goal)return;
  goal.progress=asMax?Math.max(goal.progress,amount):goal.progress+amount;
  if(goal.progress>=goal.target){goal.progress=goal.target;goal.done=true;game.rushBonus=Math.min(100,(game.rushBonus||0)+50);toast(`${icon('trophy')} ${t('goalDone')}`,'claim');play('purchase',.7);}
  save();}
const albumCount=()=>Object.values(game.album||{}).reduce((sum,list)=>sum+list.filter(id=>city[id]).length,0),ALBUM_SIZE=Object.keys(SPECIALS).length*STATIONS.length;
function addSticker(kind,station){const album=game.album??={},list=album[kind]??=[];if(list.includes(station))return;list.push(station);save();setTimeout(()=>toast(`${icon('album')} ${t('newSticker')} ${albumCount()}/${ALBUM_SIZE}`),700);}
// Rush meter and Rush hour.
function addRush(amount){if(!run||rushActive())return;run.rushMeter=Math.min(100,run.rushMeter+amount);if(run.rushMeter>=100)startRush();renderRush();}
function startRush(){
  const now=Date.now();run.rushUntil=now+RUSH_MS;run.rushMeter=100;$('game').classList.add('rush');
  // Everyone waiting switches to the selected bus's country.
  const target=[getSelectedBus(),...bayBuses()].find(canBoard);if(target)for(const p of crowd)if(!p.special){p.dest=target.dest;p.until=Math.max(p.until,now+2500+Math.random()*2000);}
  goalProgress('rush');showShout(t('rushShout'));play('rush',1);play('station-open',.8);vibrate([30,40,30,40,60]);setMusicRate(1.14);renderCrowd();renderRush();}
function endRush(){run.rushUntil=0;run.rushMeter=0;$('game').classList.remove('rush');setMusicRate(timeLeft()<=10000?1.08:1);renderRush();}
function renderRush(now=Date.now()){if(!run)return;const active=rushActive(now),fill=active?(run.rushUntil-now)/RUSH_MS*100:run.rushMeter;
  $('rush-fill').style.width=`${Math.max(0,fill).toFixed(1)}%`;$('rush-meter').classList.toggle('active',active);$('rush-meter').classList.toggle('charged',!active&&run.rushMeter>=75);}
// Magnet: boards every matching traveler on screen as one rising chain (skips groups that would not fit).
function magnetPull(bus){
  const ids=crowd.filter(p=>!p.special&&p.dest===bus.dest).map(p=>p.id);let delay=90;
  for(const id of ids){setTimeout(()=>{const p=crowd.find(x=>x.id===id),b=getSelectedBus();if(mode!=='play'||!p||!canBoard(b)||b.id!==bus.id||p.dest!==b.dest||(p.size||1)>CAPACITY-b.passengers)return;tapTraveler(id);},delay);delay+=75;}}
// Mystery gift: coins on the bus (mostly small, sometimes big) or one of the power specials.
function openGift(bus,tag){
  const roll=Math.random();
  if(roll<.15)return {kind:'magnet'};if(roll<.28)return {kind:'golden'};if(roll<.4)return {kind:'rush'};
  const amount=[100,150,200,300,500,1000][Math.min(5,Math.floor(Math.random()**1.8*6))];bus.revenue+=amount;return {amount};}
function groupDoesNotFit(traveler,bus){
  const loss=fareFor(currentStation,bus.dest)*traveler.size;bus.revenue=Math.max(0,bus.revenue-loss);
  const tag=document.querySelector(`[data-traveler="${traveler.id}"]`)?.getBoundingClientRect();
  resetCombo();crowd=crowd.filter(p=>p.id!==traveler.id);launchVanish(traveler.id);burstAt(tag,'#ff4b4b',12,true);
  if(tag)floatText(tag.left+tag.width/2,tag.top,`−${coins(loss)} · ${t('wontFit',traveler.size)}`,'loss');
  kickBus(bus.id,{yaw:.75,roll:-.2});const busTag=document.querySelector(`[data-bus="${bus.id}"]`);busTag?.classList.remove('nope');void busTag?.offsetWidth;busTag?.classList.add('nope');
  renderBuses();renderCrowd();upsetTravelers('misfit',t('didntFit',traveler.size));}
function tapTraveler(id){
  if(mode!=='play')return;const traveler=crowd.find(p=>p.id===id),bus=getSelectedBus(),now=Date.now();if(!traveler)return;
  if(!canBoard(bus)||(!traveler.special&&traveler.dest!==bus.dest)){const tag=document.querySelector(`[data-traveler="${id}"]`);tag?.classList.remove('nope');void tag?.offsetWidth;tag?.classList.add('nope');return;}
  const size=traveler.size||1;if(size>CAPACITY-bus.passengers)return groupDoesNotFit(traveler,bus);
  // Combo: fares go on the bus; the combo multiplier (+0.25 every COMBO_STEP boardings, ×2 per VIP, up to ×4) is added to those buses when it ends.
  if(combo.count&&now-combo.last>run.cfg.combo&&now>combo.frozenUntil)endCombo();
  combo.count++;combo.last=now;const special=traveler.special,fare=fareFor(currentStation,bus.dest);
  if(special==='vip')combo.vip*=2;
  // Rush hour pays double; a perfect fit pays the group twice plus 5 extra fares.
  const fares=fare*size*(rushActive(now)?2:1),perfect=size>1&&bus.passengers+size===CAPACITY,bonus=perfect?fares+fare*PERFECT_FIT_FARES:0,share=combo.byBus[bus.id]??={fares:0,bonus:0};share.fares+=fares;share.bonus+=bonus;
  combo.fares+=fares;combo.bonus+=bonus;bus.revenue+=fares+bonus;bus.passengers+=size;
  crowd=crowd.filter(p=>p.id!==id);
  const tag=document.querySelector(`[data-traveler="${id}"]`)?.getBoundingClientRect();
  if(special==='heart'){if(run.mood<MOOD_MAX){run.mood=Math.min(MOOD_MAX,run.mood+MOOD_SMILE);bump($('mood'));renderMood();}else{bus.revenue+=40;}}
  // Special effects (a mystery gift can turn into one of the power specials).
  let effect=special,giftCoins=0;if(special==='gift'){const gift=openGift(bus);if(gift.kind)effect=gift.kind;else giftCoins=gift.amount;}
  if(effect==='golden'){bus.golden=true;showShout(t('goldenShout'));}
  else if(effect==='magnet'){showShout(t('magnetShout'));setTimeout(()=>magnetPull(bus),60);}
  else if(effect==='rush')startRush();
  else if(effect==='vip')showShout(t('vipShout'));
  addRush(special?RUSH_SPECIAL:RUSH_PER_SEAT*size+(perfect?RUSH_PERFECT:0));
  if(special){goalProgress('specials');addSticker(special,currentStation);}if(perfect)goalProgress('perfect');
  burstAt(tag,special?SPECIAL_CSS[special]:'#58cc02',special?14:5,!!special);
  const level=Math.min(4,Math.floor(combo.count/COMBO_STEP));
  if(tag)floatText(tag.left+tag.width/2,tag.top,special?`${icon(SPECIALS[effect].icon)} ${t('specials')[effect]}${giftCoins?' +'+coins(giftCoins):''}`:`+${coins(fares)}${size>1?` · ${t('seats',size)}`:''}${comboMultiplier()>1?`<em>×${comboMultiplier()}</em>`:''}`,special||`lvl${level}`);
  const shout=perfect?t('perfect'):special?null:t('shouts')[combo.count];if(shout)showShout(shout);
  // The fare flies into the bus right away.
  if(tag)coinsToBus([tag.left+tag.width/2,tag.top],bus.id,size>1||special?3:1);
  if(perfect){perfectFit(bus);}
  launchBoardingAnimation(id,bus.id,size,special);
  playComboNote(combo.count);for(let i=1;i<size;i++)play(POPS[i%POPS.length],.8,1.05+i*.14,i*.05);if(perfect){play('gift',.8);play('combo',.7,1.1);playCash(600,.4);}if(special)play(SPECIALS[special].sound,.9);if(combo.count%COMBO_STEP===0)playStepUp(combo.count/COMBO_STEP);
  if(bus.passengers>=CAPACITY){play('bus-full',.8);vibrate(35);setTimeout(()=>kickBus(bus.id,{y:.85,roll:-.25}),300);}else vibrate(special?[15,40,15]:10);
  renderBuses();renderCrowd();renderHud();renderCombo();}

// ---------------------------------------------------------------------------------------------------------------
// Combo: money earned while the combo lasts is multiplied when it ends; the extra goes onto the buses that earned it.
// ---------------------------------------------------------------------------------------------------------------
const combo={count:0,last:0,fares:0,bonus:0,vip:1,frozenUntil:0,byBus:{}};
// Every COMBO_STEP boardings add +0.25 and each VIP doubles it, up to COMBO_CAP.
const COMBO_CAP=4,comboMultiplier=()=>Math.min(COMBO_CAP,(1+.25*Math.floor(combo.count/COMBO_STEP))*combo.vip);
const comboWorth=()=>Math.round((combo.fares+combo.bonus)*comboMultiplier());
function resetCombo(){Object.assign(combo,{count:0,last:0,fares:0,bonus:0,vip:1,frozenUntil:0,byBus:{}});}
function endCombo(){
  if(!combo.count)return;const count=combo.count,mult=comboMultiplier(),shares=combo.byBus;resetCombo();
  goalProgress('combo',count,true);if(run&&count>run.bestCombo)run.bestCombo=count;if(count>game.bestCombo){game.bestCombo=count;save();}
  let payout=0;const targets=[];
  for(const [id,share] of Object.entries(shares)){const extra=Math.round(share.fares*(mult-1)+share.bonus*mult),bus=run?.buses.find(b=>b.id===Number(id));if(!bus||extra<=0)continue;
    if(bus.payout>0)bus.payout+=extra;else bus.revenue+=extra;payout+=extra;targets.push(bus.id);}
  // No banner: the combo badge pops, shows the extra, and its coins fly from the badge to the buses.
  if(payout>0){renderBuses();const badge=$('mult-badge'),box=badge.getBoundingClientRect(),from=rectCentre(box);bump(badge);floatText(from[0],box.bottom+34,`+${bulk(payout)}`,'cash');for(const id of targets)coinsToBus(from,id);play('combo',.8);playCash(payout,0);vibrate([20,40,20]);}
  renderCombo();}

// ---------------------------------------------------------------------------------------------------------------
// Mood, time and the goal
// ---------------------------------------------------------------------------------------------------------------
function upsetTravelers(kind,reason){
  if(mode!=='play')return;const hit=Math.round(MOOD_HIT[kind]*(1-.2*game.upgrades.mood));run.mood=Math.max(0,run.mood-hit);
  play('error',.9);play('lost',.8);vibrate([70,40,70]);toast(`${icon(moodState(run.mood)[2])} ${reason} · ${t('moodMinus',hit)}`,'error-soft');
  const meter=$('mood');meter.classList.remove('hurt');void meter.offsetWidth;meter.classList.add('hurt');renderHud();
  if(!run.mood)finishRun(false,'mood');}
// Winning unlocks the next level and records the stars; money only ever comes from claiming buses (kept win or lose).
function finishRun(won,reason='time'){
  if(mode!=='play')return;endCombo();run.remaining=timeLeft();mode='over';crowd=[];renderCrowd();
  const stars=won?moodStars(run.mood):0;game.mood=run.mood;
  if(won){game.stars[run.n]=Math.max(game.stars[run.n]||0,stars);if(game.level===run.n)game.level++;goalProgress('levels');}
  save();run.result={won,reason,stars};
  stopMusic(.25);setTimeout(()=>{if(mode==='over')setMusic('menu');},6000);
  if(won){play('win',.8);playCash(2000,.4);vibrate([40,60,40,60,120]);}else{play('lose',.8);vibrate([200]);}
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
    if(second===10)hurryMusic();
    if(second<=10&&second>0)play('tick',second<=5?.9:.5,second<=5?1.3:1);else if(run.buses.some(b=>b.payout>0&&b.claimBy-now<3200&&b.claimBy>now))play('tick',.7);}
  if(left<=0){finishRun(run.earned>=run.cfg.target);return;}
  const before=crowd.length;for(const p of crowd)if(now>=p.until)launchVanish(p.id);crowd=crowd.filter(p=>now<p.until);if(crowd.length!==before)crowdChanged=true;
  if(run.rushUntil&&now>=run.rushUntil){endRush();crowdChanged=true;}
  // During Rush hour everyone waiting follows whichever bus can board now (a full bus hands over to the next one).
  if(rushActive(now)){const target=[getSelectedBus(),...bayBuses()].find(canBoard);if(target)for(const p of crowd)if(!p.special&&p.dest!==target.dest){p.dest=target.dest;crowdChanged=true;}}
  if(now>=run.nextSpecialAt){if(spawnSpecial(now)){run.nextSpecialAt=now+6000+Math.random()*4000;crowdChanged=true;}else run.nextSpecialAt=now+500;}
  // Waves: the spawn pace swings between a surge and a lull every 9 s; Rush hour doubles it.
  const wave=1+.55*Math.sin((now-run.started)/9000*Math.PI*2),every=run.cfg.spawn*wave*(rushActive(now)?.5:1);
  if(now-lastSpawn>=every){lastSpawn=now;for(let i=Math.random()<.35?2:1;i>0;i--)if(spawnTraveler(now))crowdChanged=true;}
  if(busesChanged){syncSelectedBus();renderBuses();}
  if(busesChanged||crowdChanged)renderCrowd();
  if(busesChanged||second!==lastHudSecond)renderHud();}

// ---------------------------------------------------------------------------------------------------------------
// Flow: home → intro (goal, 3-2-1) → play → result; pause at any time.
// ---------------------------------------------------------------------------------------------------------------
function setMode(next){mode=next;$('game').dataset.mode=next;}
function goHome(){if(run){endCombo();homePick=Math.min(game.level,run.n+(run.result?.won?1:0));}setMusic('menu');prepareRun(homePick??game.level);setMode('home');clearBoardingAnimations();buildStatic();renderBuses();renderCrowd();renderHud();showOverlay('home');}
function openLevel(n){closeSheet();prepareRun(n);setMode('intro');clearBoardingAnimations();buildStatic();setMusic('menu');renderBuses();renderCrowd();renderHud();showOverlay('intro');}
function startCountdown(){
  closeSheet();hideOverlay();let count=3;const el=document.createElement('div');el.className='countdown';floatLayer.appendChild(el);
  setMusic('play');
  const step=()=>{el.textContent=count||t('go');el.classList.remove('pop');void el.offsetWidth;el.classList.add('pop');
    if(count){play('note',.9,1);play('tick',.5,1.2);count--;setTimeout(step,650);}
    else{play('note',.9,2);play('station-open');play('depart',.5,1.4);setTimeout(()=>el.remove(),600);beginPlay();}};
  step();}
function beginPlay(){setMode('play');run.endsAt=Date.now()+run.remaining;if(!run.started){run.started=Date.now();run.nextSpecialAt=Date.now()+3000;if(game.rushBonus){const bonus=game.rushBonus;game.rushBonus=0;save();if(bonus>=100)setTimeout(()=>{if(mode==='play'){toast(`${icon('trophy')} ${t('bonusRush')}`,'claim');startRush();}},700);else run.rushMeter=bonus;}}lastSpawn=0;for(let i=0;i<8;i++)spawnTraveler(Date.now());syncSelectedBus();renderBuses();renderCrowd();renderHud();}
// Pausing freezes the level: on resume every deadline moves forward by the paused time; waiting travelers leave.
function pause(){if(mode!=='play')return;duckMusic(.35);run.pausedAt=Date.now();run.remaining=timeLeft();endCombo();setMode('paused');crowd=[];renderCrowd();showOverlay('pause');}
function resume(){
  if(mode!=='paused')return;const delta=Date.now()-run.pausedAt;
  for(const bus of run.buses){if(bus.status==='trip')bus.arrival+=delta;if(bus.payout>0)bus.claimBy+=delta;}
  run.nextSpecialAt+=delta;run.started+=delta;if(run.rushUntil)run.rushUntil+=delta;
  hideOverlay();setMode('play');run.endsAt=Date.now()+run.remaining;renderBuses();renderHud();duckMusic(1);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();if(audioCtx)audioCtx.suspend().catch(()=>{});}else backToForeground();});
addEventListener('pageshow',e=>{if(e.persisted)backToForeground();});
// Fast tapping must never zoom the page: block iOS pinch gestures and double-tap zoom (CSS touch-action covers the rest).
for(const type of ['gesturestart','gesturechange','dblclick'])document.addEventListener(type,e=>e.preventDefault(),{passive:false});

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
// Coins fly onto a bus label (only a visual: the money is already on that bus).
function coinsToBus([x,y],busId,count=4){const tag=document.querySelector(`[data-bus="${busId}"]`);if(tag)flyTo(x,y,tag,'coin-flyer',icon('coin-diagonal'),count,()=>{});}
// Perfect fit: the bus flashes gold and hops, with a coin burst.
function perfectFit(bus){const tag=document.querySelector(`[data-bus="${bus.id}"]`);if(tag){tag.classList.remove('perfect');void tag.offsetWidth;tag.classList.add('perfect');burstAt(tag.getBoundingClientRect(),'#ffc800',22,true);}
  setTimeout(()=>{kickBus(bus.id,{y:1.1,roll:.3});burstCoins(busModel(bus.id),800);},120);vibrate([20,30,20,30,40]);}
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
  if(!active){if(shownCombo!==-1){shownCombo=-1;$('mult-label').textContent=t('combo');}return;}
  if(shownCombo!==combo.count){shownCombo=combo.count;$('mult-label').innerHTML=`${t('combo')} ${combo.count} · ${shortCoins(comboWorth())}`;}
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
  flyTo(x,y,coinTarget(),'coin-flyer',icon('coin-diagonal'),count,()=>{coinsInFlight-=amount-released;},()=>{released+=share;coinsInFlight-=share;});}
function pendingClaims(id){return run.buses.filter(b=>b.status==='idle'&&b.location===id&&b.payout>0);}
const secondsLeft=claims=>Math.max(0,Math.ceil(Math.min(...claims.map(b=>b.claimBy-Date.now()))/1000));
const clock=ms=>{const s=Math.ceil(ms/1000);return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};
function renderHud(){
  if(!run)return;renderRush();const now=Date.now();lastHudSecond=Math.floor(now/1000);
  renderMood();
  const left=timeLeft();$('timer-text').textContent=clock(left);$('timer').classList.toggle('low',left<=10000&&mode==='play');
  $('goal-level').textContent=run.n;$('goal-card').setAttribute('aria-label',t('levelCaps',run.n));renderGoal();
  $('mult-boost').innerHTML=`${t('goalShort')} ${shortCoins(run.cfg.target)}`;
  renderClaimsBar(now);renderStationTabs();}
// Money waiting: a gold pill per bus holding fares at another station (flag, amount, seconds, draining bar); tap one
// to jump there. Pills are keyed by bus and updated in place: only a new arrival pops in, nothing re-animates.
// The bar keeps its height when empty so the station view never shifts.
function renderClaimsBar(now){
  const bar=$('claims-bar'),total=run.cfg.claim,waiting=run.buses.filter(b=>b.status==='idle'&&b.payout>0&&b.location!==currentStation).sort((a,b)=>a.claimBy-b.claimBy);
  const keep=new Set(waiting.map(b=>String(b.id)));
  for(const pill of bar.querySelectorAll('.claim-pill'))if(!keep.has(pill.dataset.bus))pill.remove();
  if(!waiting.length)return;
  for(const b of waiting){const left=Math.max(0,b.claimBy-now),seconds=`${Math.ceil(left/1000)}s`;let pill=bar.querySelector(`[data-bus="${b.id}"]`);
    if(!pill){pill=document.createElement('button');pill.className='claim-pill';pill.dataset.bus=b.id;pill.dataset.station=b.location;
      pill.innerHTML=`${flagMarkup(b.location,'claim-flag')}<b>${bulk(b.payout)}</b><span class="claim-secs"></span><i style="animation-duration:${total}ms;animation-delay:-${total-left}ms"></i>`;bar.append(pill);}
    pill.classList.toggle('hurry',left<4000);const span=pill.querySelector(".claim-secs");if(span.textContent!==seconds)span.textContent=seconds;
    pill.setAttribute('aria-label',`${num(b.payout)} coins waiting in ${city[b.location].name}, ${seconds}`);}}
// Station tabs: one per station of the level, with its parked buses and any fares waiting to be claimed there.
// Rebuilt only when the level's stations change; otherwise just their classes and counts are updated.
function renderStationTabs(){
  const nav=$('station-tabs'),ids=stationsInRun();
  if(nav.dataset.ids!==ids.join()){nav.dataset.ids=ids.join();nav.innerHTML=ids.map(id=>`<button class="station-tab" data-station="${id}">${flagMarkup(id,'tab-flag')}<b>${city[id].name}</b><small></small></button>`).join('');}
  for(const tab of nav.children){const id=tab.dataset.station,claims=pendingClaims(id),parked=run.buses.filter(b=>b.status==='idle'&&b.location===id).length;
    tab.classList.toggle('here',id===currentStation);tab.classList.toggle('alert',!!claims.length&&id!==currentStation);
    const small=claims.length?`${icon('coin-diagonal')} ${secondsLeft(claims)}s`:`${icon('bus')} ${parked}`,line=tab.querySelector('small');if(line.innerHTML!==small)line.innerHTML=small;
    tab.setAttribute('aria-label',`${city[id].name}: ${parked} buses${claims.length?`, ${claims.length} to claim`:''}`);}}
// Mood meter: one face, coloured from the bottom up to the mood and grey above; its expression and colour follow the
// mood (very happy green → happy lime → indifferent gold → worried orange → crying red).
function renderMood(){
  const meter=$('mood'),mood=run.mood,[,state,face]=moodState(mood);meter.dataset.state=state;
  if(meter.dataset.face!==face){meter.dataset.face=face;meter.querySelector('.mood-face').style.setProperty('--i',`url(./icons/${face}.svg)`);}
  meter.style.setProperty('--level',`${mood}%`);meter.setAttribute('aria-label',`Travelers' mood ${Math.round(mood)} of ${MOOD_MAX}`);}
// Goal bar: money claimed this level against the target (rolls up as coins land).
let shownEarned=0;
function renderGoal(){const target=run.cfg.target,value=Math.min(target,shownEarned);$('goal-fill').style.width=`${Math.min(100,value/target*100).toFixed(1)}%`;const text=`${shortNum(value)}/${shortNum(target)}`;if($('goal-text').innerHTML!==text)$('goal-text').innerHTML=text;$('goal-card').classList.toggle('done',run.earned>=target);}

// Overlays: one card at a time over the live 3D station.
function hideOverlay(){$('overlay').classList.add('hidden');}
// Level details: time, buses and stations as three tiles with large icons, then the coin goal as a full-width gold bar.
function levelChips(cfg){return `<div class="level-stats"><span class="stat blue">${icon('timer')}<b>${t('sec',cfg.duration/1000)}</b><small>${t('time')}</small></span><span class="stat orange">${icon('bus')}<b>${cfg.buses}</b><small>${t('buses')}</small></span><span class="stat green">${icon('pin')}<b>${cfg.stations.length}</b><small>${t('stations')}</small></span></div>
  <div class="level-goal">${icon('coin-diagonal','goal-coin')}<span><small>${t('goal')}</small><b>${num(cfg.target)}</b></span></div>`;}
const starsMarkup=(count,className='')=>`<span class="stars ${className}">${[0,1,2].map(i=>icon('star',i<count?'star on':'star off')).join('')}</span>`;
function showOverlay(kind){
  const card=$('overlay-card'),cfg=run.cfg;$('overlay').classList.remove('hidden');$('overlay').dataset.kind=kind;
  if(kind==='home'){
    homePick=Math.min(homePick??game.level,game.level);const path=Array.from({length:game.level+3},(_,i)=>i+1);
    card.innerHTML=`<div class="home-brand"><span class="brand-logo" role="img" aria-label="SouSou Bus">${brandLogo}</span><button class="icon-btn trophy-btn${ensureDaily().goals.every(g=>g.done)?' complete':''}" id="goals-btn" aria-label="${t('goalsTitle')}">${icon('trophy')}${ensureDaily().goals.some(g=>g.done&&!g.seen)?'<span class="dot"></span>':''}</button><button class="icon-btn music-btn" id="music-btn" aria-label="${musicOn?'Turn music off':'Turn music on'}">${musicIcon()}</button><div class="coin-pill" id="home-coins">${icon('coin-diagonal','coin-ico')}<strong>${Math.round(shownCoins).toLocaleString('en-US')}</strong></div></div>
      <div class="level-path" id="level-path">${path.map(n=>`<button class="path-node${n===homePick?' picked':''}${n===game.level?' next':''}${n>game.level?' locked':''}" data-level="${n}" ${n>game.level?'disabled':''}><b>${n>game.level?icon('lock'):n}</b>${n<=game.level?starsMarkup(game.stars[n]||0,'tiny'):''}</button>`).join('')}</div>
      <div class="level-card" id="level-card">${levelCardMarkup(homePick)}</div>
      <button class="btn green big" id="play-btn">${icon('play')} ${t('play')}</button>
      <div class="home-tools"><button class="btn purple${affordableBoosters()?' ready':''}" id="boosters-btn">${icon('boost')} ${t('boosters')}${affordableBoosters()?`<span class="ready-text">${t('ready',affordableBoosters())}</span><span class="badge">${affordableBoosters()}</span>`:''}</button><button class="btn blue" id="howto-btn">${icon('help')} ${t('howToPlay')}</button></div>
      <div class="home-meta"><span class="home-best">${icon('crown')} ${t('bestCombo')} ${game.bestCombo||0}</span></div>
      <div class="home-foot"><button class="lang-btn" id="lang-btn">${icon('globe')} ${LANG_CODES[lang]}</button><button class="reset-btn" id="reset-btn">${icon('retry')} ${t('reset')}</button></div>`;
    setupLevelPath();}
  else if(kind==='intro'){
    card.innerHTML=`<small class="eyebrow">${t('shift',run.n)}</small><h1>${t('level',run.n)}</h1>${levelChips(cfg)}
      <div class="overlay-actions"><button class="btn green big" id="start-btn">${icon('play')} ${t('start')}</button><button class="btn ghost" id="howto-btn" aria-label="How to play">${icon('help')}</button><button class="btn ghost" id="home-btn" aria-label="Home">${icon('home')}</button></div>`;
    if(run.n===1&&!game.stars[1]&&!sheetSeen){sheetSeen=true;setTimeout(()=>{if(mode==='intro'&&!$('overlay').classList.contains('hidden'))openSheet('howto');},350);}}
  else if(kind==='pause'){
    card.innerHTML=`<small class="eyebrow">${t('levelCaps',run.n)}</small><h1>${t('paused')}</h1><p class="pause-goal">${t('pauseGoal',bulk(run.earned),bulk(cfg.target),clock(run.remaining))}</p>
      <div class="overlay-actions column"><button class="btn green big" id="resume-btn">${icon('play')} ${t('resume')}</button><button class="btn orange" id="restart-btn">${icon('retry')} ${t('restart')}</button><button class="btn ghost" id="home-btn">${icon('home')} ${t('home')}</button><button class="btn ghost" id="music-btn">${musicIcon()} ${t(musicOn?'musicOn':'musicOff')}</button></div>`;}
  else{const r=run.result,pct=Math.min(100,Math.round(run.earned/cfg.target*100));
    card.innerHTML=r.won?`<small class="eyebrow">${t('levelCaps',run.n)}</small><h1 class="win">${t('won')}</h1>${starsMarkup(r.stars,'big reveal')}
        <div class="result-stats"><div><strong>${bulk(run.earned)}</strong><span>${t('claimed')}</span></div><div><strong>${run.bestCombo}</strong><span>${t('bestComboLow')}</span></div><div><strong>${clock(run.remaining)}</strong><span>${t('toSpare')}</span></div></div>
        <div class="result-bonus chip gold">${run.replay?`${icon('star')} ${t('replayNoCoins')}`:t('added',bulk(run.paid))}</div>
        <div class="overlay-actions"><button class="btn green big" id="next-btn">${t('nextLevel')} ${icon(lang==='ar'?'left':'right')}</button><button class="btn ghost" id="home-btn">${icon('home')}</button></div>`
      :`<small class="eyebrow">${t('levelCaps',run.n)}</small><h1 class="lose">${t(r.reason==='mood'?'loseMood':'loseTime')}</h1>
        <div class="goal-track big"><i style="width:${pct}%"></i></div><p class="pause-goal">${t('ofPct',bulk(run.earned),bulk(cfg.target),pct)}</p>
        <p class="intro-hint">${t(r.reason==='mood'?'tipMood':'tipTime')}</p>
        <p class="kept">${run.replay?t('keptReplay'):t('kept',bulk(run.paid))}</p>
        <div class="overlay-actions"><button class="btn orange big" id="retry-btn">${icon('retry')} ${t('retry')}</button><button class="btn ghost" id="home-btn">${icon('home')}</button></div>`;
    if(r.won)card.querySelectorAll('.stars.reveal .star').forEach((star,i)=>setTimeout(()=>{star.classList.add('shown');if(star.classList.contains('on')){play('ping',.8,1+i*.25);play('vip',.6,1+i*.15);}},500+i*350));}}
// Game logo: the SVG file is inlined so its lettering can fall back to the page font on phones without Arial Black.
let brandLogo='';fetch(`./sousoubus-logo-outlined.svg?v=${BUILD}`).then(r=>r.ok?r.text():'').then(svg=>{brandLogo=svg.slice(Math.max(0,svg.indexOf('<svg')));for(const el of document.querySelectorAll('.brand-logo'))el.innerHTML=brandLogo;}).catch(()=>{});
// Home level picker: dragging the strip only scrolls it; tapping a level picks it and brings it to the middle.
let homePick=null;
function levelCardMarkup(n){const done=n<game.level;
  return `<small>${t(done?'replay':'nextShift')}</small><h1>${t('level',n)}</h1>${starsMarkup(game.stars[n]||0,'small')}${levelChips(levelConfig(n))}`;}
function pickLevel(n,scroll){
  n=Math.max(1,Math.min(game.level,n));const path=$('level-path');if(!path)return;
  if(n!==homePick){homePick=n;vibrate(6);
    for(const node of path.children)node.classList.toggle('picked',Number(node.dataset.level)===n);
    $('level-card').innerHTML=levelCardMarkup(n);}
  if(scroll){const node=path.querySelector(`[data-level="${n}"]`);path.scrollTo({left:node.offsetLeft+node.offsetWidth/2-path.clientWidth/2,behavior:scroll==='instant'?'instant':'smooth'});}}
function setupLevelPath(){
  const path=$('level-path');pickLevel(homePick,'instant');
  // Mouse: drag the strip like a finger would (touch scrolls natively).
  path.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;pathDrag={path,x:e.clientX,left:path.scrollLeft,moved:false};path.classList.add('dragging');});
  // A drag must not count as a tap on the level under the pointer.
  path.addEventListener('click',e=>{if(pathMoved){e.stopPropagation();pathMoved=false;}},{capture:true});}
let pathDrag=null,pathMoved=false;
addEventListener('pointermove',e=>{if(!pathDrag)return;const dx=e.clientX-pathDrag.x;if(Math.abs(dx)>5)pathDrag.moved=true;pathDrag.path.scrollLeft=pathDrag.left-dx;});
addEventListener('pointerup',()=>{if(!pathDrag)return;const {path,moved}=pathDrag;pathDrag=null;pathMoved=moved;path.classList.remove('dragging');});
// One line about what makes this level different.
// Reset progress: a second tap within 3 s wipes coins, levels, stars, boosters and mood, and starts again at level 1.
let resetArmed=0;
function resetProgress(button){
  if(Date.now()-resetArmed>3000){resetArmed=Date.now();button.classList.add('armed');button.innerHTML=`${icon('retry')} ${t('resetConfirm')}`;
    setTimeout(()=>{if(Date.now()-resetArmed>=3000&&button.isConnected){button.classList.remove('armed');button.innerHTML=`${icon('retry')} ${t('reset')}`;}},3050);return;}
  resetArmed=0;for(const key of Object.keys(game))delete game[key];Object.assign(game,freshGame());save();shownCoins=0;homePick=null;run=null;goHome();}
// Bottom sheets (boosters, how to play) slide up over the home or intro card; tap outside or × to close.
let sheetKind=null,sheetSeen=false,howTab=0;
const affordableBoosters=()=>Object.keys(UPGRADES).filter(key=>game.upgrades[key]<upgradeMax(key)&&game.coins>=upgradeCost(key,game.upgrades[key])).length;
function sheetMarkup(kind){
  if(kind==='boosters')return `<div class="sheet-head"><h2>${icon('boost')} ${t('boostersTitle')}</h2><div class="coin-pill">${icon('coin-diagonal','coin-ico')}<strong>${Math.round(game.coins).toLocaleString('en-US')}</strong></div><button class="icon-btn" id="sheet-close" aria-label="Close">${icon('close')}</button></div>
    <p class="sheet-sub">${t('boostersSub')}</p>
    <div class="shop">${Object.entries(UPGRADES).map(([key,u])=>{const level=game.upgrades[key],max=level>=upgradeMax(key),cost=upgradeCost(key,level);
      return `<div class="shop-item"><span class="shop-art">${icon(u.icon)}</span><span class="shop-text"><b>${t('up')[key][0]} <em>${level}/${upgradeMax(key)}</em></b><small>${level?t('up')[key][1](level):t('notOwned')}${max?'':` · <i>${t('next',t('up')[key][2])}</i>`}</small></span><button class="btn ${max?'locked':game.coins>=cost?'green':'locked'}" data-upgrade="${key}" ${max||game.coins<cost?'disabled':''}>${max?t('max'):shortCoins(cost)}</button></div>`;}).join('')}</div>`;
  return `<div class="sheet-head"><h2>${icon('help')} ${t('howTitle')}</h2><button class="icon-btn" id="sheet-close" aria-label="Close">${icon('close')}</button></div>
    <div class="how-tabs">${t('howTabs').map((label,i)=>`<button class="how-tab${(howTab===i)?' on':''}" data-howtab="${i}">${label}</button>`).join('')}</div>
    ${howTab===0?`<ol class="how">${['bus','swipe','play','coin-diagonal',MOOD_FACE].map((name,i)=>`<li${i===4?' class="mood-step"':''}>${icon(name)}<span>${t('how')[i]}</span></li>`).join('')}</ol>
    <ul class="how-tips"><li>${icon('star')} ${t('tips')[0]}</li></ul>`
    :`<ul class="special-list">${Object.entries(SPECIALS).map(([kind,sp])=>`<li><span class="special-chip" style="--c:${SPECIAL_CSS[kind]}">${icon(sp.icon)}</span><span><b>${t('specials')[kind].split(' · ')[0]}</b><small>${t('specialInfo')[kind]}</small></span></li>`).join('')}</ul>
    <p class="specials-note">${icon('flash')} ${t('specialsNote')}</p>`}
    <button class="btn green big" id="sheet-ok">${t('gotIt')}</button>`;}
function langSheetMarkup(){return `<div class="sheet-head"><h2>${icon('globe')} ${t('language')}</h2><button class="icon-btn" id="sheet-close" aria-label="Close">${icon('close')}</button></div>
  <div class="lang-list">${Object.entries(LANGS).map(([code,name])=>`<button class="btn ${code===lang?'green':'ghost'} lang-option" data-lang="${code}" lang="${code}">${name}</button>`).join('')}</div>`;}
function setLanguage(code){if(!LANGS[code]||code===lang){closeSheet();return;}lang=code;try{localStorage.setItem('souha-lang',code);}catch{}applyLanguage();
  for(const tag of tagElements.values())tag.sig=null;$('station-tabs').dataset.ids='';$('mult-label').textContent=t('combo');shownCombo=-1;closeSheet();renderBuses();renderHud();showOverlay($('overlay').dataset.kind);}
function goalsSheetMarkup(){const daily=ensureDaily(),stations=STATIONS;
  return `<div class="sheet-head"><h2>${icon('trophy')} ${t('goalsTitle')}</h2><button class="icon-btn" id="sheet-close" aria-label="Close">${icon('close')}</button></div>
  <p class="sheet-sub">${t('goalsSub')}</p>
  <div class="goal-list">${daily.goals.map(g=>`<div class="goal-row${g.done?' done':''}"><span class="goal-check">${icon(g.done?'star':'trophy')}</span><span class="goal-body"><b>${t('goalText')[g.kind](g.target)}</b><span class="goal-bar"><i style="width:${g.progress/g.target*100}%"></i></span></span><em>${g.progress}/${g.target}</em></div>`).join('')}</div>
  <h3 class="album-title">${icon('album')} ${t('albumTitle')} <em>${albumCount()}/${ALBUM_SIZE}</em></h3><p class="sheet-sub">${t('albumSub')}</p>
  <div class="album-grid" style="--cols:${stations.length}">${Object.entries(SPECIALS).map(([kind,sp])=>`<span class="album-kind" style="--c:${SPECIAL_CSS[kind]}">${icon(sp.icon)}</span>${stations.map(st=>{const got=(game.album?.[kind]||[]).includes(st.id);return `<span class="sticker${got?' got':''}" style="--c:${SPECIAL_CSS[kind]}">${flagMarkup(st.id,'sticker-flag')}</span>`;}).join('')}`).join('')}</div>`;}
function openSheet(kind,tab=0){sheetKind=kind;if(kind==='howto')howTab=tab;$('sheet-panel').innerHTML=kind==='lang'?langSheetMarkup():kind==='goals'?goalsSheetMarkup():sheetMarkup(kind);$('sheet').classList.remove('hidden');$('sheet').dataset.kind=kind;}
function closeSheet(){sheetKind=null;$('sheet').classList.add('hidden');}
function buyUpgrade(key){const level=game.upgrades[key],cost=upgradeCost(key,level);if(level>=upgradeMax(key)||game.coins<cost)return;game.coins-=cost;shownCoins=game.coins;game.upgrades[key]++;save();play('purchase',.9);if(sheetKind==='boosters')$('sheet-panel').innerHTML=sheetMarkup('boosters');if(mode==='home'){prepareRun(homePick??game.level);showOverlay('home');}}
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
const shirtMats=Object.fromEntries([...STATIONS.map(s=>[s.id,material(s.shirt)]),...Object.entries(SPECIALS).map(([kind,sp])=>[kind,material(sp.color)])]);
const sharedMats=new Set([...Object.values(mats),...Object.values(shirtMats)]);
function put(group,geometry,mat,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function box(group,w,h,d,mat,x,y,z){return put(group,new THREE.BoxGeometry(w,h,d),mat,x,y,z);}
function disposeTree(object){object.traverse(o=>{if(o.geometry&&!o.geometry.userData.shared)o.geometry.dispose();if(o.material&&!sharedMats.has(o.material)&&!Array.isArray(o.material))o.material.dispose();});}
function clear(group){for(const child of [...group.children]){group.remove(child);disposeTree(child);}}
// ---------------------------------------------------------------------------------------------------------------
// Physics, with springs rather than an engine: every bus body rides a damped suspension (bounce, roll, pitch, yaw)
// that boardings, refusals, departures, braking and claims push; claimed buses burst coins that fall, spin and bounce;
// trees sway in a gusty breeze.
// ---------------------------------------------------------------------------------------------------------------
const SPRING={y:[260,11],roll:[150,6.5],pitch:[170,7.5],yaw:[320,9]},busSprings=new Map();
function kickBus(id,{y=0,roll=0,pitch=0,yaw=0}){let sp=busSprings.get(id);if(!sp)busSprings.set(id,sp={y:0,vy:0,roll:0,vroll:0,pitch:0,vpitch:0,yaw:0,vyaw:0});sp.vy+=y;sp.vroll+=roll;sp.vpitch+=pitch;sp.vyaw+=yaw;}
function stepBusSprings(dt,now){
  for(const [id,sp] of busSprings){let still=true;
    for(const key of ['y','roll','pitch','yaw']){const [stiff,damp]=SPRING[key],v='v'+key;sp[v]+=(-stiff*sp[key]-damp*sp[v])*dt;sp[key]+=sp[v]*dt;if(Math.abs(sp[key])>2e-4||Math.abs(sp[v])>2e-3)still=false;}
    if(still)busSprings.delete(id);}
  // Engines idle: a faint shiver on every parked bus, out of step with each other.
  const apply=g=>{const body=g.userData.body;if(!body)return;const id=g.userData.pick?.id,sp=busSprings.get(id),idle=Math.sin(now*.05+id*1.7)*.004;
    body.position.y=(sp?sp.y:0)+idle;body.rotation.set(sp?sp.pitch:0,sp?sp.yaw:0,sp?sp.roll:0);};
  for(const g of busGroup.children)apply(g);for(const effect of departureEffects)apply(effect.model);}
// Coins: gold discs thrown up out of a claimed bus; gravity, spin, a few damped bounces with a soft clink, then gone.
const coinGeometry=new THREE.CylinderGeometry(.15,.15,.04,16);coinGeometry.userData.shared=true;
const coinMaterial=new THREE.MeshLambertMaterial({color:0xffc83d,emissive:0x6b4500,flatShading:true});sharedMats.add(coinMaterial);
const coinBits=[];
function burstCoins(model,amount){
  if(!model)return;const count=Math.min(24,6+Math.round(Math.log10(Math.max(10,amount))*4)),origin=model.localToWorld(new THREE.Vector3(0,1.35,0)),born=performance.now();
  for(let i=0;i<count;i++){const coin=new THREE.Mesh(coinGeometry,coinMaterial),angle=Math.random()*Math.PI*2,speed=1+Math.random()*2.4;coin.castShadow=true;coin.position.copy(origin);coin.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);scene.add(coin);
    coinBits.push({coin,v:new THREE.Vector3(Math.cos(angle)*speed,4.6+Math.random()*3.2,Math.sin(angle)*speed*.6+1.1),spin:new THREE.Vector3((Math.random()-.5)*18,(Math.random()-.5)*12,(Math.random()-.5)*18),born:born+i*14,bounces:0});}}
function stepCoins(dt,now){
  for(let i=coinBits.length-1;i>=0;i--){const bit=coinBits[i],coin=bit.coin;if(now<bit.born){coin.visible=false;continue;}coin.visible=true;
    bit.v.y-=16*dt;coin.position.addScaledVector(bit.v,dt);coin.rotation.x+=bit.spin.x*dt;coin.rotation.y+=bit.spin.y*dt;coin.rotation.z+=bit.spin.z*dt;
    if(coin.position.y<.12&&bit.v.y<0){coin.position.y=.12;bit.v.y*=-.45;bit.v.x*=.72;bit.v.z*=.72;bit.spin.multiplyScalar(.55);if(!bit.bounces++&&i%3===0)play('ping',.05,2.5+Math.random()*.5);}
    const age=now-bit.born;if(age>1150){const k=1-(age-1150)/320;coin.scale.setScalar(Math.max(0,k));if(k<=0){scene.remove(coin);coinBits.splice(i,1);}}}}
// Wind: each tree crown sways on its own phase; gusts come and go.
const foliage=[];
function stepWind(now){const gust=.55+.45*Math.sin(now*.00031)*Math.sin(now*.00071+1);
  for(const leaf of foliage){const p=leaf.userData.sway,swing=Math.sin(now*.0016+p.phase)*gust;leaf.rotation.z=swing*.07;leaf.rotation.x=Math.sin(now*.0012+p.phase*1.3)*.04*gust;leaf.position.x=p.x+swing*.035;}}
function busModel(id){return busGroup.children.find(child=>child.userData.pick?.id===id)||departureEffects.find(effect=>effect.model.userData.pick?.id===id)?.model;}
function clearBoardingAnimations(){for(const effect of [...boardingEffects,...vanishEffects]){scene.remove(effect.model);disposeTree(effect.model);}boardingEffects.length=0;vanishEffects.length=0;}
function detachPerson(id){const model=crowdGroup.children.find(child=>child.userData.travelerId===id);if(!model)return null;crowdGroup.remove(model);scene.add(model);return model;}
// Screen position of a point on a 3D object.
function screenOf(object,local){const r=canvas.getBoundingClientRect(),p=object.localToWorld(local.clone()).project(camera);return [r.left+(p.x*.5+.5)*r.width,r.top+(-p.y*.5+.5)*r.height];}
// Boarding: a copy of the traveler's icon hops in an arc to the bus door, shrinking; when it lands the bus dips.
function launchBoardingAnimation(travelerId,busId,size=1,special=null){
  const tag=tagElements.get('t'+travelerId)?.el,bus=busModel(busId);if(!tag||!bus)return;const from=tag.getBoundingClientRect(),[tx,ty]=screenOf(bus,new THREE.Vector3(-.58,.55,1.18));
  const fly=document.createElement('div');fly.className='board-flyer '+tag.className.replace(/\bfaded\b|\bleaving\b/g,'');fly.innerHTML=tag.innerHTML;fly.style.left=from.left+from.width/2+'px';fly.style.top=from.top+from.height+'px';floatLayer.appendChild(fly);
  const dx=tx-(from.left+from.width/2),dy=ty-(from.top+from.height);
  fly.animate([{transform:'translate(-50%,-100%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${dx*.5}px),calc(-100% + ${dy*.5-46}px)) scale(.85)`,opacity:1,offset:.5},{transform:`translate(calc(-50% + ${dx}px),calc(-100% + ${dy}px)) scale(.35)`,opacity:0}],{duration:280,easing:'ease-in-out'}).onfinish=()=>fly.remove();
  setTimeout(()=>{const push=Math.sqrt(size)*(special?1.4:1);kickBus(busId,{y:-.7*push,roll:.62*push,pitch:.22*push});},260);}
// A traveler who gives up shrinks away in a blink.
function launchVanish(travelerId){const tag=tagElements.get('t'+travelerId)?.el;if(!tag)return;const r=tag.getBoundingClientRect(),ghost=document.createElement('div');ghost.className='tag-vanish '+tag.className;ghost.innerHTML=tag.innerHTML;ghost.style.left=r.left+r.width/2+'px';ghost.style.top=r.top+r.height+'px';floatLayer.appendChild(ghost);setTimeout(()=>ghost.remove(),200);}
function launchVisualDeparture(id){const model=busGroup.children.find(child=>child.userData.pick?.id===id);if(!model)return;for(const child of [...model.children])if(child.userData.selectionPad){model.remove(child);disposeTree(child);}kickBus(id,{pitch:-.75,y:.25});busGroup.remove(model);scene.add(model);departureEffects.push({model,started:performance.now(),x:model.position.x,lastSmoke:0});}
function emitDust(model,now){for(const side of [-1,1]){const p=model.localToWorld(new THREE.Vector3(side*.5,.12,1.2));const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(.13+Math.random()*.06,0),new THREE.MeshBasicMaterial({color:0xf3ead6,transparent:true,opacity:.75,depthWrite:false}));puff.position.copy(p);scene.add(puff);smokeEffects.push({puff,started:now,vx:side*-.6});}}
function emitSmoke(model,now){for(let i=0;i<3;i++){const p=model.localToWorld(new THREE.Vector3((i-1)*.35,.3,-1.68));const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(.17+Math.random()*.07,0),new THREE.MeshBasicMaterial({color:0xe5e9df,transparent:true,opacity:.72,depthWrite:false}));puff.position.copy(p);scene.add(puff);smokeEffects.push({puff,started:now,vx:(Math.random()-.5)*.5});}}
function tree(group,x,z,s=1){put(group,new THREE.CylinderGeometry(.1*s,.15*s,.78*s,6),mats.trunk,x,.4*s,z);const crown=put(group,new THREE.IcosahedronGeometry(.58*s,0),Math.random()>.5?mats.leaf:mats.leaf2,x,1.18*s,z);crown.userData.sway={x,phase:Math.random()*6.3};foliage.push(crown);}
function textTexture(text,color='#416358',background='#fff6e5'){const el=document.createElement('canvas');el.width=768;el.height=140;const cx=el.getContext('2d');cx.fillStyle=background;cx.fillRect(0,0,768,140);cx.fillStyle=color;cx.textAlign='center';cx.textBaseline='middle';cx.font='bold 76px Arial';cx.fillText(text,384,75);const texture=new THREE.CanvasTexture(el);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
function buildStatic(){
  clear(staticGroup);foliage.length=0;const sky=new THREE.Color(0xbbe3e5).lerp(new THREE.Color(city[currentStation].accent),.28);scene.background=sky;scene.fog.color=sky;
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
// Bus decal: the game logo (SOU / BUS) in white, drawn with the same lettering as sousoubus-logo.svg (redrawn once the
// page font has loaded, so phones without Arial Black match the logo on the home screen).
function logoTexture(){
  const el=document.createElement('canvas');el.width=400;el.height=244;const texture=new THREE.CanvasTexture(el);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
  const draw=()=>{const ctx=el.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,400,244);ctx.setTransform(2,0,0,2,0,0);
    ctx.font="900 72px 'Arial Black', Nunito, Impact, sans-serif";ctx.textAlign='center';if('letterSpacing' in ctx)ctx.letterSpacing='-4px';
    ctx.fillStyle=ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.lineJoin='round';for(const [text,y] of [['SOU',63],['BUS',115]]){ctx.strokeText(text,100,y);ctx.fillText(text,100,y);}texture.needsUpdate=true;};
  draw();document.fonts?.load("900 72px Nunito").then(draw).catch(()=>{});return texture;}
const busLogo=logoTexture();
// Low-poly Irizar i6 coach: flat-colour parts are named in the GLB and mapped to the game palette.
// Bus paint: the UI's vivid orange (#ff9600). It skips the scene's filmic tone mapping (which washes oranges out)
// and its base colour is scaled so lit sides come out at that orange on screen.
const busPaint=new THREE.MeshLambertMaterial({color:0xff9000,flatShading:true,toneMapped:false});sharedMats.add(busPaint);
const COACH_PARTS={Body:busPaint,Trim:mats.trim,Chrome:mats.wheelHub,Glass:mats.coachGlass,Lights:mats.cream,Tire:mats.wheel,Rim:mats.wheelHub};
let coachTemplate=null;
const coachTemplatePromise=new GLTFLoader().loadAsync(`./models/souha-bus.glb?v=${BUILD}`).then(gltf=>{const model=gltf.scene;model.scale.set(.325,.25,.25);model.traverse(o=>{if(!o.isMesh)return;o.material=COACH_PARTS[o.material.name]||mats.dark;o.geometry.userData.shared=true;o.castShadow=true;o.receiveShadow=true;});return model;}).catch(error=>{console.warn('SouSou Bus model failed to load; using the built-in coach.',error);return null;});
function addModelCoach(g){
  g.add(coachTemplate.clone());
  for(const side of [-1,1]){const brand=put(g,new THREE.PlaneGeometry(.6,.366),new THREE.MeshBasicMaterial({map:busLogo,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}),side*.475,.4,-.05);brand.rotation.y=side*Math.PI/2;brand.castShadow=false;}
  const frontBrand=put(g,new THREE.PlaneGeometry(.2,.122),new THREE.MeshBasicMaterial({map:busLogo,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}),0,.22,1.715);frontBrand.castShadow=false;
}
function coachPanel(group,points,mat){const geometry=new THREE.BufferGeometry(),vertices=[...points[0],...points[1],...points[2],...points[0],...points[2],...points[3]];geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return put(group,geometry,mat);}
function buildBus(bus,x,z){
  const g=new THREE.Group();g.position.set(x,.09,z);g.rotation.y=Math.PI/2;g.userData.pick={kind:'bus',id:bus.id};busGroup.add(g);
  const body=new THREE.Group();g.add(body);g.userData.body=body;
  if(coachTemplate)addModelCoach(body);else addBuiltInCoach(body);
  if(bus.id===selectedBus&&!bus.payout)addSelectionPad(g,0x6fdc9c,0x22b866);
  else if(bus.payout>0)addSelectionPad(g,0xffe08a,0xf2b705);
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
  const body=new THREE.ExtrudeGeometry(profile,{depth:1.08,bevelEnabled:false});body.rotateY(-Math.PI/2);body.translate(.54,0,0);put(g,body,busPaint);
  box(g,.99,.07,2.74,mats.orangeDark,0,1.25,-.08);
  coachPanel(g,[[-.46,1.15,1.51],[.46,1.15,1.51],[.47,.65,1.64],[-.47,.65,1.64]],mats.coachGlass);
  for(const side of [-1,1]){
    const xx=side*.555;box(g,.014,.4,2.55,mats.coachGlass,xx,.97,-.16);
    const brand=put(g,new THREE.PlaneGeometry(.6,.366),new THREE.MeshBasicMaterial({map:busLogo,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}),side*.575,.55,-.29);brand.rotation.y=side*Math.PI/2;brand.castShadow=false;
    for(const zz of [-1.08,.9]){const wheel=put(g,new THREE.CylinderGeometry(.22,.22,.09,14),mats.wheel,side*.6,.22,zz);wheel.rotation.z=Math.PI/2;}
  }
  const frontBrand=put(g,new THREE.PlaneGeometry(.2,.122),new THREE.MeshBasicMaterial({map:busLogo,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}),0,.42,1.7);frontBrand.castShadow=false;
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
// Travelers are drawn as person icons (HTML tags) standing on their sidewalk spot: no 3D people, no shadows, and the
// tags are only re-measured when they appear or the screen changes. The 3D object is just an invisible anchor.
function buildPerson(traveler){const [x,z]=CROWD_SPOTS[traveler.spot],g=new THREE.Group();g.position.set(x,.1,z);g.userData.travelerId=traveler.id;crowdGroup.add(g);return g;}

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
  crowdLabels=crowd.map(p=>({kind:'traveler',id:p.id,object:crowdGroup.children.find(c=>c.userData.travelerId===p.id),anchor:new THREE.Vector3(0,.05,0)}));
  renderLabels();}
// Tags are kept and updated in place (keyed by kind and id), so their pop-in and countdown animations never restart.
const tagElements=new Map();
function busTagMarkup(b,now){
  if(b.payout>0){const left=Math.max(0,b.claimBy-now),total=run.cfg.claim;return {className:'bus-tag collect'+(left<3500?' hurry':''),label:`Claim ${num(b.payout)} coins`,html:`<strong>${bulk(b.payout)}</strong><small>${t('tapToClaim')} · <span class="claim-left">${Math.ceil(left/1000)}</span>s</small><span class="claim-timer" style="animation-duration:${total}ms;animation-delay:-${total-left}ms"></span>`,sig:`pay${b.payout}-${b.claimBy}`};}
  const full=b.passengers>=CAPACITY,dest=b.dest?`${flagMarkup(b.dest,'bus-flag')}<b class="bus-dest">${city[b.dest].name}</b>`:'';
  return {className:`bus-tag${b.id===selectedBus?' selected':''}${full?' full':''}${b.golden?' golden':''}`,label:`Bus to ${b.dest?city[b.dest].name:'nowhere'}, ${b.passengers} of ${CAPACITY} aboard${full?', tap to send':''}`,
    html:(b.golden?`<span class="golden-chip">${icon('ticket')} ×3</span>`:'')+(full?`<span class="bus-tag-heading">${dest}</span><strong>${icon('bus')} ${t('go')}</strong><small class="bus-fare">${bulk(b.revenue)}</small>`:`<span class="bus-tag-heading">${dest}</span><small>${b.passengers}/${CAPACITY}${b.revenue?` · ${bulk(b.revenue)}`:''}</small><span class="bus-progress"><i style="width:${b.passengers/CAPACITY*100}%"></i></span>`),
    sig:`${b.dest}-${b.passengers}-${b.revenue}-${b.golden?1:0}`};}
function renderLabels(){
  const now=Date.now(),selected=getSelectedBus(),tappableDest=canBoard(selected)?selected.dest:null,freeSeats=canBoard(selected)?CAPACITY-selected.passengers:0,host=$('scene-labels'),seen=new Set();
  const upsert=(key,attr,id,className,label,html,sig)=>{seen.add(key);let tag=tagElements.get(key);
    if(!tag){const el=document.createElement('button');el.dataset[attr]=id;host.appendChild(el);tag={el,sig:null};tagElements.set(key,tag);}
    if(tag.sig!==sig){tag.el.innerHTML=html;tag.sig=sig;}if(tag.el.className!==className)tag.el.className=className;tag.el.setAttribute('aria-label',label);return tag.el;};
  for(const entry of busLabels){const b=run.buses.find(x=>x.id===entry.id);if(!b)continue;const m=busTagMarkup(b,now);entry.el=upsert('bus'+b.id,'bus',b.id,m.className,m.label,m.html,m.sig);}
  for(const entry of crowdLabels){const p=crowd.find(x=>x.id===entry.id);if(!p)continue;const special=p.special&&SPECIALS[p.special],faded=special?!tappableDest:p.dest!==tappableDest,life=p.until-p.born;
    const size=p.size||1,tooBig=!faded&&!special&&size>freeSeats;
    entry.el=upsert('t'+p.id,'traveler',p.id,`traveler-tag${faded?' faded':''}${special?` special special-${p.special}`:''}${size>1?' group':''}${tooBig?' too-big':''}`,`${special?t('specials')[p.special]+' ':''}${size>1?`group of ${size} `:''}traveler to ${city[p.dest].name}${faded?', board a bus to that country first':tooBig?', does not fit':''}`,
      `${special?`<span class="special-glow"></span><span class="special-icon">${icon(special.icon)}</span><span class="special-ring" style="animation-duration:${life}ms;animation-delay:-${Math.max(0,now-p.born)}ms"></span>`:`<span class="person-icon" style="animation-duration:${life}ms;animation-delay:-${Math.max(0,now-p.born)}ms">${icon(size>1?'group':'person')}</span>${faded?'':flagMarkup(p.dest,'mini-flag')}`}${size>1?`<span class="group-badge">${size}</span>`:''}<span class="life-timer" style="animation-duration:${life}ms;animation-delay:-${Math.max(0,now-p.born)}ms"></span>`,`${p.dest}-${p.special}-${size}-${p.until}-${faded?1:0}`);}
  for(const [key,tag] of tagElements)if(!seen.has(key)){tag.el.remove();tagElements.delete(key);}
  positionLabels();}
let labelEpoch=0;const placedTags=new WeakMap();
function positionLabels(){
  const r=canvas.getBoundingClientRect();
  for(const entry of [...busLabels,...crowdLabels]){const el=entry.el;if(!entry.object||!el)continue;if(entry.kind==='traveler'){if(placedTags.get(el)===labelEpoch)continue;placedTags.set(el,labelEpoch);}const p=entry.object.localToWorld(entry.anchor.clone()).project(camera);let x=(p.x*.5+.5)*r.width,y=(-p.y*.5+.5)*r.height;const half=el.offsetWidth/2;x=THREE.MathUtils.clamp(x,half+5,r.width-half-5);y=THREE.MathUtils.clamp(y,el.offsetHeight+8,r.height-5);el.style.left=x+'px';el.style.top=y+'px';}}
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
  labelEpoch++;const w=innerWidth,h=innerHeight;renderer.setSize(w,h,false);frameCamera(w,h);
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
$('pause-btn').addEventListener('click',()=>{play('select',.8);pause();});
$('sheet').addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button){if(e.target.id==='sheet')closeSheet();return;}play('select',.8);
  if(button.dataset.howtab){howTab=Number(button.dataset.howtab);$('sheet-panel').innerHTML=sheetMarkup('howto');}else if(button.dataset.lang)setLanguage(button.dataset.lang);else if(button.dataset.upgrade)buyUpgrade(button.dataset.upgrade);else if(button.id==='sheet-close'||button.id==='sheet-ok')closeSheet();});
$('overlay').addEventListener('click',e=>{
  // Every button click makes the same short click sound.
  const button=e.target.closest('button');if(!button)return;if(button.id!=='reset-btn')play('select',.8);
  if(button.id==='play-btn')openLevel(homePick??game.level);else if(button.id==='start-btn')startCountdown();else if(button.id==='resume-btn')resume();
  else if(button.id==='restart-btn'||button.id==='retry-btn')openLevel(run.n);else if(button.id==='next-btn')openLevel(Math.min(run.n+1,game.level));else if(button.id==='home-btn')goHome();
  else if(button.id==='music-btn')toggleMusic();else if(button.id==='boosters-btn')openSheet('boosters');else if(button.id==='howto-btn')openSheet('howto');else if(button.id==='lang-btn')openSheet('lang');else if(button.id==='goals-btn'){openSheet('goals');for(const g of ensureDaily().goals)if(g.done)g.seen=true;save();button.querySelector('.dot')?.remove();}else if(button.id==='reset-btn')resetProgress(button);else if(button.dataset.level)pickLevel(Number(button.dataset.level),true);else if(button.dataset.upgrade)buyUpgrade(button.dataset.upgrade);});
addEventListener('keydown',e=>{if(e.key==='Escape')mode==='play'?pause():mode==='paused'&&resume();if(mode==='play'&&e.key==='ArrowRight')switchStation(neighbour(1),1);if(mode==='play'&&e.key==='ArrowLeft')switchStation(neighbour(-1),-1);});
function renderSoundButton(){$('sound').innerHTML=icon(sound?'sound-on':'sound-off');$('sound').setAttribute('aria-label',sound?'Mute sound':'Turn sound on');}
$('sound').addEventListener('click',()=>{sound=!sound;localStorage.setItem('souha-sound',sound?'on':'off');renderSoundButton();applyMusicVolume();play('select',.8);});
function toggleMusic(){musicOn=!musicOn;localStorage.setItem('souha-music',musicOn?'on':'off');applyMusicVolume();showOverlay($('overlay').dataset.kind);}
const musicIcon=()=>icon(musicOn?'music-note-1':'music-note-off-1');

// ---------------------------------------------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------------------------------------------
let shownCoins=game.coins,lastFrame=0;
function animate(){
  requestAnimationFrame(animate);const now=performance.now(),clockNow=Date.now();
  // Coin counters and the goal bar roll toward what has landed.
  const coinGoal=game.coins-coinsInFlight;if(shownCoins!==coinGoal){const gap=coinGoal-shownCoins;shownCoins+=Math.abs(gap)<2?gap:Math.round(gap*.14)||Math.sign(gap);if(gap>0&&mode==='home')rollTick(now,.5);for(const el of document.querySelectorAll('.coin-pill strong'))el.textContent=Math.round(shownCoins).toLocaleString('en-US');}
  if(run){const earnedGoal=run.earned-(mode==='play'||mode==='paused'?coinsInFlight:0);if(shownEarned!==earnedGoal){const gap=earnedGoal-shownEarned;shownEarned+=Math.abs(gap)<2?gap:Math.round(gap*.14)||Math.sign(gap);if(gap>0)rollTick(now,shownEarned/run.cfg.target);renderGoal();}}
  if(mode==='play'){if(combo.count&&clockNow-combo.last>run.cfg.combo&&clockNow>combo.frozenUntil)endCombo();renderCombo(clockNow);}
  const dt=Math.min(.033,(now-(lastFrame||now))/1000);lastFrame=now;stepBusSprings(dt,now);stepCoins(dt,now);stepWind(now);
  for(const pad of pads){const pulse=Math.sin(now/260);pad.scale.set(1+pulse*.025,1,1+pulse*.012);pad.userData.fill.opacity=.42+pulse*.12;}
  // New travelers pop in with a little bounce.
  for(let i=departureEffects.length-1;i>=0;i--){const effect=departureEffects[i],t=Math.min(1,(now-effect.started)/450),ease=1-(1-t)**3;effect.model.position.x=THREE.MathUtils.lerp(effect.x,10.5,ease);if(now-effect.lastSmoke>45&&t<.85){emitSmoke(effect.model,now);effect.lastSmoke=now;}if(t>=1){scene.remove(effect.model);disposeTree(effect.model);departureEffects.splice(i,1);}}
  let entriesFinished=false;for(let i=entryEffects.length-1;i>=0;i--){const effect=entryEffects[i],t=THREE.MathUtils.clamp((now-effect.started)/550,0,1),ease=1-(1-t)**3;effect.model.position.x=THREE.MathUtils.lerp(effect.fromX,effect.toX,ease);effect.model.position.z=THREE.MathUtils.lerp(effect.fromZ,effect.toZ,ease);if(t>=1){entryEffects.splice(i,1);entriesFinished=true;kickBus(effect.id,{pitch:.85,y:-.3});emitDust(effect.model,now);}}if(entriesFinished&&!entryEffects.length){renderLabels();renderHud();}
  for(let i=boardingEffects.length-1;i>=0;i--){const effect=boardingEffects[i],t=THREE.MathUtils.clamp((now-effect.started)/260,0,1),ease=t*t*(3-2*t),bus=busModel(effect.busId);if(bus)effect.to.copy(bus.localToWorld(new THREE.Vector3(-.58,.55,1.18)));effect.model.position.lerpVectors(effect.from,effect.to,ease);effect.model.position.y+=Math.sin(Math.PI*t)*.9;const stretch=Math.sin(Math.PI*t),shrink=PERSON_SCALE*(1-.18*t);effect.model.scale.set(shrink*(1-.14*stretch),shrink*(1+.3*stretch),shrink*(1-.14*stretch));const fade=t<.35?1:(1-t)/.65;for(const m of effect.materials)m.opacity=fade;if(t>=1){const push=Math.sqrt(effect.size)*(effect.special?1.4:1);kickBus(effect.busId,{y:-.7*push,roll:.62*push,pitch:.22*push});scene.remove(effect.model);disposeTree(effect.model);boardingEffects.splice(i,1);}}
  for(let i=vanishEffects.length-1;i>=0;i--){const effect=vanishEffects[i],t=Math.min(1,(now-effect.started)/180);effect.model.scale.setScalar(PERSON_SCALE*(1-t));effect.model.position.y=.1+t*.15;if(t>=1){scene.remove(effect.model);disposeTree(effect.model);vanishEffects.splice(i,1);}}
  for(let i=smokeEffects.length-1;i>=0;i--){const effect=smokeEffects[i],t=Math.min(1,(now-effect.started)/620);effect.puff.position.y+=.006;effect.puff.position.x+=effect.vx*.016;effect.puff.scale.setScalar(1+t*2.5);effect.puff.material.opacity=.82*(1-t);if(t>=1){scene.remove(effect.puff);effect.puff.geometry.dispose();effect.puff.material.dispose();smokeEffects.splice(i,1);}}
  // Claim countdowns tick down on the gold tags without re-rendering them.
  if(run)for(const el of document.querySelectorAll('.claim-left')){const bus=run.buses.find(b=>b.id===Number(el.closest('[data-bus]').dataset.bus));if(bus){const s=Math.max(0,Math.ceil((bus.claimBy-clockNow)/1000));if(el.textContent!==String(s))el.textContent=s;el.closest('.bus-tag').classList.toggle('hurry',bus.claimBy-clockNow<3500);}}
  if(run&&mode==='play'&&rushActive(clockNow))renderRush(clockNow);
  positionLabels();renderer.render(scene,camera);}

coachTemplate=await coachTemplatePromise;
renderSoundButton();prepareRun(game.level);buildStatic();resize();goHome();animate();setInterval(tick,90);
