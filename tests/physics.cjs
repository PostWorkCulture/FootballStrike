const test=require('node:test'),assert=require('node:assert/strict');
const K=require('../js/penalty/keeper.js'),P=require('../js/penalty/physics.js'),teams=require('../js/penalty/teams.js');
const sim=(x,y,p=.7,curve=0,keeper=false,seed=1)=>{
 const f=new P.Flight(),shot=P.createShot(x,y,p,curve),k=P.makeKeeper(shot,'pro',P.rng(seed));
 f.launch(shot,k,keeper);for(let n=0;n<500&&!f.outcome;n++)f.step();return f;
};
test('12 unique countries include all requested nations',()=>{assert.equal(teams.list.length,12);assert.equal(new Set(teams.list.map(t=>t.id)).size,12);for(const id of ['swe','eng','nor','bra','ita','fra','ger'])assert.ok(teams.get(id).id===id);});
test('open goal: low, central and upper-corner penalties score',()=>{for(const [x,y] of [[0,.4],[-3,1.9],[3,1.9],[0,1.2]])assert.equal(sim(x,y).outcome,'goal');});
test('curl compensation reaches the aimed corner for both directions and all powers',()=>{for(const p of [.2,.5,1])for(const curve of [-1,0,1]){const f=sim(2.7,1.8,p,curve);assert.equal(f.outcome,'goal');assert.ok(Math.abs(f.ball.x-2.7)<.13);}});
test('wide and high shots do not become goals',()=>{assert.equal(sim(4.5,1).outcome,'wide');assert.equal(sim(0,3).outcome,'wide');});
test('uprights and crossbar deflect high-speed shots',()=>{for(const p of [.2,1]){assert.equal(sim(3.66,1,p).outcome,'post');assert.equal(sim(0,2.44,p).outcome,'post');}});
test('the whole ball must cross the goal line',()=>{const f=new P.Flight();f.launch(P.createShot(2,1,.7,0),{reaction:1,x:0,y:1},false);while(f.ball.z>0)f.step();assert.equal(f.outcome,null);while(f.ball.z>-.11)f.step();assert.equal(f.outcome,'goal');});
test('keeper catches central penalties and disabling keeper removes saves',()=>{assert.equal(sim(0,1,.5,0,true).outcome,'saved');assert.equal(sim(0,1,.5,0,false).outcome,'goal');});
test('same seed and input reproduce goalkeeper and ball outcomes',()=>{const a=sim(2.5,1.5,.6,.8,true,131),b=sim(2.5,1.5,.6,.8,true,131);assert.deepEqual(a,b);});
test('net containment retains the ball after a goal',()=>{const f=sim(2.8,1.7);for(let i=0;i<500;i++)f.step();assert.equal(f.outcome,'goal');assert.ok(f.ball.z<0&&f.ball.z>=-1.75);assert.ok(f.ball.y>=.11);});
test('shootout ends early when the lead is uncatchable',()=>{const m=new P.Shootout();m.add(true,false);m.add(true,false);assert.equal(m.done,false);m.add(true,false);assert.equal(m.done,true);assert.equal(m.winner,'home');assert.equal(m.add(false,true),false);});
test('sudden death resolves only after equal numbers of penalties',()=>{const m=new P.Shootout();for(let n=0;n<5;n++)m.add(true,true);assert.equal(m.done,false);m.add(false,false);assert.equal(m.done,false);m.add(true,false);assert.equal(m.winner,'home');assert.equal(m.home.length,7);});
test('losing five-shot result is handled',()=>{const m=new P.Shootout();for(let n=0;n<3;n++)m.add(false,true);assert.equal(m.winner,'away');});

test('scored ball stays in front of the sloping back net at every height',()=>{const f=sim(2.8,1.9);for(let n=0;n<400;n++){f.step();assert.ok(f.ball.z>=-1.8+f.ball.y/2.44*1.3+P.R-1e-8);}});

test('central keeper reactions remain upright rather than making a full lateral dive',()=>{const pose=K.createPose();P.keeperAt(K.plan(.15,1,.1),.6,pose);assert.ok(Math.abs(pose.roll)<.15);});

