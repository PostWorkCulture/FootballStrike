/* Deterministic 120 Hz penalty simulation. Coordinates: goal z=0, ball z=11. */
(function(root){
'use strict';
const K=root.FSKeeper||(typeof require==='function'?require('./keeper.js'):null);
const R=.11,G=9.81,STEP=1/120,SHOT_POWER=.7,KICK_DELAY=.18;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DIFFICULTY={
 rookie:{label:'Easy',description:'More time to beat the keeper',reaction:.17,moveSpeed:3.0,reach:2.8,error:1.15,wrongWay:.28,rival:.48},
 pro:{label:'Normal',description:'A balanced challenge',reaction:.08,moveSpeed:3.7,reach:3.1,error:.85,wrongWay:.20,rival:.62},
 elite:{label:'Hard',description:'Faster reactions, tighter angles',reaction:.015,moveSpeed:4.5,reach:3.3,error:.65,wrongWay:.17,rival:.74}
};
function rng(seed){let s=seed>>>0;return ()=>{s=(Math.imul(1664525,s)+1013904223)>>>0;return s/4294967296;};}
function createShot(x,y,power,curve,originX=0){
power=clamp(power,.15,1);curve=clamp(curve,-1,1);x=clamp(x,-5.5,5.5);y=clamp(y,R,4.5);
const speed=19+power*15,T=11/speed,ax=curve*1.5;
const vx=(x-originX-.5*ax*T*T)/T,vy=(y-R+.5*G*T*T)/T;
return {x:originX,y:R,z:11,vx,vy,vz:-speed,ax,T,power,curve,targetX:x,targetY:y,speed:Math.hypot(vx,vy,speed)*3.6};
}
function keeperAt(k,t,out){return K.poseAt(k,t,out);}
function makeKeeper(shot,difficulty,random){
 const d=DIFFICULTY[difficulty]||DIFFICULTY.pro;
 // The keeper commits to an imperfect read, rather than tracking every later bend.
 let readX=shot.targetX,readY=shot.targetY;
 if(shot.path){const q={};sampleShot(shot,shot.T*.22,q);const depth=Math.max(.06,(11-q.z)/11);readX=mix(shot.targetX,clamp(shot.x+(q.x-shot.x)/depth,-4,4),.35);readY=mix(shot.targetY,clamp(q.y, .2,2.5),.25);}
 const guess=random()<d.wrongWay?-Math.sign(readX||1):Math.sign(readX||1);
 return K.plan(clamp(guess*Math.abs(readX)+(random()-.5)*d.error*2,-d.reach,d.reach),clamp(readY+(random()-.5)*d.error*1.3,.25,2.4),d.reaction,d.moveSpeed);
}
const mix=(a,b,t)=>a+(b-a)*t;
function createPathShot(points){
 const path=new Float64Array(points),count=path.length/3;
 // Two small smoothing passes remove pointer jitter without removing the drawn bends.
 for(let pass=0;pass<2;pass++){const copy=path.slice();for(let i=1;i<count-1;i++)for(let c=0;c<2;c++)path[i*3+c]=copy[(i-1)*3+c]*.18+copy[i*3+c]*.64+copy[(i+1)*3+c]*.18;}
 const times=new Float64Array(count);let length=0,maxY=0;
 for(let i=0;i<count;i++){path[i*3+1]=Math.max(R,path[i*3+1]);maxY=Math.max(maxY,path[i*3+1]);if(i){length+=Math.hypot(path[i*3]-path[(i-1)*3],path[i*3+1]-path[(i-1)*3+1],path[i*3+2]-path[(i-1)*3+2]);times[i]=length;}}
 for(let i=1;i<count;i++)times[i]/=length;
 const end=(count-1)*3,speed=29.5,T=length/speed;
 return {x:path[0],y:path[1],z:path[2],vx:0,vy:0,vz:-speed,ax:0,T,power:SHOT_POWER,curve:0,targetX:path[end],targetY:path[end+1],speed:speed*3.6,path,times,maxY,length,drawn:true};
}
function sampleShot(shot,t,out){
 if(!shot.path){out.x=shot.x+shot.vx*t+.5*shot.ax*t*t;out.y=R+shot.vy*t-.5*G*t*t;out.z=11+shot.vz*t;return out;}
 const points=shot.path,times=shot.times,count=times.length,s=t/shot.T;
 if(s>=1){
 const i=(count-1)*3,j=i-3,dt=(1-times[count-2])*shot.T,extra=t-shot.T;
 out.x=points[i]+(points[i]-points[j])/dt*extra;out.y=points[i+1]+(points[i+1]-points[j+1])/dt*extra-.5*G*extra*extra;out.z=points[i+2]+(points[i+2]-points[j+2])/dt*extra;return out;
 }
 let low=0,high=count-1;while(high-low>1){const mid=(low+high)>>1;if(times[mid]<=s)low=mid;else high=mid;}
 const u=clamp((s-times[low])/(times[high]-times[low]||1),0,1);
 for(let c=0;c<3;c++){
 const p0=points[Math.max(0,low-1)*3+c],p1=points[low*3+c],p2=points[high*3+c],p3=points[Math.min(count-1,high+1)*3+c];
 const value=c===2?mix(p1,p2,u):.5*((2*p1)+(-p0+p2)*u+(2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u);
 if(c===0)out.x=value;else if(c===1)out.y=Math.max(R,value);else out.z=value;
 }
 return out;
}
function pointSegmentDistance(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,n=dx*dx+dy*dy;const t=n?clamp(((px-ax)*dx+(py-ay)*dy)/n,0,1):0;return Math.hypot(px-ax-dx*t,py-ay-dy*t);}
class Flight{
 constructor(){this.ball={x:0,y:R,z:11,vx:0,vy:0,vz:0,ax:0};this.keeper=K.plan(0,1,1);this.pose=K.createPose();this.hitPose=K.createPose();this.pathSample={};this.time=0;this.outcome=null;this.keeperEnabled=true;this.netHit=0;this.net={age:10,strength:0,x:0,y:1};this.resetSpin();}
 launch(shot,keeper,enabled=true){Object.assign(this.ball,shot);this.keeper=keeper.kind?{...keeper}:K.plan(keeper.x,keeper.y,keeper.reaction);this.shot=shot;this.caught=false;this.savePart=null;this.keeperEnabled=enabled;this.time=0;this.outcome=null;this.netHit=0;this.frameHit=false;this.settled=false;this.groundBounces=0;Object.assign(this.net,{age:10,strength:0,x:0,y:1});this.resetSpin();this.ball.wx=-26;this.ball.wy=shot.curve*8;this.ball.wz=-shot.vx*.18;return this;}
 resetSpin(){Object.assign(this.ball,{rx:0,ry:0,rz:0,wx:0,wy:0,wz:0});}
 spin(dt){const b=this.ball;b.rx+=b.wx*dt;b.ry+=b.wy*dt;b.rz+=b.wz*dt;}
 impactNet(speed){this.netHit++;Object.assign(this.net,{age:0,strength:clamp(speed/55,.12,.55),x:this.ball.x,y:this.ball.y});}
 goalStep(dt){
 const b=this.ball;if(this.settled)return;
 b.vy-=G*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
 // Fabric absorbs nearly all impact energy. The small rebound stays inside the goal.
 const back=-2.2+clamp(b.y,R,2.44-R)/2.44*1.2+R;
 if(b.z<back){if(!this.netHit)this.impactNet(Math.abs(b.vz));b.z=back;b.vz=Math.min(.65,Math.abs(b.vz)*.022);b.vx*=.12;b.vy*=.22;b.wx*=.12;b.wy*=.12;b.wz*=.12;}
 if(Math.abs(b.x)>3.66-R){if(!this.netHit)this.impactNet(Math.abs(b.vx));b.x=clamp(b.x,-3.66+R,3.66-R);b.vx*=-.06;b.vz*=.45;b.vy*=.4;}
 if(b.y>2.44-R){b.y=2.44-R;b.vy=-Math.abs(b.vy)*.12;b.vx*=.4;b.vz*=.5;}
 if(b.y<=R){
 b.y=R;
 if(b.vy<-.65){b.vy=-b.vy*.28;this.groundBounces++;}else b.vy=0;
 const friction=Math.exp(-9*dt);b.vx*=friction;b.vz*=friction;
 b.wx=b.vz/R;b.wz=-b.vx/R;b.wy*=Math.exp(-14*dt);
 if(b.vy===0&&Math.hypot(b.vx,b.vz)<.035){b.vx=b.vy=b.vz=b.wx=b.wy=b.wz=0;this.settled=true;}
 }else{const drag=Math.exp(-1.8*dt);b.vx*=drag;b.vz*=drag;b.wx*=drag;b.wy*=drag;b.wz*=drag;}
 this.spin(dt);
 }
 step(dt=STEP){
 const b=this.ball;const px=b.x,py=b.y,pz=b.z;this.time+=dt;this.net.age+=dt;
 keeperAt(this.keeper,this.time,this.pose);
 if(this.caught){const a=this.pose.joints,l=K.J.lf*3,r=K.J.rf*3;b.x=(a[l]+a[r])/2;b.y=(a[l+1]+a[r+1])/2;b.z=(a[l+2]+a[r+2])/2+.06;b.vx=b.vy=b.vz=b.ax=b.wx=b.wy=b.wz=0;return;}
 if(this.outcome==='goal'){this.goalStep(dt);return;}
 this.spin(dt);
 if(this.shot.path&&!this.outcome){sampleShot(this.shot,this.time,this.pathSample);b.x=this.pathSample.x;b.y=this.pathSample.y;b.z=this.pathSample.z;b.vx=(b.x-px)/dt;b.vy=(b.y-py)/dt;b.vz=(b.z-pz)/dt;}
 else{b.x+=b.vx*dt+.5*b.ax*dt*dt;b.y+=b.vy*dt-.5*G*dt*dt;b.z+=b.vz*dt;b.vx+=b.ax*dt;b.vy-=G*dt;}
 if(b.y<R){b.y=R;b.vy=Math.abs(b.vy)*.42;b.vx*=.985;b.vz*=.985;}
 if(this.outcome){if(b.z>15||b.z<-12){b.vx*=.97;b.vz*=.97;}return;}
 // Sweep against the actual animated gloves, limbs, head and torso.
 if(this.keeperEnabled&&pz>-.6&&b.z<1.4){
 for(let n=1;n<=4;n++){
 const u=n/4,x=mix(px,b.x,u),y=mix(py,b.y,u),z=mix(pz,b.z,u),at=this.time-dt+dt*u;
 keeperAt(this.keeper,at,this.hitPose);const part=K.contact(this.hitPose,x,y,z,R);
 if(part){
 this.outcome='saved';this.savePart=part;this.keeper.saveAt=at;this.caught=part==='glove'&&this.keeper.kind==='centre'&&!this.keeper.leap;this.keeper.caught=this.caught;
 b.x=x;b.y=y;b.z=z;b.vz=Math.abs(b.vz)*.28;b.vx=this.keeper.dir*(3.5+Math.abs(b.vx)*.25);b.vy=Math.min(3.5,.65+Math.abs(b.vy)*.2);b.ax=0;return;
 }
 }
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
 this.outcome='goal';b.ax=0;
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
root.FSPhysics={R,G,STEP,SHOT_POWER,KICK_DELAY,clamp,rng,createShot,createPathShot,sampleShot,makeKeeper,keeperAt,Flight,Shootout,DIFFICULTY};
if(typeof module!=='undefined')module.exports=root.FSPhysics;
})(typeof window!=='undefined'?window:globalThis);
