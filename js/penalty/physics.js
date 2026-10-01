/* Deterministic 120 Hz penalty simulation. Coordinates: goal z=0, ball z=11. */
(function(root){
'use strict';
const R=.11,G=9.81,STEP=1/120;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIFFICULTY={rookie:{reaction:.23,reach:2.15,error:.65,rival:.55},pro:{reaction:.16,reach:2.65,error:.4,rival:.68},elite:{reaction:.11,reach:3.05,error:.22,rival:.78}};
function rng(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
function createShot(x,y,power,curve){
power=clamp(power,.15,1);curve=clamp(curve,-1,1);x=clamp(x,-5.5,5.5);y=clamp(y,R,4.5);
const speed=19+power*15,T=11/speed,ax=curve*14;
return {x:0,y:R,z:11,vx:(x-.5*ax*T*T)/T,vy:(y-R+.5*G*T*T)/T,vz:-speed,ax,T,power,curve,targetX:x,targetY:y,speed:speed*3.6};
}
function keeperAt(k,t,out){
const a=clamp((t-k.reaction)/.3,0,1),u=a*a*(3-2*a);
out.x=k.x*u;out.y=1+Math.max(0,k.y-1)*u-.65*u*(k.y<.8?1:0);
out.roll=-Math.sign(k.x)*1.12*u;out.extension=.33+.58*u;
return out;
}
function makeKeeper(shot,difficulty,random){
const d=DIFFICULTY[difficulty]||DIFFICULTY.pro;
const guess=random()<.13?-Math.sign(shot.targetX||1):Math.sign(shot.targetX||1);
return {reaction:d.reaction,x:clamp(guess*Math.abs(shot.targetX)+(random()-.5)*d.error*2,-d.reach,d.reach),y:clamp(shot.targetY+(random()-.5)*d.error,.35,2.1)};
}
function pointSegmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,n=dx*dx+dy*dy;const t=n?clamp(((px-ax)*dx+(py-ay)*dy)/n,0,1):0;return Math.hypot(px-ax-dx*t,py-ay-dy*t);}
class Flight{
 constructor(){this.ball={x:0,y:R,z:11,vx:0,vy:0,vz:0,ax:0};this.keeper={reaction:1,x:0,y:1};this.pose={x:0,y:1,roll:0,extension:.33};this.time=0;this.outcome=null;this.keeperEnabled=true;this.netHit=0;}
 launch(shot,keeper,enabled=true){Object.assign(this.ball,shot);Object.assign(this.keeper,keeper);this.keeperEnabled=enabled;this.time=0;this.outcome=null;this.netHit=0;this.frameHit=false;return this;}
 step(dt=STEP){
 const b=this.ball;const px=b.x,py=b.y,pz=b.z;this.time+=dt;
 keeperAt(this.keeper,this.time,this.pose);
 if(this.outcome==='goal'){
 b.vx*=Math.exp(-5*dt);b.vz*=Math.exp(-7*dt);b.vy-=G*dt;
 b.x=clamp(b.x+b.vx*dt,-3.45,3.45);b.y=Math.max(R,b.y+b.vy*dt);
 const backNet=-1.8+b.y/2.44*1.3+R;b.z=Math.max(backNet,b.z+b.vz*dt);
 if(b.y===R)b.vy=0;return;
 }
 b.x+=b.vx*dt+.5*b.ax*dt*dt;b.y+=b.vy*dt-.5*G*dt*dt;b.z+=b.vz*dt;b.vx+=b.ax*dt;b.vy-=G*dt;
 if(b.y<R){b.y=R;b.vy=Math.abs(b.vy)*.42;b.vx*=.985;b.vz*=.985;}
 if(this.outcome){if(b.z>15||b.z<-12){b.vx*=.97;b.vz*=.97;}return;}
 // Swept intersection at keeper's plane. The same pose drives rendering and collision.
 if(this.keeperEnabled&&pz>.48&&b.z<=.48){
 const u=(pz-.48)/(pz-b.z),x=px+(b.x-px)*u,y=py+(b.y-py)*u;
 const k=this.pose,dir=Math.sign(this.keeper.x||1);
 const handX=k.x+dir*k.extension,handY=k.y+.3;
 const body=pointSegmentDistance(x,y,k.x,k.y-.4,k.x-dir*.32,k.y+.22)<.34+R;
 const arm=pointSegmentDistance(x,y,k.x,k.y+.15,handX,handY)<.13+R;
 const hand=Math.hypot(x-handX,y-handY)<.18+R;
 if(body||arm||hand){this.outcome='saved';b.z=.5;b.vz=Math.abs(b.vz)*.28;b.vx=dir*4;b.vy=2.8;b.ax=0;return;}
 }
 // Test the full swept segment against both uprights and the crossbar before crossing.
 if(pz>0&&b.z<=0){
 const u=clamp(pz/(pz-b.z),0,1),x=px+(b.x-px)*u,y=py+(b.y-py)*u;
 const post=(Math.abs(Math.abs(x)-3.66)<R+.06&&y<=2.5);
 const bar=(Math.abs(y-2.44)<R+.06&&Math.abs(x)<=3.72);
 if(post||bar){this.outcome='post';this.frameHit=true;b.vz=Math.abs(b.vz)*.45;b.vx*=post?-.5:.7;b.vy=bar?-Math.abs(b.vy)*.4:Math.max(1,b.vy*.5);b.ax=0;return;}
 }
 // A goal requires the whole ball to cross the line inside the frame.
 if(pz>-R&&b.z<=-R){
 const u=(pz+R)/(pz-b.z),x=px+(b.x-px)*u,y=py+(b.y-py)*u;
 if(Math.abs(x)<3.66-R-.06&&y<2.44-R-.06&&y>=R-.001){
 this.outcome='goal';this.netHit=1;b.ax=0;
 }else this.outcome='wide';
 }
 if(this.time>3.5&&!this.outcome)this.outcome='wide';
 }
}
class Shootout{
 constructor(){this.home=[];this.away=[];this.done=false;this.winner=null;}
 add(homeGoal,awayGoal){
 if(this.done)return false;
 this.home.push(!!homeGoal);this.away.push(!!awayGoal);
 const h=this.home.filter(Boolean).length,a=this.away.filter(Boolean).length,n=this.home.length;
 const left=Math.max(0,5-n);
 if((n<5&&Math.abs(h-a)>left)||(n>=5&&h!==a)){this.done=true;this.winner=h>a?'home':'away';}
 return true;
 }
 get score(){return [this.home.filter(Boolean).length,this.away.filter(Boolean).length];}
}
root.FSPhysics={R,G,STEP,clamp,rng,createShot,makeKeeper,keeperAt,Flight,Shootout,DIFFICULTY};
if(typeof module!=='undefined')module.exports=root.FSPhysics;
})(typeof window!=='undefined'?window:globalThis);
