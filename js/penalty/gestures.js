/* Screen-space stroke recognition shared by mouse, pen and touch. */
(function(root){
'use strict';
function create(){return {startX:0,startY:0,x:0,y:0,dx:0,dy:0,area:0,distance:0,length:0,count:0,points:new Float32Array(512)};}
function begin(s,x,y){
 s.startX=s.x=x;s.startY=s.y=y;s.dx=s.dy=s.area=s.distance=s.length=0;s.count=1;s.points[0]=x;s.points[1]=y;return s;
}
function move(s,x,y){
 const dx=x-s.startX,dy=y-s.startY,segment=Math.hypot(x-s.x,y-s.y);
 if(segment<.25)return s;
 // Twice the signed area between the stroke and its straight start/end chord.
 // A leftward bow followed by a rightward finish produces rightward spin.
 s.area+=s.dx*dy-s.dy*dx;s.length+=segment;s.x=x;s.y=y;s.dx=dx;s.dy=dy;s.distance=Math.hypot(dx,dy);
 if(s.count===256){for(let i=1;i<128;i++){s.points[i*2]=s.points[i*4];s.points[i*2+1]=s.points[i*4+1];}s.count=128;}
 const i=s.count++;s.points[i*2]=x;s.points[i*2+1]=y;return s;
}
function curve(s){
 if(s.distance<24)return 0;
 const amount=Math.max(-1,Math.min(1,s.area/(s.distance*s.distance*.27)));
 return Math.abs(amount)<.12?0:Math.sign(amount)*(Math.abs(amount)-.12)/.88*.45;
}
root.FSGestures={create,begin,move,curve};
if(typeof module!=='undefined')module.exports=root.FSGestures;
})(typeof window!=='undefined'?window:globalThis);

/* Resample the entire freehand stroke by travelled distance, not event timing.
   No reduction to a single curl parameter: arches and S-curves retain their shape. */
(function(root){
'use strict';const G=root.FSGestures;
G.sample=function(s,count=65,bendStrength=1){
 const out=new Float64Array(count*2),distances=new Float64Array(s.count);let total=0;
 for(let i=1;i<s.count;i++){total+=Math.hypot(s.points[i*2]-s.points[(i-1)*2],s.points[i*2+1]-s.points[(i-1)*2+1]);distances[i]=total;}
 let cursor=1;
 for(let i=0;i<count;i++){const d=total*i/(count-1);while(cursor<s.count-1&&distances[cursor]<d)cursor++;
 const before=Math.max(0,cursor-1),span=distances[cursor]-distances[before],u=span?(d-distances[before])/span:0;
 out[i*2]=s.points[before*2]+(s.points[cursor*2]-s.points[before*2])*u;out[i*2+1]=s.points[before*2+1]+(s.points[cursor*2+1]-s.points[before*2+1])*u;
 }
 // Assist the bend around the straight start/end chord without shifting the aim.
 // Ignore small hand wobbles at every screen size; intentional bends keep their sign.
 if(bendStrength<1){
 const deadZone=s.distance*.02;
 for(let i=1;i<count-1;i++){
 const q=i/(count-1),cx=s.startX+s.dx*q,cy=s.startY+s.dy*q;
 for(let c=0;c<2;c++){
 const base=c?cy:cx,delta=out[i*2+c]-base;
 out[i*2+c]=base+Math.sign(delta)*Math.max(0,Math.abs(delta)-deadZone)*bendStrength;
 }
 }
 }
 return out;
};
})(typeof window!=='undefined'?window:globalThis);
