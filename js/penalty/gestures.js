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
 const i=Math.min(s.count,255);s.points[i*2]=x;s.points[i*2+1]=y;s.count=Math.min(256,s.count+1);return s;
}
function curve(s){
 if(s.distance<24)return 0;
 const amount=Math.max(-1,Math.min(1,s.area/(s.distance*s.distance*.27)));
 return Math.abs(amount)<.08?0:Math.sign(amount)*(Math.abs(amount)-.08)/.92;
}
root.FSGestures={create,begin,move,curve};
if(typeof module!=='undefined')module.exports=root.FSGestures;
})(typeof window!=='undefined'?window:globalThis);
