/* Application state, input, match lifecycle, replay and stadium sound. */
(function(){
'use strict';
const P=FSPhysics,$=id=>document.getElementById(id),teams=FSTeams.list;
const defaults={nation:'swe',difficulty:'pro',quality:'balanced',audio:true,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,best:0,cups:0};
let saved={};try{saved=JSON.parse(localStorage.getItem('football-strike-v2')||'{}')||{};}catch{}
const settings=Object.assign({},defaults,saved);
if(!teams.some(t=>t.id===settings.nation))settings.nation='swe';
if(!['rookie','pro','elite'].includes(settings.difficulty))settings.difficulty='pro';
if(!['high','balanced','low'].includes(settings.quality))settings.quality='balanced';
settings.best=Number.isFinite(settings.best)?Math.max(0,settings.best):0;settings.cups=Number.isFinite(settings.cups)?Math.max(0,settings.cups):0;
settings.audio=!!settings.audio;settings.reducedMotion=!!settings.reducedMotion;
function persist(){try{localStorage.setItem('football-strike-v2',JSON.stringify(settings));}catch{}}
class Audio{
 constructor(){this.enabled=settings.audio;this.ctx=null;}
 init(){try{
 if(!this.ctx){
 this.ctx=new (window.AudioContext||window.webkitAudioContext)();this.master=this.ctx.createGain();this.master.gain.value=this.enabled?.42:0;this.master.connect(this.ctx.destination);
 this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate*3,this.ctx.sampleRate);const a=this.noise.getChannelData(0),r=P.rng(87);let brown=0;for(let i=0;i<a.length;i++){brown=(brown+(r()-.5)*.08)/1.02;a[i]=brown*3;}
 const src=this.ctx.createBufferSource();src.buffer=this.noise;src.loop=true;const filter=this.ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=900;this.ambience=this.ctx.createGain();this.ambience.gain.value=.09;src.connect(filter);filter.connect(this.ambience);this.ambience.connect(this.master);src.start();
 }
 if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});
 }catch{}}
 enable(on){this.enabled=on;if(this.master)this.master.gain.setTargetAtTime(on?.42:0,this.ctx.currentTime,.05);}
 tone(freq,duration,volume=.2,type='sine'){if(!this.ctx||!this.enabled)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.35,t+duration);g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+duration);}
 kick(){this.tone(145,.16,.7);}
 post(){this.tone(920,.5,.25,'triangle');this.tone(1450,.35,.12);}
 crowd(goal){if(!this.ctx||!this.enabled)return;const src=this.ctx.createBufferSource(),g=this.ctx.createGain(),t=this.ctx.currentTime;src.buffer=this.noise;g.gain.setValueAtTime(.02,t);g.gain.linearRampToValueAtTime(goal?.9:.4,t+.3);g.gain.exponentialRampToValueAtTime(.005,t+2.4);src.connect(g);g.connect(this.master);src.start();src.stop(t+2.5);}
}
const sound=new Audio();
let world;try{world=new FSWorld($('stage'),settings);}catch(e){fatal('This browser could not start 3D graphics. Try enabling hardware acceleration or use another browser.');console.error(e);return;}
function fatal(message){$('loading').hidden=true;$('error-screen').hidden=false;$('error-text').textContent=message;}
const flight=new P.Flight(),aim={x:0,y:1.05},screen={x:0,y:0},ballScreen={x:0,y:0};
const game={phase:'menu',mode:'shootout',elapsed:0,remaining:45,points:0,shots:0,goals:0,stage:0,opponent:null,match:null,outcome:null,shot:null,keeper:null,keeperEnabled:true,paused:false,ready:false,seed:0,random:P.rng(1),rivals:[],combo:0,cupWon:false};
const renderState={phase:'aim',ball:flight.ball,keeperPose:flight.pose,keeperEnabled:true,elapsed:0,outcome:null,speed:0,curve:0};
const replay=new Float32Array(600*9);let replayCount=0,replayTime=0,accumulator=0,last=performance.now(),lastHUD=-1,renderFrames=0,totalFrameTime=0;
const input={active:false,id:null,startX:0,startY:0,startTime:0,lastX:0,lastY:0,keyboard:false,power:.65,curve:0,hasMoved:false};
let focusBeforeDialog=null;let lastReticleX=-999,lastReticleY=-999;
function nationMarkup(t){return FSTeams.flag(t.id)+'<span>'+t.code+'</span>';}
function setNation(id){
 settings.nation=id;const t=FSTeams.get(id);world.setTeam(t);persist();
 $('selected-nation').innerHTML=FSTeams.flag(id)+'<span><small>YOUR NATION</small><strong>'+t.name+'</strong></span><b>↗</b>';
 $('player-country').textContent=t.name.toUpperCase();$('nation-selection').textContent=t.name+' selected';
 document.querySelectorAll('.nation-card').forEach(b=>{const on=b.dataset.id===id;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
}
$('nation-grid').innerHTML=teams.map(t=>'<button class="nation-card" data-id="'+t.id+'" aria-pressed="false">'+FSTeams.flag(t.id)+'<i class="shirt-chip" style="background:'+t.shirt+';border-bottom:7px solid '+t.shorts+'"></i><strong>'+t.name+'</strong><small>'+t.code+' / HOME</small></button>').join('');
$('nation-grid').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setNation(b.dataset.id);});
$('difficulty').value=settings.difficulty;$('quality-setting').value=settings.quality;$('audio-setting').checked=settings.audio;$('motion-setting').checked=settings.reducedMotion;
$('difficulty').onchange=e=>{settings.difficulty=e.target.value;persist();};
$('quality-setting').onchange=e=>{settings.quality=e.target.value;world.setQuality(settings.quality);persist();};
$('audio-setting').onchange=e=>setAudio(e.target.checked);
$('motion-setting').onchange=e=>{settings.reducedMotion=e.target.checked;persist();};
function setAudio(on){settings.audio=on;sound.init();sound.enable(on);$('audio-setting').checked=on;$('sound-toggle').textContent=on?'♪':'×';$('sound-toggle').setAttribute('aria-label',on?'Mute sound':'Enable sound');persist();}
$('sound-toggle').onclick=()=>setAudio(!settings.audio);
function menu(nations=false){
 game.phase='menu';game.paused=false;game.outcome=null;input.active=false;input.keyboard=false;
 document.body.classList.remove('playing');$('shell').hidden=false;$('hud').hidden=true;$('home').hidden=nations;$('nations').hidden=!nations;
 $('nav-play').classList.toggle('active',!nations);$('nav-nations').classList.toggle('active',nations);
 for(const id of ['pause-dialog','result-dialog'])if($(id).open)$(id).close();
 world.setView(nations?'nations':'home',true);world.showTargets(-1);world.showAim(null,false);
 $('rush-record').innerHTML='BEST: '+settings.best+' <span>→</span>';$('career-record').textContent=settings.cups+' CUP WIN'+(settings.cups===1?'':'S');
 $('shot-feedback').classList.remove('show');$('aim-reticle').hidden=true;
}
$('nav-play').onclick=()=>menu(false);$('nav-nations').onclick=()=>menu(true);$('selected-nation').onclick=()=>menu(true);$('nation-confirm').onclick=()=>menu(false);
document.querySelector('.brand').onclick=e=>{e.preventDefault();menu(false);};
function openSettings(){focusBeforeDialog=document.activeElement;if(game.phase!=='menu')pause();$('settings-dialog').showModal();sound.init();}
$('settings-open').onclick=openSettings;
$('settings-dialog').addEventListener('close',()=>focusBeforeDialog?.focus());
function pause(){
 if(game.phase==='menu'||game.phase==='complete'||game.paused)return;
 game.paused=true;input.active=false;input.keyboard=false;world.showAim(null,false);$('aim-reticle').hidden=true;$('pause-dialog').showModal();
}
function resume(){game.paused=false;accumulator=0;last=performance.now();$('pause-dialog').close();}
$('pause-open').onclick=pause;$('resume').onclick=resume;
$('pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
$('restart').onclick=()=>{const mode=game.mode;$('pause-dialog').close();start(mode);};
$('quit').onclick=()=>menu(false);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=performance.now();});
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>start(b.dataset.mode));
function start(mode,preserveCup=false){
 if(!game.ready)return;sound.init();
 game.mode=mode;game.phase='aim';game.paused=false;game.elapsed=0;game.remaining=45;game.points=0;game.shots=0;game.goals=0;game.combo=0;game.cupWon=false;
 if(!preserveCup){game.stage=0;game.seed=(Date.now()^Math.floor(performance.now()*1000))>>>0;game.random=P.rng(game.seed);
 game.rivals=teams.filter(t=>t.id!==settings.nation);
 for(let i=game.rivals.length-1;i>0;i--){const j=Math.floor(game.random()*(i+1));[game.rivals[i],game.rivals[j]]=[game.rivals[j],game.rivals[i]];}
 }
 game.opponent=game.rivals[game.stage];game.match=new P.Shootout();
 for(const id of ['result-dialog','pause-dialog'])if($(id).open)$(id).close();
 $('shell').hidden=true;$('hud').hidden=false;document.body.classList.add('playing');
 $('keeper-option').hidden=mode!=='practice';$('keeper-enabled').checked=true;world.setView('match',true);
 $('home-team').innerHTML=nationMarkup(FSTeams.get(settings.nation));
 $('away-team').innerHTML=mode==='rush'?'45s':mode==='practice'?'TRAIN':nationMarkup(game.opponent);
 $('match-label').textContent=mode==='cup'?'NATIONS CUP • CPU OPPONENT':mode==='shootout'?'SHOOTOUT • CPU OPPONENT':mode==='rush'?'TARGET RUSH • 45 SECONDS':'TRAINING • UNLIMITED';
 nextShot();updateHUD();
}
function nextShot(){
 if(game.phase==='menu'||game.phase==='complete')return;
 game.phase='aim';game.elapsed=0;game.outcome=null;game.shot=null;replayCount=0;
 Object.assign(flight.ball,{x:0,y:.11,z:11,vx:0,vy:0,vz:0,ax:0});Object.assign(flight.pose,{x:0,y:1,roll:0,extension:.33});
 flight.outcome=null;aim.x=0;aim.y=1.05;input.active=false;input.keyboard=false;input.power=.65;
 game.keeperEnabled=game.mode==='rush'?false:game.mode==='practice'?$('keeper-enabled').checked:true;
 world.keeper.visible=game.keeperEnabled;world.setView('match',true);world.showAim(null,false);
 $('shot-feedback').classList.remove('show');$('after-shot').hidden=true;$('shot-controls').hidden=false;$('shot-help').hidden=false;$('aim-reticle').hidden=true;$('replay-label').hidden=true;$('swipe-hint').hidden=game.shots>0;
 $('help-title').textContent=game.mode==='rush'?'HIT THE LIT TARGET':'DRAG FROM THE BALL TO AIM';
 $('help-detail').textContent='Release to shoot · A faster swipe adds power';
 $('power-fill').style.width='65%';
 if(game.mode==='rush'){game.targetIndex=Math.floor(game.random()*4);world.showTargets(game.targetIndex);}else world.showTargets(-1);
 lastHUD=-1;updateHUD();world.renderer.domElement.focus({preventScroll:true});
}
$('keeper-enabled').onchange=()=>{if(game.phase==='aim'){game.keeperEnabled=$('keeper-enabled').checked;world.keeper.visible=game.keeperEnabled;}};
function setCurve(value){input.curve=P.clamp(value,-1,1);$('curve').value=input.curve;$('curve-value').textContent=Math.abs(input.curve)<.06?'STRAIGHT':(input.curve<0?'← LEFT ':'RIGHT → ')+Math.round(Math.abs(input.curve)*100)+'%';}
$('curve').oninput=e=>setCurve(Number(e.target.value));
function fire(x,y,power){
 if(game.phase!=='aim'||game.paused)return false;
 input.active=false;input.keyboard=false;game.phase='runup';game.elapsed=0;game.outcome=null;
 game.shot=P.createShot(x,y,power,input.curve);game.keeper=P.makeKeeper(game.shot,settings.difficulty,game.random);
 $('aim-reticle').hidden=true;$('swipe-hint').hidden=true;$('shot-controls').hidden=true;$('shot-help').hidden=true;world.showAim(null,false);
 return true;
}
function drawAim(){
 world.screenPoint(aim.x,aim.y,.03,screen);
 if(Math.abs(lastReticleX-screen.x)>.2||Math.abs(lastReticleY-screen.y)>.2){$('aim-reticle').style.left=screen.x+'px';$('aim-reticle').style.top=screen.y+'px';lastReticleX=screen.x;lastReticleY=screen.y;}
 $('aim-reticle').hidden=false;$('swipe-hint').hidden=true;$('power-fill').style.width=Math.round(input.power*100)+'%';
 if(game.mode==='practice')world.showAim(P.createShot(aim.x,aim.y,input.power,input.curve),true);
}
const canvas=world.renderer.domElement;canvas.tabIndex=0;canvas.setAttribute('aria-label','Penalty pitch. Arrow keys aim. Hold and release Space to shoot.');
canvas.addEventListener('pointerdown',e=>{
 if(game.phase!=='aim'||game.paused||e.button>0)return;
 sound.init();input.active=true;input.id=e.pointerId;input.startX=e.clientX;input.startY=e.clientY;input.startTime=performance.now();input.lastX=e.clientX;input.lastY=e.clientY;input.hasMoved=false;input.keyboard=false;
 canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(!input.active||e.pointerId!==input.id||game.paused)return;
 input.lastX=e.clientX;input.lastY=e.clientY;input.hasMoved=Math.hypot(e.clientX-input.startX,e.clientY-input.startY)>10;
 if(input.hasMoved){world.screenToAim(e.clientX,e.clientY,aim);const elapsed=Math.max(.1,(performance.now()-input.startTime)/1000);input.power=P.clamp(Math.hypot(e.clientX-input.startX,e.clientY-input.startY)/Math.min(innerWidth,innerHeight)/elapsed*.65,.28,1);drawAim();}
});
canvas.addEventListener('pointerup',e=>{
 if(!input.active||e.pointerId!==input.id)return;
 input.active=false;try{canvas.releasePointerCapture(e.pointerId);}catch{}
 if(game.phase!=='aim'||game.paused)return;
 const dy=e.clientY-input.startY,dx=e.clientX-input.startX;
 if(Math.hypot(dx,dy)<14){$('help-title').textContent='SWIPE UP TOWARDS THE GOAL';$('shot-help').hidden=false;return;}
 world.screenToAim(e.clientX,e.clientY,aim);
 // Short flicks that finish below the goal map naturally into its face.
 world.screenPoint(0,0,0,screen);
 if(e.clientY>screen.y+15&&dy< -14){aim.y=P.clamp(.4+(-dy/innerHeight)*6,.25,2.6);aim.x=P.clamp(dx/Math.max(45,-dy)*3.2,-5.5,5.5);}
 if(dy> -8&&e.clientY>screen.y+15){$('aim-reticle').hidden=true;world.showAim(null,false);return;}
 fire(aim.x,aim.y,input.power);
});
canvas.addEventListener('pointercancel',()=>{input.active=false;$('aim-reticle').hidden=true;world.showAim(null,false);});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
 const isControl=/^(INPUT|SELECT|BUTTON|TEXTAREA)$/.test(e.target.tagName);
 if(e.code==='Escape'&&!$('settings-dialog').open){if(game.paused){e.preventDefault();resume();}else if(game.phase!=='menu'&&game.phase!=='complete'){e.preventDefault();pause();}return;}
 if(game.paused||game.phase!=='aim'||isControl||$('settings-dialog').open)return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE'].includes(e.code))e.preventDefault();
 if(e.code==='ArrowLeft')aim.x=P.clamp(aim.x-.18,-5.5,5.5);
 if(e.code==='ArrowRight')aim.x=P.clamp(aim.x+.18,-5.5,5.5);
 if(e.code==='ArrowUp')aim.y=P.clamp(aim.y+.12,.11,4.5);
 if(e.code==='ArrowDown')aim.y=P.clamp(aim.y-.12,.11,4.5);
 if(e.code==='KeyQ')setCurve(input.curve-.1);if(e.code==='KeyE')setCurve(input.curve+.1);
 if(e.code==='Space'&&!e.repeat&&!input.keyboard){input.keyboard=true;input.startTime=performance.now();sound.init();}
 drawAim();
});
window.addEventListener('keyup',e=>{if(e.code==='Space'&&input.keyboard){e.preventDefault();input.keyboard=false;fire(aim.x,aim.y,input.power);}});
window.addEventListener('blur',()=>{input.active=false;input.keyboard=false;pause();});
function recordFrame(){
 if(replayCount>=600)return;
 const i=replayCount*9,b=flight.ball,k=flight.pose;
 replay[i]=b.x;replay[i+1]=b.y;replay[i+2]=b.z;replay[i+3]=k.x;replay[i+4]=k.y;replay[i+5]=k.roll;replay[i+6]=k.extension;replay[i+7]=flight.time;replay[i+8]=game.outcome==='goal'?1:0;replayCount++;
}
function resolve(){
 if(game.outcome)return;
 game.outcome=flight.outcome;game.shots++;const goal=game.outcome==='goal';if(goal)game.goals++;
 const title=goal?'GOAL.':game.outcome==='saved'?'DENIED.':game.outcome==='post'?'OFF THE WOODWORK.':'JUST WIDE.';
 let detail=Math.round(game.shot.speed)+' km/h · '+(Math.abs(input.curve)>.1?'Curled finish':'Driven shot');
 let label='PENALTY '+game.shots;
 if(game.mode==='cup'||game.mode==='shootout'){
 const rivalGoal=game.random()<P.DIFFICULTY[settings.difficulty].rival;game.match.add(goal,rivalGoal);
 detail=game.opponent.name+(rivalGoal?' convert their penalty.':' miss their penalty.');label=game.match.home.length>5?'SUDDEN DEATH':'PENALTY '+game.shots+' / 5';
 }else if(game.mode==='rush'){
 const target=world.targets[game.targetIndex],dist=Math.hypot(flight.ball.x-target.position.x,flight.ball.y-target.position.y);
 const hit=goal&&dist<.46;if(hit){game.combo++;const earned=100+Math.min(4,game.combo-1)*25;game.points+=earned;label='TARGET HIT · +'+earned;detail=game.combo>1?game.combo+' IN A ROW':'Keep finding the corners.';}else{game.combo=0;label='KEEP GOING';detail=goal?'Find the lit ring to score points.':'Aim inside the frame.';}
 $('feedback-title').textContent=hit?'BULLSEYE.':goal?'IN THE NET.':title;
 }else detail=game.goals+' goals from '+game.shots+' attempts · '+Math.round(game.shot.speed)+' km/h';
 if(game.mode!=='rush')$('feedback-title').textContent=title;
 $('feedback-kicker').textContent=label;$('feedback-detail').textContent=detail;$('shot-feedback').classList.add('show');
 if(goal){world.hitNet(flight.ball.x,flight.ball.y);sound.crowd(true);if(navigator.vibrate)navigator.vibrate(30);}
 else{sound.crowd(false);if(game.outcome==='post')sound.post();}
 game.phase='result';game.elapsed=0;updateHUD();
}
function updateHUD(){
 const mode=game.mode;
 if(mode==='rush'){$('match-score').textContent=game.points;$('away-team').textContent=Math.ceil(game.remaining)+'s';$('shot-track').textContent='BEST '+settings.best;$('stage-label').textContent='CORNERS WIN POINTS';}
 else if(mode==='practice'){$('match-score').textContent=game.goals+' / '+game.shots;$('shot-track').textContent='GOALS / ATTEMPTS';$('stage-label').textContent='ELEVEN METRES · NO LIMITS';}
 else{
 const score=game.match.score;$('match-score').textContent=score[0]+' : '+score[1];
 const dots=arr=>'<div class="shot-row">'+Array.from({length:Math.max(5,arr.length+(!game.match.done?1:0))},(_,i)=>'<i class="shot-dot '+(i<arr.length?(arr[i]?'goal':'miss'):i===arr.length?'current':'')+'"></i>').slice(-8).join('')+'</div>';
 $('shot-track').innerHTML=dots(game.match.home)+dots(game.match.away);
 $('stage-label').textContent=mode==='cup'?['QUARTER-FINAL','SEMI-FINAL','FINAL'][game.stage]:game.match.home.length>=5&&!game.match.done?'SUDDEN DEATH · MATCH THE RIVAL':'FIVE PENALTIES · EVERY MOMENT COUNTS';
 }
}
function finishMatch(){
 if(game.phase==='complete')return;
 game.phase='complete';game.paused=false;$('after-shot').hidden=true;
 const cup=game.mode==='cup',won=game.match?.winner==='home',rush=game.mode==='rush';
 let title,detail;
 if(rush){const best=game.points>settings.best;settings.best=Math.max(game.points,settings.best);title=best?'A new personal best.':'Time’s up.';detail=game.goals+' goals · '+game.shots+' attempts. Take another run at it.';$('result-score').textContent=game.points+' PTS';$('result-eyebrow').textContent='TARGET RUSH';$('trophy-icon').textContent='◎';}
 else{
 title=won?(cup?(game.stage===2?'Champions.':'You’re through.'):'Nerves of steel.'):'So close.';
 detail=cup&&won&&game.stage<2?'Next up: '+game.rivals[game.stage+1].name+'.':won?'Your country. Your moment.':'Take a breath. The next shootout is yours.';
 const s=game.match.score;$('result-score').textContent=s[0]+' : '+s[1];$('result-eyebrow').textContent=cup?'NATIONS CUP':'FULL TIME';$('trophy-icon').textContent=won?'★':'○';
 if(cup&&won&&game.stage===2&&!game.cupWon){game.cupWon=true;settings.cups++;}
 }
 $('result-title').textContent=title;$('result-detail').textContent=detail;
 $('cup-progress').innerHTML=cup?['QUARTER','SEMI','FINAL'].map((s,i)=>'<span class="'+(i<game.stage||i===game.stage&&won?'complete':'')+'">'+s+'</span>').join(''):'';
 $('result-next').innerHTML=(cup&&won&&game.stage<2?'NEXT ROUND':'PLAY AGAIN')+' <span>→</span>';persist();$('result-dialog').showModal();
}
$('next-shot').onclick=()=>{
 if(game.phase!=='result')return;
 if(game.match.done&&(game.mode==='cup'||game.mode==='shootout'))finishMatch();else nextShot();
};
$('result-next').onclick=()=>{
 if(game.mode==='cup'&&game.match.winner==='home'&&game.stage<2){game.stage++;start('cup',true);}else start(game.mode);
};
$('result-menu').onclick=()=>menu(false);
$('result-dialog').addEventListener('cancel',e=>{e.preventDefault();menu(false);});
$('replay').onclick=()=>{
 if(game.phase!=='result'||replayCount<3||game.mode==='rush')return;
 game.phase='replay';replayTime=0;$('after-shot').hidden=true;$('shot-feedback').classList.remove('show');$('replay-label').hidden=false;world.setView(settings.reducedMotion?'match':'replay',true);
};
function leaveReplay(){
 game.phase='result';game.elapsed=1.5;$('after-shot').hidden=false;$('replay-label').hidden=true;$('shot-feedback').classList.add('show');world.setView('match',true);
}
function fixedStep(dt){
 if(game.paused||game.phase==='menu'||game.phase==='complete')return;
 if(game.mode==='rush'&&game.phase!=='replay'){game.remaining=Math.max(0,game.remaining-dt);const seconds=Math.ceil(game.remaining);if(seconds!==lastHUD){lastHUD=seconds;updateHUD();}if(game.remaining===0&&game.phase==='aim'){finishMatch();return;}}
 game.elapsed+=dt;
 if(game.phase==='runup'){
 if(game.elapsed>=.62){game.phase='flight';game.elapsed=0;flight.launch(game.shot,game.keeper,game.keeperEnabled);sound.kick();recordFrame();}
 }else if(game.phase==='flight'){
 flight.step(dt);recordFrame();if(flight.outcome)resolve();
 }else if(game.phase==='result'){
 flight.step(dt);if(game.elapsed<1.2)recordFrame();
 if(game.mode==='rush'&&game.elapsed>.75){if(game.remaining<=0)finishMatch();else nextShot();}
 else if(game.mode!=='rush'&&game.elapsed>.85&&$('after-shot').hidden){
 $('after-shot').hidden=false;$('next-shot').innerHTML=(game.match.done&&(game.mode==='cup'||game.mode==='shootout')?'VIEW RESULT':'NEXT PENALTY')+' <span>→</span>';
 }
 }else if(game.phase==='replay'){
 replayTime+=dt*.45;const frame=Math.min(replayCount-1,Math.floor(replayTime/P.STEP)),i=frame*9;
 flight.ball.x=replay[i];flight.ball.y=replay[i+1];flight.ball.z=replay[i+2];flight.pose.x=replay[i+3];flight.pose.y=replay[i+4];flight.pose.roll=replay[i+5];flight.pose.extension=replay[i+6];
 if(frame>=replayCount-1)leaveReplay();
 }
}
function frame(now){
 const raw=(now-last)/1000;last=now;const dt=Math.min(Math.max(raw,0),.05);
 if(!game.paused){accumulator+=dt;while(accumulator>=P.STEP){fixedStep(P.STEP);accumulator-=P.STEP;}}
 if(input.keyboard&&game.phase==='aim'&&!game.paused){input.power=P.clamp(.25+(now-input.startTime)/1000*.65,.25,1);$('power-fill').style.width=Math.round(input.power*100)+'%';}
 renderState.phase=game.phase;renderState.elapsed=game.elapsed;renderState.keeperEnabled=game.keeperEnabled;renderState.outcome=game.outcome;renderState.speed=game.shot?.speed/3.6||0;renderState.curve=input.curve;
 world.update(game.paused?0:dt,game.phase==='menu'?null:renderState);
 if(!document.hidden){renderFrames++;totalFrameTime+=raw;}
 requestAnimationFrame(frame);
}
window.addEventListener('resize',()=>{world.resize();if(input.active)drawAim();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();fatal('The graphics session was interrupted. Reload to return to the stadium. Your records are saved.');});
setNation(settings.nation);menu(false);requestAnimationFrame(frame);
world.ready.then(results=>{
 if(!results.every(Boolean)){fatal('The player or ball could not load. Check your connection and try again.');return;}
 game.ready=true;$('loading').hidden=true;document.querySelector('[data-mode="cup"]').focus({preventScroll:true});
});
// Read-only diagnostics are always available; simulation controls require ?test=1.
window.FootballStrike={
 version:'2.0.0',get ready(){return game.ready;},
 snapshot:()=>({phase:game.phase,mode:game.mode,nation:settings.nation,difficulty:settings.difficulty,score:game.match?.score,shots:game.shots,goals:game.goals,outcome:game.outcome,remaining:game.remaining,paused:game.paused,countryCount:teams.length,actorReady:world.actorReady,ballAssetLoaded:world.ballAssetLoaded,assetErrors:world.assetErrors,drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,crowd:world.crowdCount,averageFrameMs:renderFrames?totalFrameTime/renderFrames*1000:0,stage:game.stage}),
 project:(x,y,z)=>{const s={};world.screenPoint(x,y,z,s);return s;}
};
if(new URLSearchParams(location.search).get('test')==='1'){
 window.FootballStrike.test={start,fire,step:seconds=>{for(let n=0;n<Math.ceil(seconds/P.STEP);n++)fixedStep(P.STEP);},setSeed:seed=>{game.random=P.rng(seed);},setKeeper:enabled=>{game.keeperEnabled=enabled;$('keeper-enabled').checked=enabled;},next:nextShot,setTime:t=>{game.remaining=t;},getPhysics:()=>({ball:{...flight.ball},keeper:{...flight.pose}}),setAim:(x,y)=>{aim.x=x;aim.y=y;},world};
}
})();