const gestures=require('../js/penalty/gestures.js');
function stroke(points){const s=gestures.begin(gestures.create(),...points[0]);for(const p of points.slice(1))gestures.move(s,...p);return gestures.curve(s);}
test('straight diagonal gestures aim without accidentally adding curl',()=>{
 for(const dx of [-160,0,160])assert.equal(stroke([[200,500],[200+dx*.25,400],[200+dx*.5,300],[200+dx*.75,200],[200+dx,100]]),0);
});
test('a change of swipe direction gives mirrored left/right curl on every screen scale',()=>{
 const path=[[0,100],[-15,75],[-20,50],[-15,25],[0,0]],right=stroke(path);
 assert.ok(right>.5);assert.equal(stroke(path.map(([x,y])=>[-x,y])),-right);
 for(const scale of [.5,1,3])assert.ok(Math.abs(stroke(path.map(([x,y])=>[x*scale+100,y*scale+300]))-right)<1e-10);
});
test('tiny gestures and slight hand jitter do not add spin',()=>{
 assert.equal(stroke([[0,10],[3,5],[0,0]]),0);
 assert.equal(stroke([[100,500],[101,400],[99,300],[101,200],[100,100]]),0);
});
test('difficulty levels have distinct, forgiving save rates across 3000 seeded on-target shots',()=>{
 const results={};
 for(const level of Object.keys(P.DIFFICULTY)){
 let goals=0,saves=0;const random=P.rng(4201);
 for(let n=0;n<3000;n++){
 const shot=P.createShot((random()*2-1)*3.2,.25+random()*1.85,P.SHOT_POWER,(random()*2-1)*.85);
 const flight=new P.Flight().launch(shot,P.makeKeeper(shot,level,random),true);
 while(!flight.outcome)flight.step();
 if(flight.outcome==='goal')goals++;if(flight.outcome==='saved')saves++;
 }
 results[level]={label:P.DIFFICULTY[level].label,shots:3000,goals,saves,saveRate:saves/3000};
 }
 assert.ok(results.rookie.saveRate>.10&&results.rookie.saveRate<.28);
 assert.ok(results.pro.saveRate>.20&&results.pro.saveRate<.36);
 assert.ok(results.elite.saveRate>.32&&results.elite.saveRate<.48);
 assert.ok(results.pro.saveRate-results.rookie.saveRate>.07);
 assert.ok(results.elite.saveRate-results.pro.saveRate>.07);
 const fs=require('node:fs'),path=require('node:path'),out=path.join(__dirname,'../verification');
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'difficulty.json'),JSON.stringify({method:'Same seed and 3000 distributed on-target shots per level. Simulation calibration, not player success rates.',results},null,2));
});
test('every difficulty makes fallible guesses and allows both corners to be scored',()=>{
 for(const level of Object.keys(P.DIFFICULTY)){
 let wrong=0;const random=P.rng(721);let goals=0;
 for(let n=0;n<300;n++){
 const shot=P.createShot(n%2?3:-3,1.8,P.SHOT_POWER,n%2?.5:-.5),keeper=P.makeKeeper(shot,level,random);
 if(Math.sign(keeper.x)!==Math.sign(shot.targetX))wrong++;
 const f=new P.Flight().launch(shot,keeper,true);while(!f.outcome)f.step();if(f.outcome==='goal')goals++;
 }
 assert.ok(wrong>15);assert.ok(goals>100);
 }
});

