/* Deterministic anatomical goalkeeper rig. Joint positions drive both skinning and collisions. */
(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const J={hips:0,chest:1,head:2,crown:3,ls:4,le:5,lw:6,lf:7,rs:8,re:9,rw:10,rf:11,lh:12,lk:13,la:14,lt:15,rh:16,rk:17,ra:18,rt:19};
const REST=[
[0,.99,0],[0,1.45,0],[0,1.61,.01],[0,1.83,.01],
[-.255,1.435,0],[-.29,1.118,0],[-.29,.828,.035],[-.29,.73,.035],
[.255,1.435,0],[.29,1.118,0],[.29,.828,.035],[.29,.73,.035],
[-.115,.99,0],[-.115,.52,.015],[-.115,.10,0],[-.115,.055,.19],
[.115,.99,0],[.115,.52,.015],[.115,.10,0],[.115,.055,.19]];
const BONES=[['Hips',0,1],['Spine',0,1],['Head',2,3],['LeftUpperArm',4,5],['LeftForearm',5,6],['LeftHand',6,7],['RightUpperArm',8,9],['RightForearm',9,10],['RightHand',10,11],['LeftThigh',12,13],['LeftShin',13,14],['LeftFoot',14,15],['RightThigh',16,17],['RightShin',17,18],['RightFoot',18,19]];
const upperArm=Math.hypot(.035,.317),forearm=Math.hypot(.29,.035),thigh=Math.hypot(.47,.015),shin=Math.hypot(.42,.015);
function put(a,i,x,y,z){i*=3;a[i]=x;a[i+1]=y;a[i+2]=z;}
function local(o,i,x,y,z){
 const yy=y*o.cp-z*o.sp,zz=y*o.sp+z*o.cp;
 put(o.joints,i,o.x+x*o.cr-yy*o.sr,o.y+x*o.sr+yy*o.cr,o.z+zz);
}
function ik(a,start,middle,end,l1,l2,px,py,pz){
 const ai=start*3,bi=end*3,mi=middle*3,ax=a[ai],ay=a[ai+1],az=a[ai+2];
 let dx=a[bi]-ax,dy=a[bi+1]-ay,dz=a[bi+2]-az,len=Math.hypot(dx,dy,dz);
 if(len<.00001){dx=0;dy=-1;dz=0;len=1;}
 dx/=len;dy/=len;dz/=len;const d=clamp(len,Math.abs(l1-l2)+.003,l1+l2-.003);
 a[bi]=ax+dx*d;a[bi+1]=ay+dy*d;a[bi+2]=az+dz*d;
 let bx=px-ax,by=py-ay,bz=pz-az,projection=bx*dx+by*dy+bz*dz;
 bx-=projection*dx;by-=projection*dy;bz-=projection*dz;
 let n=Math.hypot(bx,by,bz);if(n<.001){bx=-dy;by=dx;bz=0;n=Math.hypot(bx,by)||1;}
 const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 a[mi]=ax+dx*along+bx/n*height;a[mi+1]=ay+dy*along+by/n*height;a[mi+2]=az+dz*along+bz/n*height;
}
function createPose(){return {joints:new Float64Array(60),x:0,y:.83,z:.12,roll:0,pitch:.14,extension:0,stage:'set',cr:1,sr:0,cp:1,sp:0,contact:false};}
function plan(x,y,reaction,maxSpeed=3.7){
 const dir=Math.sign(x)||1,kind=Math.abs(x)<.58?'centre':y<.78?'low':y>1.65?'high':'mid';
 const push=.13,start=reaction+push,vy=kind==='high'?2.6:kind==='mid'?1.6:.1,startY=.83;
 const air=(vy+Math.sqrt(vy*vy+2*9.81*(startY-.36)))/9.81;
 const vx=dir*Math.min(maxSpeed,2.2+Math.abs(x)*.62,2.85/air);
 const land=start+air,landX=dir*.18+vx*air,cycles=Math.max(2,Math.ceil((Math.abs(landX)+.16)/.43));
 return {x,y,dir,kind,reaction,push,start,startY,vy,vx,land,landX,cycles,returnStart:land+.94,endTime:kind==='centre'?1.5:land+.94+cycles*.26,saveAt:-1};
}
function shuffleTravel(k,side,p){
 const delay=side===k.dir?0:.5,phase=p*k.cycles-delay;
 if(phase<=0)return 0;
 return clamp((Math.floor(phase)+smooth((phase-Math.floor(phase))/.42))/(k.cycles-delay),0,1);
}
function poseAt(k,t,o){
 const a=o.joints,dir=k.dir||Math.sign(k.x)||1,kind=k.kind||'centre';
 const time=Math.max(0,t),load=smooth((t-k.reaction)/(k.push||.13));
 let airborne=0,landBlend=0,recovery=0,returning=0;
 o.x=0;o.y=.83;o.z=.12;o.roll=0;o.pitch=.14;o.stage='set';o.contact=k.saveAt>=0&&t>=k.saveAt;
 if(kind==='centre'){
 const action=smooth((t-k.reaction)/.16),release=1-smooth((t-.65)/.5),u=action*release;
 o.y-=Math.max(0,.8-k.y)*.28*u;o.pitch+=.10*u;o.stage=u>.01?'block':'set';o.extension=u;
 if(k===READY){o.x=Math.sin(time*1.25)*.008;o.y+=Math.sin(time*2.4)*.003;o.pitch+=Math.sin(time*2.4)*.004;}
 }else if(t<k.start){
 o.x=dir*.18*load;o.y=.83-.09*Math.sin(load*Math.PI);o.pitch=.14+.10*Math.sin(load*Math.PI);o.roll=-dir*.14*load;o.stage=load>0?'plant':'set';o.extension=load*.18;
 }else if(t<k.land){
 const air=t-k.start;airborne=smooth(air/.16);o.x=dir*.18+k.vx*air;o.y=k.startY+k.vy*air-4.905*air*air;
 o.roll=-dir*mix(.14,kind==='low'?1.42:kind==='high'?1.10:1.28,smooth(air/.25));o.pitch=mix(.14,.12,smooth(air/.10));o.stage='dive';o.extension=.18+.82*smooth(air/.17);
 }else if(t<k.land+.20){
 const u=smooth((t-k.land)/.20);airborne=1;landBlend=u;o.x=k.landX+dir*.16*u;o.y=.36-.025*Math.sin(u*Math.PI);o.roll=-dir*mix(kind==='low'?1.42:kind==='high'?1.10:1.28,1.42,u);o.pitch=.12+.14*u;o.stage='land';o.extension=1-.55*u;
 }else if(t<k.returnStart){
 const u=smooth((t-k.land-.20)/.74);recovery=u;airborne=1-u;landBlend=1;
 o.x=k.landX+dir*.16;o.y=mix(.36,.83,u);o.roll=-dir*1.42*(1-u);o.pitch=mix(.26,.14,u)+.30*Math.sin(u*Math.PI);o.stage=u<.6?'kneel':'rise';o.extension=.45*(1-u);
 }else{
 const duration=k.cycles*.26,p=clamp((t-k.returnStart)/duration,0,1);returning=p;
 o.x=(k.landX+dir*.16)*(1-(smooth(shuffleTravel(k,-1,p))+smooth(shuffleTravel(k,1,p)))*.5);o.y=.83+Math.sin(p*k.cycles*2*Math.PI)*.015*Math.sin(Math.PI*p);o.pitch=.14;o.stage=p<1?'shuffle':'set';o.extension=0;
 }
 o.cr=Math.cos(o.roll);o.sr=Math.sin(o.roll);o.cp=Math.cos(o.pitch);o.sp=Math.sin(o.pitch);
 local(o,J.hips,0,0,0);local(o,J.chest,0,.46,0);local(o,J.head,0,.62,.01);local(o,J.crown,0,.84,.01);
 for(let side=-1;side<=1;side+=2){
 const shoulder=side<0?J.ls:J.rs,elbow=shoulder+1,wrist=shoulder+2,fingers=shoulder+3,hip=side<0?J.lh:J.rh,knee=hip+1,ankle=hip+2,toe=hip+3;
 local(o,shoulder,side*.255,.445,0);local(o,hip,side*.115,0,0);
 // Independent feet remain planted through loading; knees solve towards the pitch-facing pole.
 let fx=side*.34+dir*.18*load,fy=.10,fz=.05;
 if(o.stage==='set'||kind==='centre'){fx=side*.34;fy=.10;}
 else if(o.stage==='plant'){fx=side*.34+(side===dir?dir*.18*load:0);fy=.10+(side===dir?.025*Math.sin(load*Math.PI):0);}
 else if(o.stage==='shuffle'){
 const p=returning,delay=side===dir?0:.5,phase=p*k.cycles-delay,step=Math.max(0,Math.floor(phase)),part=phase<0?0:phase-step;
 const travel=shuffleTravel(k,side,p),origin=k.landX+dir*.16;
 fx=origin*(1-smooth(travel))+side*.34;fy=.10+(phase>=0&&part<.42?.065*Math.sin(Math.PI*part/.42):0);

 }else{
 const trailing=side!==dir;
 local(o,ankle,side*.16,trailing?-.58:-.81,trailing?-.18:.025);
 fx=a[ankle*3];fy=Math.max(.10,a[ankle*3+1]);fz=a[ankle*3+2];
 if(o.stage==='dive'){const u=smooth((t-k.start)/.18);fx=mix(side*.34+(side===dir?dir*.18:0),fx,u);fy=mix(.10,fy,u);fz=mix(.05,fz,u);}
 if(o.stage==='land'){fx=mix(fx,o.x-dir*.64+side*.13,landBlend);fy=mix(fy,.10,landBlend);fz=mix(fz,.20,landBlend);}
 if(o.stage==='kneel'||o.stage==='rise'){fx=mix(o.x-dir*.64+side*.13,o.x+side*.34,recovery);fy=.10;fz=mix(.20,.05,recovery);}
 }
 put(a,ankle,fx,fy,fz);ik(a,hip,knee,ankle,thigh,shin,a[hip*3],a[hip*3+1],o.z+.75);
 put(a,toe,a[ankle*3],Math.max(.04,a[ankle*3+1]-.045),a[ankle*3+2]+.19);
 // Hands lead the dive; the following hand closes towards the leading hand a moment later.
 const lead=side===dir,extension=kind==='centre'?o.extension:clamp(o.extension-(lead?0:.10),0,1);
 local(o,wrist,side*.28,.24,.31);
 const sx=a[shoulder*3],sy=a[shoulder*3+1],sz=a[shoulder*3+2],tx=k.x+(lead?0:-dir*.14)-sx,ty=k.y-sy,tz=.72-sz,reach=Math.min(1,(upperArm+forearm-.006)/Math.hypot(tx,ty,tz));
 let hx=mix(a[wrist*3],sx+tx*reach,extension),hy=mix(a[wrist*3+1],sy+ty*reach,extension),hz=mix(a[wrist*3+2],sz+tz*reach,extension);
 if(o.stage==='land'||o.stage==='kneel'||o.stage==='rise'){
 const u=o.stage==='land'?landBlend:1-smooth(recovery);
 hx=mix(hx,a[J.chest*3]+side*.12,u);hy=mix(hy,Math.max(.16,a[J.chest*3+1]-.07),u);hz=mix(hz,a[J.chest*3+2]+.20,u);
 if((o.stage==='kneel'||o.stage==='rise')&&lead){const support=(1-smooth((recovery-.25)/.4))*smooth(recovery/.12);hx=mix(hx,o.x+dir*.24,support);hy=mix(hy,.15,support);hz=mix(hz,o.z+.35,support);}
 }
 if(k.caught&&t>=k.saveAt){const catchBlend=smooth((t-k.saveAt)/.11);hx=mix(hx,a[J.chest*3]+side*.075,catchBlend);hy=mix(hy,a[J.chest*3+1]-.12,catchBlend);hz=mix(hz,a[J.chest*3+2]+.25,catchBlend);}
 put(a,wrist,hx,Math.max(.15,hy),hz);
 ik(a,shoulder,elbow,wrist,upperArm,forearm,a[shoulder*3]+o.sr,a[shoulder*3+1]-o.cr,a[shoulder*3+2]);
 // Glove centre sits 6 cm beyond the wrist, palms facing the arriving ball.
 const handTurn=smooth(o.extension),handX=mix(side*.01,dir*.055,handTurn),handY=mix(-.085,-.025,handTurn),handZ=.04,handScale=.098/Math.hypot(handX,handY,handZ);
 put(a,fingers,a[wrist*3]+handX*handScale,a[wrist*3+1]+handY*handScale,a[wrist*3+2]+handZ*handScale);
 }
 return o;
}
function segmentDistance3(px,py,pz,ax,ay,az,bx,by,bz){
 const dx=bx-ax,dy=by-ay,dz=bz-az,n=dx*dx+dy*dy+dz*dz,u=n?clamp(((px-ax)*dx+(py-ay)*dy+(pz-az)*dz)/n,0,1):0;
 return Math.hypot(px-ax-dx*u,py-ay-dy*u,pz-az-dz*u);
}
const CAPSULES=[[J.hips,J.chest,.20],[J.head,J.crown,.105],[J.ls,J.le,.075],[J.le,J.lw,.065],[J.rs,J.re,.075],[J.re,J.rw,.065],[J.lh,J.lk,.095],[J.lk,J.la,.065],[J.rh,J.rk,.095],[J.rk,J.ra,.065],[J.lw,J.lf,.10],[J.rw,J.rf,.10]];
function contact(o,x,y,z,radius=.11){
 const a=o.joints;
 for(let n=CAPSULES.length-1;n>=0;n--){const c=CAPSULES[n],i=c[0]*3,j=c[1]*3;
 if(segmentDistance3(x,y,z,a[i],a[i+1],a[i+2],a[j],a[j+1],a[j+2])<radius+c[2])return n>=10?'glove':'body';
 }
 return null;
}
const READY={kind:'centre',x:0,y:1.08,reaction:999,dir:1,endTime:0,saveAt:-1};
function readyAt(t,o){poseAt(READY,t,o);return o;}
root.FSKeeper={READY,readyAt,J,REST,BONES,createPose,plan,poseAt,contact,segmentDistance3,upperArm,forearm,thigh,shin};
if(typeof module!=='undefined')module.exports=root.FSKeeper;
})(typeof window!=='undefined'?window:globalThis);