test('freehand shots retain arches and both bends of an S curve',()=>{
 const points=new Float64Array(65*3);
 for(let i=0;i<65;i++){const u=i/64;points[i*3]=Math.sin(u*Math.PI*2)*1.4;points[i*3+1]=P.R+(1-P.R)*u+Math.sin(u*Math.PI)*2;points[i*3+2]=11*(1-u);}
 const shot=P.createPathShot(points),out={};assert.ok(shot.maxY>2.4);assert.ok(shot.path[16*3]>1.3);assert.ok(shot.path[48*3]<-1.3);
 P.sampleShot(shot,shot.T,out);assert.ok(Math.abs(out.x)<1e-8);assert.ok(Math.abs(out.y-1)<1e-8);assert.ok(Math.abs(out.z)<1e-8);
 const flight=new P.Flight().launch(shot,K.plan(0,1,2),false);while(!flight.outcome)flight.step();assert.equal(flight.outcome,'goal');
});
test('long gestures retain their beginning, end and complete resampled shape',()=>{
 const g=gestures.begin(gestures.create(),100,800);
 for(let i=1;i<=900;i++)gestures.move(g,100+Math.sin(i/900*Math.PI*2)*150,800-i*.7);
 const path=gestures.sample(g,65);assert.equal(path[0],100);assert.equal(path[1],800);
 assert.ok(Math.abs(path[128]-100)<1e-8);assert.ok(Math.abs(path[129]-170)<1e-8);
 assert.ok(Math.max(...Array.from(path).filter((_,i)=>i%2===0))>240);assert.ok(Math.min(...Array.from(path).filter((_,i)=>i%2===0))< -40);
});
test('keeper limbs stay connected at fixed lengths through left and right dives and recovery',()=>{
 for(const x of [-2.8,2.8])for(const y of [.3,1.3,2.2]){
 const plan=K.plan(x,y,.12),pose=K.createPose();let previous=null,maxStep=0;const stages=new Set();
 for(let t=0;t<=plan.endTime+.1;t+=1/240){
 K.poseAt(plan,t,pose);stages.add(pose.stage);const a=pose.joints;
 for(const [i,j,len] of [[4,5,K.upperArm],[5,6,K.forearm],[8,9,K.upperArm],[9,10,K.forearm],[12,13,K.thigh],[13,14,K.shin],[16,17,K.thigh],[17,18,K.shin]]){
 assert.ok(Math.abs(Math.hypot(a[i*3]-a[j*3],a[i*3+1]-a[j*3+1],a[i*3+2]-a[j*3+2])-len)<1e-8);
 }
 for(let j=0;j<20;j++){assert.ok(a[j*3+1]>=.025);if(previous)maxStep=Math.max(maxStep,Math.hypot(a[j*3]-previous[j*3],a[j*3+1]-previous[j*3+1],a[j*3+2]-previous[j*3+2]));}
 if(pose.stage==='shuffle')assert.ok(Math.min(a[K.J.la*3+1],a[K.J.ra*3+1])<=.101,'A shuffle always keeps a supporting foot on the ground');
 previous=Array.from(a);
 }
 assert.ok(maxStep<.08,'No limb should teleport between 240 Hz samples: '+maxStep);
 assert.deepEqual([...stages],['set','plant','dive','land','kneel','rise','shuffle']);assert.ok(Math.abs(pose.x)<1e-8);assert.ok(Math.abs(pose.roll)<1e-8);
 }
});
test('keeper feet plant before take-off and visible gloves determine contact',()=>{
 const k=K.plan(2.7,2,.12),p=K.createPose();K.poseAt(k,.19,p);
 assert.ok(Math.abs(p.joints[K.J.la*3]+.34)<.005);assert.ok(Math.abs(p.joints[K.J.la*3+1]-.10)<1e-8);
 K.poseAt(k,k.start+.20,p);assert.ok(p.joints[K.J.la*3+1]>.2&&p.joints[K.J.ra*3+1]>.2);
 const i=K.J.rf*3;assert.equal(K.contact(p,p.joints[i],p.joints[i+1],p.joints[i+2]),'glove');assert.equal(K.contact(p,7,1,.7),null);
});

test('high central shots trigger a two-foot vertical jump with grounded landing',()=>{
 const k=K.plan(0,2.3,.08),p=K.createPose();assert.equal(k.leap,true);
 K.poseAt(k,k.start+.18,p);assert.equal(p.stage,'jump');assert.ok(p.y>1.05);assert.ok(Math.abs(p.roll)<1e-8);
 assert.ok(p.joints[K.J.la*3+1]>.30&&p.joints[K.J.ra*3+1]>.30);
 K.poseAt(k,k.leapLand+.12,p);assert.equal(p.stage,'land');assert.ok(p.joints[K.J.la*3+1]<.101&&p.joints[K.J.ra*3+1]<.101);
 K.poseAt(k,1.5,p);assert.ok(Math.abs(p.y-.83)<1e-8);
});
