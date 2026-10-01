/* Three.js stadium, Blender model presentation and allocation-free match rendering. */
(function(root){
'use strict';
const T=THREE,P=FSPhysics,K=FSKeeper;
const POSE_NODES=['Hips','Torso','Head','LeftArm','RightArm','LeftForearm','RightForearm','LeftLeg','RightLeg','LeftShin','RightShin'];
const V=new T.Vector3(),V2=new T.Vector3(),Q=new T.Quaternion(),Q2=new T.Quaternion(),Q3=new T.Quaternion(),UP=new T.Vector3(0,1,0),O=new T.Object3D(),COL=new T.Color();
class World{
 constructor(container,settings){
 this.settings=settings;this.container=container;this.scene=new T.Scene();this.scene.fog=new T.FogExp2(0x223845,.004);
 this.camera=new T.PerspectiveCamera(39,innerWidth/innerHeight,.05,250);
 this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
 this.renderer.outputEncoding=T.sRGBEncoding;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.95;
 this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
 container.appendChild(this.renderer.domElement);
 this.mode='home';this.shotOriginX=0;this.time=0;this.netPulse=0;this.netX=0;this.netY=1;this.aim={x:0,y:1.1};
 this.ray=new T.Raycaster();this.plane=new T.Plane(new T.Vector3(0,0,1),0);this.mouse=new T.Vector2();this.aimPoint=new T.Vector3();
 this.cameraGoal=new T.Vector3();this.lookGoal=new T.Vector3();this.look=new T.Vector3(-1,1.2,10);
 this.uniforms={time:{value:0},cheer:{value:0}};this.materialCache=new Map();this.texCache=new Map();this.actorReady=false;this.assetErrors=[];
 this.makeLight();this.makeSky();this.makePitch();this.makeStadium();this.makeGoal();this.batchStadium();this.makeBall();this.makeTargets();this.makeActors();
 this.setQuality(settings.quality||'balanced');this.resize();this.setView('home',true);
 }
 mat(c,rough=.8){return new T.MeshStandardMaterial({color:new T.Color(c).convertSRGBToLinear(),roughness:rough,metalness:0});}
 mesh(g,m,x,y,z,parent=this.scene){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 box(x,y,z,w,h,d,m,parent){return this.mesh(new T.BoxGeometry(w,h,d),m,x,y,z,parent);}
 beam(a,b,r,m,parent=this.scene){V.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const o=this.mesh(new T.CylinderGeometry(r,r,V.length(),10),m,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,parent);o.quaternion.setFromUnitVectors(UP,V.normalize());return o;}
 texture(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.encoding=T.sRGBEncoding;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());return t;}
 makeLight(){
 this.scene.add(new T.HemisphereLight(0xb6cfe5,0x273d2e,.7));
 const sun=new T.DirectionalLight(0xffd4a6,1.35);sun.position.set(-24,28,12);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
 Object.assign(sun.shadow.camera,{left:-19,right:19,top:21,bottom:-13,near:1,far:100});sun.shadow.bias=-.0005;sun.shadow.normalBias=.025;this.scene.add(sun);this.sun=sun;
 const fill=new T.DirectionalLight(0x9cccf0,.55);fill.position.set(18,14,-18);this.scene.add(fill);
 const rim=new T.DirectionalLight(0xffffff,1.05);rim.position.set(0,12,-5);this.scene.add(rim);
 }
 makeSky(){
 const tex=this.texture(8,512,(c,w,h)=>{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#182e43');g.addColorStop(.38,'#476977');g.addColorStop(.53,'#f1ca9b');g.addColorStop(.72,'#8aa49e');g.addColorStop(1,'#32413c');c.fillStyle=g;c.fillRect(0,0,w,h);});
 const sky=new T.Mesh(new T.SphereGeometry(180,32,24),new T.MeshBasicMaterial({map:tex,side:T.BackSide,fog:false}));this.scene.add(sky);
 }
 makePitch(){
 const random=P.rng(1817);
 const tex=this.texture(1024,1024,(c,w,h)=>{
 c.fillStyle='#477538';c.fillRect(0,0,w,h);
 for(let i=0;i<180000;i++){const x=random()*w,y=random()*h;c.fillStyle=i%3===0?'rgba(139,172,80,.23)':i%2===0?'rgba(24,62,30,.22)':'rgba(211,209,130,.15)';c.fillRect(x,y,.6+random()*1.2,1+random()*4);}
 });tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.repeat.set(18,28);
 const grass=this.mat(0xffffff,.99);grass.map=tex;grass.bumpMap=tex;grass.bumpScale=.025;
 this.pitch=this.mesh(new T.PlaneGeometry(120,160),grass,0,-.013,42);this.pitch.rotation.x=-Math.PI/2;this.pitch.castShadow=false;
 const stripeMat=this.mat(0x4c843b,1);stripeMat.transparent=true;stripeMat.opacity=.21;stripeMat.depthWrite=false;
 for(let z=-5;z<120;z+=12){const stripe=this.mesh(new T.PlaneGeometry(68,6),stripeMat,0,-.009,z);stripe.rotation.x=-Math.PI/2;stripe.castShadow=false;}
 const chalk=new T.MeshBasicMaterial({color:0xe2e8ce,transparent:true,opacity:.85});
 const line=(x,z,w,h)=>{const a=this.mesh(new T.PlaneGeometry(w,h),chalk,x,.006,z);a.rotation.x=-Math.PI/2;a.castShadow=false;};
 line(0,0,68,.10);line(-34,52.5,.1,105);line(34,52.5,.1,105);line(0,105,68,.10);line(0,52.5,68,.10);
 line(-20.16,8.25,.1,16.5);line(20.16,8.25,.1,16.5);line(0,16.5,40.32,.1);line(-9.16,2.75,.1,5.5);line(9.16,2.75,.1,5.5);line(0,5.5,18.32,.1);
 const spot=this.mesh(new T.CircleGeometry(.1,20),chalk,0,.012,11);spot.rotation.x=-Math.PI/2;spot.castShadow=false;
 const points=[];for(let i=0;i<=64;i++){const a=.645+i/64*(Math.PI-1.29);points.push(new T.Vector3(Math.cos(a)*9.15,.012,11+Math.sin(a)*9.15));}
 this.scene.add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0xe0e5cb,transparent:true,opacity:.8})));
 const ring=this.mesh(new T.RingGeometry(9.1,9.2,80),chalk,0,.006,52.5);ring.rotation.x=-Math.PI/2;ring.castShadow=false;
 // Worn goalmouth and scuffed penalty spot remain subtle, with fine grass at the camera.
 const wearTex=this.texture(128,128,(c,w,h)=>{const g=c.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(105,98,60,.4)');g.addColorStop(1,'rgba(105,98,60,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
 const wear=new T.MeshBasicMaterial({map:wearTex,transparent:true,depthWrite:false});
 const patch=this.mesh(new T.PlaneGeometry(8,3.5),wear,0,.01,1);patch.rotation.x=-Math.PI/2;patch.castShadow=false;
 const divot=this.mesh(new T.PlaneGeometry(1.2,1.6),wear,0,.009,11.35);divot.rotation.x=-Math.PI/2;divot.castShadow=false;
 const blades=new T.InstancedMesh(new T.PlaneGeometry(.012,.025),this.mat(0x719448,1),14000);
 for(let i=0;i<14000;i++){O.position.set((random()-.5)*32,.016,random()*28);O.rotation.set(-.12+random()*.24,random()*Math.PI,random()*.3);O.scale.set(1,.6+random(),1);O.updateMatrix();blades.setMatrixAt(i,O.matrix);COL.setHSL(.23+random()*.055,.34,.22+random()*.12).convertSRGBToLinear();blades.setColorAt(i,COL);}
 blades.material.side=T.DoubleSide;blades.receiveShadow=true;this.scene.add(blades);this.grassBlades=blades;
 }
 makeStadium(){
 const steel=this.mat(0x263a42,.45),concrete=this.mat(0x253744,.95),dark=this.mat(0x172a33,.8),trim=this.mat(0xc1c6bd,.55);
 const adTex=this.texture(2048,128,(c,w,h)=>{c.fillStyle='#10252d';c.fillRect(0,0,w,h);c.fillStyle='#d9f870';c.font='700 35px Arial';c.textAlign='center';for(let i=0;i<4;i++){c.fillText(i%2?'OWN THE MOMENT':'FOOTBALL / STRIKE',256+i*512,78);c.fillRect(495+i*512,28,3,72);}});
 adTex.wrapS=T.RepeatWrapping;adTex.repeat.set(4,1);
 const adMat=new T.MeshBasicMaterial({map:adTex});this.box(0,.62,-6.4,76,1.05,.25,dark);
 const board=this.mesh(new T.PlaneGeometry(76,1.05),adMat,0,.67,-6.25);board.castShadow=false;
 for(const side of [-1,1]){const b=this.mesh(new T.PlaneGeometry(112,1.05),adMat,side*37,.65,47);b.rotation.y=side>0?-Math.PI/2:Math.PI/2;b.castShadow=false;}
 const positions=[];const colours=[];const random=P.rng(8192);
 const stand=(cx,cz,rot,width,rows)=>{
 const group=new T.Group();group.position.set(cx,0,cz);group.rotation.y=rot;this.scene.add(group);
 for(let row=0;row<rows;row++){
 const tier=row>=11?2.1:0,y=1.8+row*.66+tier,z=-row*1.05;
 this.box(0,y-.3,z,width,.58,1.25,concrete,group);
 if(row===10||row===rows-1)this.box(0,y+.7,z-.45,width,.07,.07,trim,group);
 for(let j=0;j<Math.floor(width/.66);j++){
 const x=-width/2+j*.66;if(j%26<3)continue;
 const p=new T.Vector3(x,y+.25,z).applyAxisAngle(UP,rot);p.x+=cx;p.z+=cz;
 positions.push(p);const tone=random();
 colours.push(tone<.24?0xd3d799:tone<.4?0xb5c7bd:tone<.61?0x203b55:tone<.82?0x32608c:0x77614b);
 }
 }
 const top=1.8+(rows-1)*.66+(rows>11?2.1:0);
 this.box(0,top+3,-rows*.65,width+4,.5,rows*.85,dark,group);
 this.box(0,top+2.5,-2,width+3,.16,.3,trim,group);
 for(let x=-width/2;x<=width/2;x+=12){this.beam([x,0,-rows],[x,top+3,-rows],.17,steel,group);this.beam([x,top+2.5,-1],[x,top+3,-rows],.075,steel,group);}
 };
 stand(0,-10,0,91,23);stand(-40,40,Math.PI/2,108,19);stand(40,40,-Math.PI/2,108,19);
 this.crowdCount=positions.length;
 const bodyParts=[];
 for(const [x,y,sx,sy,sz] of [[0,0,.15,.23,.1],[-.17,-.03,.055,.2,.06],[.17,-.03,.055,.2,.06]]){
 const g=new T.SphereGeometry(1,5,3).toNonIndexed();g.scale(sx,sy,sz);g.translate(x,y,0);bodyParts.push(g);
 }
 const bodyGeometry=new T.BufferGeometry();
 for(const key of ['position','normal']){const total=bodyParts.reduce((n,g)=>n+g.attributes[key].array.length,0),a=new Float32Array(total);let offset=0;for(const g of bodyParts){a.set(g.attributes[key].array,offset);offset+=g.attributes[key].array.length;}bodyGeometry.setAttribute(key,new T.BufferAttribute(a,3));}
 for(const g of bodyParts)g.dispose();
 const body=new T.InstancedMesh(bodyGeometry,this.mat(0xffffff,.95),positions.length);
 const heads=new T.InstancedMesh(new T.SphereGeometry(.102,7,5),this.mat(0xffffff,.88),positions.length);
 for(let i=0;i<positions.length;i++){const p=positions[i];O.position.set(p.x,p.y+.3,p.z);O.rotation.set(0,0,0);O.scale.set(1,1,1);O.updateMatrix();body.setMatrixAt(i,O.matrix);body.setColorAt(i,COL.setHex(colours[i]).convertSRGBToLinear());O.position.y+=.36;O.scale.set(1,1,1);O.updateMatrix();heads.setMatrixAt(i,O.matrix);heads.setColorAt(i,COL.setHSL(.075,.3,.25+random()*.43).convertSRGBToLinear());}
 for(const m of [body,heads]){m.frustumCulled=false;m.material.onBeforeCompile=shader=>{shader.uniforms.crowdTime=this.uniforms.time;shader.uniforms.crowdCheer=this.uniforms.cheer;shader.vertexShader='uniform float crowdTime; uniform float crowdCheer;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.y += (sin(crowdTime * 2.8 + instanceMatrix[3].x * 2.7 + instanceMatrix[3].z) * (0.025 + crowdCheer * 0.12));');};this.scene.add(m);}
 this.crowdBody=body;this.crowdHeads=heads;
 // Roof lamps use emissive geometry rather than dozens of expensive shadow lights.
 const lampMat=new T.MeshBasicMaterial({color:0xfff3d6});const lampGroup=new T.Group();this.scene.add(lampGroup);
 for(let x=-35;x<=35;x+=10){this.box(x,19,-16,4,.12,.65,lampMat,lampGroup);}
 const halo=this.texture(64,64,(c,w,h)=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,239,207,.8)');g.addColorStop(.12,'rgba(255,231,189,.28)');g.addColorStop(1,'rgba(255,240,220,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
 const haloMat=new T.SpriteMaterial({map:halo,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
 for(let x=-35;x<=35;x+=10){const sp=new T.Sprite(haloMat);sp.position.set(x,18.9,-15.8);sp.scale.set(8,5,1);this.scene.add(sp);}
 // Stadium scoreboard.
 const screenTex=this.texture(1024,384,(c,w,h)=>{c.fillStyle='#092029';c.fillRect(0,0,w,h);c.fillStyle='#d9f870';c.textAlign='center';c.font='bold 80px Arial';c.fillText('FOOTBALL STRIKE',w/2,146);c.fillStyle='#dce8e4';c.font='32px Arial';c.fillText('I N T E R N A T I O N A L',w/2,218);c.fillStyle='#709a9b';c.font='24px Arial';c.fillText('THE MOMENT IS YOURS',w/2,300);});
 this.box(0,14.2,-34,13,5.1,.5,dark);this.mesh(new T.PlaneGeometry(12.6,4.7),new T.MeshBasicMaterial({map:screenTex}),0,14.2,-33.72);
 for(const side of [-1,1]){this.beam([side*34,0,0],[side*34,1.5,0],.022,trim);const flag=this.mesh(new T.PlaneGeometry(.42,.28),new T.MeshBasicMaterial({color:0xe4ff80,side:T.DoubleSide}),side*34+.19,1.35,0);flag.rotation.y=.2;}
 }
 batchStadium(){
 // Bake static architecture per material. Spectators remain instanced and independently animated.
 this.scene.updateMatrixWorld(true);const batches=new Map(),objects=[];
 this.scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&o.material.side!==T.BackSide){objects.push(o);const key=o.material.uuid+':'+o.castShadow+':'+o.receiveShadow;if(!batches.has(key))batches.set(key,{material:o.material,cast:o.castShadow,receive:o.receiveShadow,parts:[]});batches.get(key).parts.push(o);}});
 for(const b of batches.values()){
 if(b.parts.length<2)continue;
 let count=0;const transformed=[];
 for(const part of b.parts){let g=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();g.applyMatrix4(part.matrixWorld);count+=g.attributes.position.count;transformed.push(g);}
 const geometry=new T.BufferGeometry();
 for(const [name,size] of [['position',3],['normal',3],['uv',2]]){const data=new Float32Array(count*size);let offset=0;for(const g of transformed){const attribute=g.attributes[name];if(attribute)data.set(attribute.array,offset);offset+=g.attributes.position.count*size;}geometry.setAttribute(name,new T.BufferAttribute(data,size));}
 geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,b.material);mesh.castShadow=b.cast;mesh.receiveShadow=b.receive;this.scene.add(mesh);
 for(const part of b.parts)part.parent.remove(part);for(const g of transformed)g.dispose();
 }
 }
 makeGoal(){
 const m=this.mat(0xf3f4ea,.3);
 this.beam([-3.66,0,0],[-3.66,2.44,0],.06,m);this.beam([3.66,0,0],[3.66,2.44,0],.06,m);this.beam([-3.66,2.44,0],[3.66,2.44,0],.06,m);
 for(const x of [-3.66,3.66]){this.beam([x,2.44,0],[x,2.44,-.5],.023,m);this.beam([x,2.44,-.5],[x,0,-1.8],.022,m);this.beam([x,0,0],[x,0,-1.8],.023,m);}
 this.beam([-3.66,.03,-1.8],[3.66,.03,-1.8],.024,m);
 const points=[];
 const add=(x1,y1,z1,x2,y2,z2)=>points.push(x1,y1,z1,x2,y2,z2);
 for(let x=-3.66;x<=3.661;x+=.122){add(x,0,-1.8,x,2.44,-.5);add(x,2.44,-.5,x,2.44,0);}
 for(let y=0;y<=2.441;y+=.122){const z=-1.8+y/2.44*1.3;add(-3.66,y,z,3.66,y,z);for(const x of [-3.66,3.66])add(x,y,0,x,y,z);}
 for(const x of [-3.66,3.66])for(let k=0;k<=12;k++){const u=k/12;add(x,0,-1.8*u,x,2.44,-.5*u);}
 for(let z=-.5;z<=0;z+=.125)add(-3.66,2.44,z,3.66,2.44,z);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));
 this.netBase=new Float32Array(points);this.net=new T.LineSegments(g,new T.LineBasicMaterial({color:0xe3e9dd,transparent:true,opacity:.54}));this.scene.add(this.net);
 }
 makeBall(){
 this.ball=new T.Group();this.ball.position.set(0,.11,11);this.scene.add(this.ball);
 const fallback=this.mesh(new T.IcosahedronGeometry(.11,2),this.mat(0xe4e6dc,.5),0,0,0,this.ball);this.ballFallback=fallback;
 const loader=new T.GLTFLoader();
 this.ballPromise=new Promise(resolve=>loader.load('assets/international/match-ball.glb',g=>{this.ball.remove(fallback);this.ball.add(g.scene);g.scene.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;}});this.ballAssetLoaded=true;resolve(true);},undefined,e=>{this.assetErrors.push('match-ball.glb');resolve(false);}));
 const tex=this.texture(64,64,(c,w,h)=>{const g=c.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
 this.contactShadow=this.mesh(new T.PlaneGeometry(.52,.52),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}),0,.018,11);this.contactShadow.rotation.x=-Math.PI/2;this.contactShadow.castShadow=false;
 }
 makeTargets(){
 this.targets=[];this.targetColours=[0xff287f,0x00c7f2,0xff7428,0x9747ff];
 const positions=[[-2.65,1.8],[2.65,1.8],[-2.7,.65],[2.7,.65]];
 const star=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5+Math.PI/2,r=i%2?.085:.17,x=Math.cos(a)*r,y=Math.sin(a)*r;if(i)star.lineTo(x,y);else star.moveTo(x,y);}star.closePath();
 const starGeometry=new T.ShapeGeometry(star);
 positions.forEach((p,i)=>{
 const group=new T.Group(),colour=this.targetColours[i];group.position.set(p[0],p[1],.1);
 const outer=new T.Mesh(new T.TorusGeometry(.38,.038,8,48),new T.MeshBasicMaterial({color:new T.Color(colour).convertSRGBToLinear(),toneMapped:false}));group.add(outer);
 const inner=new T.Mesh(new T.TorusGeometry(.265,.013,6,40),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.8}));inner.position.z=.012;group.add(inner);
 const core=new T.Mesh(new T.CircleGeometry(.34,32),new T.MeshBasicMaterial({color:new T.Color(colour).convertSRGBToLinear(),toneMapped:false,transparent:true,opacity:.32,depthWrite:false}));core.position.z=-.012;group.add(core);
 const badge=new T.Mesh(starGeometry,new T.MeshBasicMaterial({color:0xffffff}));badge.position.z=.025;group.add(badge);
 group.visible=false;this.scene.add(group);this.targets.push(group);
 });
 this.activeTarget=-1;
 // Reuse one particle pool for every target burst.
 this.burstAge=-1;this.burstCount=48;this.burstVelocity=new Float32Array(this.burstCount*3);
 this.targetBurst=new T.Group();this.targetBurst.visible=false;this.scene.add(this.targetBurst);
 this.burstMaterial=new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true,depthWrite:false});
 this.burstParticles=new T.InstancedMesh(new T.IcosahedronGeometry(.085,0),this.burstMaterial,this.burstCount);this.burstParticles.frustumCulled=false;this.targetBurst.add(this.burstParticles);
 for(let i=0;i<this.burstCount;i++){const a=i*2.39996323,speed=1.3+(i%7)*.26;this.burstVelocity[i*3]=Math.cos(a)*speed;this.burstVelocity[i*3+1]=Math.sin(a)*speed+1.1;this.burstVelocity[i*3+2]=.6+(i%5)*.19;}
 this.burstRing=new T.Mesh(new T.RingGeometry(.32,.39,48),new T.MeshBasicMaterial({color:0xffffff,toneMapped:false,transparent:true,depthWrite:false,side:T.DoubleSide}));this.targetBurst.add(this.burstRing);
 const lineG=new T.BufferGeometry();lineG.setAttribute('position',new T.BufferAttribute(new Float32Array(33*3),3));
 this.trajectory=new T.Line(lineG,new T.LineDashedMaterial({color:0xdcf8a3,dashSize:.15,gapSize:.13,transparent:true,opacity:.65}));this.trajectory.visible=false;this.scene.add(this.trajectory);
 }
 hitTarget(index){
 const target=this.targets[index];if(!target)return;
 target.visible=false;this.targetBurst.position.copy(target.position);this.targetBurst.visible=true;this.burstAge=0;
 this.burstRing.material.color.setHex(this.targetColours[index]).convertSRGBToLinear();this.burstRing.material.opacity=1;this.burstRing.scale.setScalar(1);
 this.burstMaterial.opacity=1;
 for(let i=0;i<this.burstCount;i++){O.position.set(0,0,0);O.rotation.set(0,0,0);O.scale.setScalar(1);O.updateMatrix();this.burstParticles.setMatrixAt(i,O.matrix);this.burstParticles.setColorAt(i,COL.setHex(i%6===0?0xffffff:this.targetColours[(index+i%3)%4]).convertSRGBToLinear());}
 this.burstParticles.instanceColor.needsUpdate=true;this.burstParticles.instanceMatrix.needsUpdate=true;
 }
 updateTargetBurst(dt){
 if(this.burstAge<0)return;
 this.burstAge+=dt;const t=this.burstAge,u=Math.min(1,t/.85);
 if(u>=1){this.targetBurst.visible=false;this.burstAge=-1;return;}
 this.burstMaterial.opacity=1-u*u;this.burstRing.material.opacity=(1-u)*(1-u);this.burstRing.scale.setScalar(1+u*5);
 for(let i=0;i<this.burstCount;i++){const j=i*3;O.position.set(this.burstVelocity[j]*t,this.burstVelocity[j+1]*t-2.8*t*t,this.burstVelocity[j+2]*t);O.rotation.set(t*(i%4+2),t*(i%5+1),i+t*3);O.scale.setScalar((1-u*.5)*(.8+i%3*.3));O.updateMatrix();this.burstParticles.setMatrixAt(i,O.matrix);}
 this.burstParticles.instanceMatrix.needsUpdate=true;
 }
 makeActors(){
 this.striker=new T.Group();this.keeper=new T.Group();this.scene.add(this.striker,this.keeper);this.striker.position.set(-.65,0,12.4);
 const loader=new T.GLTFLoader();
 this.actorPromise=new Promise(resolve=>loader.load('assets/international/footballer.glb',g=>{
 this.striker.add(g.scene);this.strikerRig=this.prepareActor(this.striker);
 this.actorReady=true;this.setTeam(this.team||FSTeams.list[0]);this.setView(this.mode,true);resolve(true);
 },undefined,()=>{this.assetErrors.push('footballer.glb');resolve(false);}));
 this.keeperPromise=new Promise(resolve=>loader.load('assets/international/keeper.glb',g=>{
 this.keeper.add(g.scene);this.keeperRig=this.prepareKeeper(this.keeper);this.keeperReady=true;
 this.idleKeeper=K.createPose();K.readyAt(0,this.idleKeeper);this.poseKeeper(this.idleKeeper);resolve(true);
 },undefined,()=>{this.assetErrors.push('keeper.glb');resolve(false);}));
 this.ready=Promise.all([this.actorPromise,this.ballPromise,this.keeperPromise]);
 }
 prepareActor(group){
 const rig={nodes:{},materials:{},base:{}};
 group.traverse(o=>{
 rig.nodes[o.name]=o;rig.base[o.name]={x:o.rotation.x,y:o.rotation.y,z:o.rotation.z,px:o.position.x,py:o.position.y,pz:o.position.z};
 if(o.isMesh){o.castShadow=true;o.receiveShadow=true;
 const name=o.material.name;if(!rig.materials[name])rig.materials[name]=o.material.clone();o.material=rig.materials[name];
 }
 });return rig;
 }
 prepareKeeper(group){
 const nodes={},bones=[];let meshes=0;group.updateMatrixWorld(true);
 group.traverse(o=>{if(o.isBone)nodes[o.name]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;if(o.isSkinnedMesh)meshes++;}});
 for(const [name,start,end] of K.BONES){
 const bone=nodes[name];if(!bone)throw Error('Missing goalkeeper bone: '+name);
 const rest=new T.Vector3().fromArray(K.REST[end]).sub(new T.Vector3().fromArray(K.REST[start])).normalize();
 bones.push({bone,start,end,rest,rotation:bone.getWorldQuaternion(new T.Quaternion())});
 }return {nodes,bones,meshes};
 }
 poseKeeper(pose){
 if(!this.keeperReady)return;const a=pose.joints;
 // Desired world joints are shared with collision. Convert them through each bone's parent.
 for(const b of this.keeperRig.bones){
 V.fromArray(a,b.start*3);b.bone.parent.worldToLocal(V);b.bone.position.copy(V);
 V.fromArray(a,b.end*3);V2.fromArray(a,b.start*3);V.sub(V2).normalize();
 Q.setFromUnitVectors(b.rest,V).multiply(b.rotation);
 b.bone.parent.getWorldQuaternion(Q2);Q3.copy(Q2).invert().multiply(Q);b.bone.quaternion.copy(Q3);
 b.bone.updateMatrixWorld(true);
 }
 }
 kitTexture(team){
 if(this.texCache.has(team.id))return this.texCache.get(team.id);
 const tex=this.texture(1024,512,(c,w,h)=>{
 c.fillStyle=team.shirt;c.fillRect(0,0,w,h);
 c.strokeStyle='rgba(255,255,255,.065)';c.lineWidth=1;for(let x=0;x<w;x+=5){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
 if(team.pattern==='argentina'){for(let x=0;x<w;x+=240){const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#86c6e3');g.addColorStop(1,'#4596c4');c.fillStyle=g;c.fillRect(x+35,0,110,h);}}
 if(team.pattern==='spain'){c.fillStyle=team.trim;for(let x=10;x<w;x+=45)c.fillRect(x,0,2,h);}
 if(team.pattern==='germany'){['#22282d','#cc2739','#e5b548'].forEach((col,i)=>{c.strokeStyle=col;c.lineWidth=16;c.beginPath();c.moveTo(230,105+i*20);c.lineTo(512,270+i*20);c.lineTo(795,105+i*20);c.stroke();});}
 if(['portugal','mexico','sweden','norway','italy','brazil'].includes(team.pattern)){
 c.strokeStyle=team.pattern==='norway'?'rgba(10,22,46,.22)':'rgba(255,255,255,.09)';c.lineWidth=team.pattern==='norway'?32:3;
 for(let y=40;y<h;y+=team.pattern==='norway'?125:24){c.beginPath();for(let x=0;x<=w;x+=8)c.lineTo(x,y+Math.sin(x*.032)*14);c.stroke();}
 }
 if(team.pattern==='france'){c.fillStyle='#14294a';c.fillRect(230,0,65,h);c.fillRect(730,0,65,h);}
 // Woven side seams and collar. Numbers are also visible on the back seam.
 c.fillStyle=team.trim;c.fillRect(218,0,12,h);c.fillRect(794,0,12,h);c.fillRect(0,0,w,19);
 if(team.brand==='adidas'){for(const cx of [255,704])for(let k=0;k<3;k++)c.fillRect(cx+k*17,0,8,102);}
 c.fillStyle=team.trim;c.textAlign='center';c.font='bold 70px Arial';c.fillText('10',512,320);
 // Small flag badge, with a manufacturer mark at the correct chest positions.
 c.fillStyle=team.trim;c.beginPath();c.moveTo(571,116);c.lineTo(619,116);c.lineTo(618,157);c.lineTo(595,173);c.lineTo(572,157);c.closePath();c.fill();
 c.fillStyle=team.shirt;c.font='bold 15px Arial';c.fillText(team.code,595,142);
 c.fillStyle=team.trim;
 if(team.brand==='adidas'){for(let i=0;i<3;i++){c.save();c.translate(430+i*12,150);c.rotate(-.45);c.fillRect(0,-12-i*9,8,12+i*9);c.restore();}}
 else if(team.brand==='nike'){c.beginPath();c.moveTo(419,134);c.bezierCurveTo(407,154,429,162,471,132);c.bezierCurveTo(442,144,423,154,419,134);c.fill();}
 else{c.font='bold italic 12px Arial';c.fillText('PUMA',445,146);}
 c.font='bold 105px Arial';c.fillText('10',0,316);c.fillText('10',w,316);
 c.font='bold 16px Arial';c.fillText(team.name.toUpperCase(),512,42);
 });tex.flipY=false;this.texCache.set(team.id,tex);return tex;
 }
 setTeam(team){
 this.team=team;if(!this.actorReady)return;
 const rig=this.strikerRig;
 for(const [name,col] of Object.entries({Shirt:'#ffffff',Sleeves:team.shirt,Shorts:team.shorts,Socks:team.socks,Trim:team.trim,Skin:team.skin,Hair:team.hair})){if(rig.materials[name])rig.materials[name].color.set(col).convertSRGBToLinear();}
 if(rig.materials.Shirt){rig.materials.Shirt.map=this.kitTexture(team);rig.materials.Shirt.needsUpdate=true;}
 }
 setQuality(quality){
 this.quality=quality;const low=quality==='low',high=quality==='high';
 this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:high?2:1.5));this.renderer.shadowMap.enabled=!low;
 this.grassBlades.visible=false;this.grassBlades.count=high?14000:7000;
 this.renderer.setSize(innerWidth,innerHeight);this.renderer.shadowMap.needsUpdate=true;
 }
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.setView(this.mode,true);}
 setView(mode,instant=false){
 this.mode=mode;const mobile=innerWidth<700;
 // Country preview and cinematic replays show the footballer. Active shooting is at eye level.
 this.striker.visible=mode==='home'||mode==='nations'||mode==='replay';
 if(mode==='home'||mode==='nations'){
 this.cameraGoal.set(mobile?3.8:4.1,mobile?2.15:2.2,mobile?18.2:16.4);this.lookGoal.set(mobile?-.6:-.9,mobile?.42:.15,mobile?10.9:10.6);
 this.camera.fov=mobile?43:36;this.striker.position.set(mobile?.75:.85,0,12);this.striker.rotation.y=.35;this.ball.position.set(mobile?.25:.25,.11,12.7);this.keeper.visible=false;
 }else if(mode==='replay'){
 this.cameraGoal.set(8,3.4,5.8);this.lookGoal.set(0,1.1,3);this.camera.fov=45;
 }else{
 const landscape=innerHeight<540&&innerWidth>innerHeight,aspect=innerWidth/innerHeight;
 const distance=landscape?15.5:14.2;
 this.cameraGoal.set(this.shotOriginX*distance/11,1.72,distance);this.lookGoal.set(0,landscape?-.65:-.9,0);
 this.camera.fov=landscape?52:Math.max(54,2*Math.atan(.33/aspect)*180/Math.PI);
 this.striker.rotation.y=Math.PI;this.keeper.rotation.y=0;
 }
 this.camera.updateProjectionMatrix();if(instant){this.camera.position.copy(this.cameraGoal);this.look.copy(this.lookGoal);this.camera.lookAt(this.look);this.camera.updateMatrixWorld(true);}
 }
 buildDrawnShot(stroke,aim){
 const samples=FSGestures.sample(stroke,65,.45),points=new Float64Array(65*3),first={x:0,y:0},last={x:0,y:0};
 this.camera.updateMatrixWorld(true);this.screenPoint(this.shotOriginX,P.R,11,first);this.screenPoint(aim.x,aim.y,0,last);
 V.set(this.shotOriginX,P.R,11).applyMatrix4(this.camera.matrixWorldInverse);const d0=-V.z;
 V.set(aim.x,aim.y,0).applyMatrix4(this.camera.matrixWorldInverse);const d1=-V.z;
 for(let i=0;i<65;i++){
 const q=i/64,s=q*d0/((1-q)*d1+q*d0),z=11*(1-s);
 const x=samples[i*2]+(first.x-stroke.startX)*(1-q)+(last.x-stroke.x)*q;
 const y=samples[i*2+1]+(first.y-stroke.startY)*(1-q)+(last.y-stroke.y)*q;
 this.mouse.set(x/innerWidth*2-1,-y/innerHeight*2+1);this.ray.setFromCamera(this.mouse,this.camera);this.plane.constant=-z;this.ray.ray.intersectPlane(this.plane,this.aimPoint);
 points[i*3]=P.clamp(this.aimPoint.x,-8,8);points[i*3+1]=P.clamp(this.aimPoint.y,P.R,7);points[i*3+2]=z;
 }
 this.plane.constant=0;points[0]=this.shotOriginX;points[1]=P.R;points[2]=11;points[192]=aim.x;points[193]=aim.y;points[194]=0;
 const shot=P.createPathShot(points);shot.curve=FSGestures.curve(stroke);return shot;
 }
 screenPoint(x,y,z,out){V.set(x,y,z).project(this.camera);out.x=(V.x*.5+.5)*innerWidth;out.y=(-V.y*.5+.5)*innerHeight;return out;}
 screenToAim(x,y,out){this.mouse.set(x/innerWidth*2-1,-y/innerHeight*2+1);this.ray.setFromCamera(this.mouse,this.camera);this.ray.ray.intersectPlane(this.plane,this.aimPoint);out.x=P.clamp(this.aimPoint.x,-5.5,5.5);out.y=P.clamp(this.aimPoint.y,.11,4.5);return out;}
 showAim(shot,show){this.trajectory.visible=show;if(!show)return;const a=this.trajectory.geometry.attributes.position.array;for(let i=0;i<=32;i++){const t=shot.T*i/32;a[i*3]=shot.vx*t+.5*shot.ax*t*t;a[i*3+1]=.11+shot.vy*t-.5*P.G*t*t;a[i*3+2]=11+shot.vz*t;}this.trajectory.geometry.attributes.position.needsUpdate=true;this.trajectory.computeLineDistances();}
 showTargets(index){if(index<0){this.targetBurst.visible=false;this.burstAge=-1;}this.activeTarget=index;for(let i=0;i<this.targets.length;i++)this.targets[i].visible=i===index;}
 hitNet(x,y){this.netPulse=1;this.netX=x;this.netY=y;this.uniforms.cheer.value=1;}
 poseActor(rig,time,kind,phase,progress,pose){
 if(!rig)return;
 const n=rig.nodes,b=rig.base;
 for(const name of POSE_NODES){
 const v=n[name];if(v){v.rotation.set(b[name].x,b[name].y,b[name].z);v.position.set(b[name].px,b[name].py,b[name].pz);}
 }
 const hips=n.Hips,torso=n.Torso;
 const breathe=Math.sin(time*2)*.008;if(hips)hips.position.y+=breathe;if(torso)torso.rotation.x=.02;
 n.LeftArm.rotation.z=.09;n.RightArm.rotation.z=-.09;n.LeftForearm.rotation.x=-.26;n.RightForearm.rotation.x=-.2;n.LeftArm.rotation.x=.04;n.RightArm.rotation.x=-.06;
 if(phase==='runup'){
 const stride=Math.sin(progress*Math.PI*5),kick=P.clamp((progress-.64)/.36,0,1);
 hips.position.y+=Math.sin(progress*Math.PI*10)*.028;
 n.LeftLeg.rotation.x=progress<.67?stride*.5:.06;n.RightLeg.rotation.x=progress<.67?-stride*.5:Math.sin(kick*Math.PI)*1.15-kick*.3;
 n.LeftShin.rotation.x=Math.max(0,-stride)*.7;n.RightShin.rotation.x=progress<.67?Math.max(0,stride)*.8:Math.sin(kick*Math.PI)*1.45;
 n.LeftArm.rotation.x=-stride*.45;n.RightArm.rotation.x=stride*.45;n.LeftArm.rotation.z=.3;n.RightArm.rotation.z=-.2;torso.rotation.x=.1+kick*.08;torso.rotation.y=kick*.3;
 }else if(phase==='flight'||phase==='result'){
 const follow=Math.exp(-progress*4);n.RightLeg.rotation.x=-(.3+.65*Math.min(1,progress/.15))*follow;n.RightShin.rotation.x=.15;n.LeftArm.rotation.z=.3+follow*.5;n.RightArm.rotation.z=-.15-follow*.4;torso.rotation.y=.3*follow;torso.rotation.x=.13*follow;
 }else if(phase==='celebrate'){n.LeftArm.rotation.z=2.6;n.RightArm.rotation.z=-2.6;n.LeftForearm.rotation.x=-.3;n.RightForearm.rotation.x=-.3;hips.position.y+=Math.abs(Math.sin(progress*5))*.05;}
 }
 update(dt,state){
 this.time+=dt;this.uniforms.time.value=this.time;this.uniforms.cheer.value=Math.max(0,this.uniforms.cheer.value-dt*.35);
 const menu=this.mode==='home'||this.mode==='nations';
 if(!this.settings.reducedMotion&&menu){this.cameraGoal.x+=(Math.sin(this.time*.12)*.12+4.0-this.cameraGoal.x)*.005;}
 const lerp=1-Math.exp(-dt*5);this.camera.position.lerp(this.cameraGoal,lerp);this.look.lerp(this.lookGoal,lerp);this.camera.lookAt(this.look);
 if(menu){this.poseActor(this.strikerRig,this.time,'striker','idle',0);this.ball.rotation.y+=dt*.03;}
 else if(state){
 const b=state.ball;this.ball.position.set(b.x,b.y,b.z);
 if(state.phase==='flight'||state.phase==='result'||state.phase==='replay'){this.ball.rotation.x-=dt*(state.speed||22);this.ball.rotation.y+=dt*(state.curve||0)*18;}
 this.keeper.visible=state.keeperEnabled;
 if(state.phase==='aim'&&this.keeperReady){K.readyAt(this.time,this.idleKeeper);this.poseKeeper(this.idleKeeper);}else this.poseKeeper(state.keeperPose);
 if(state.phase==='runup'){
 const p=P.clamp(state.elapsed/.62,0,1);this.striker.position.set(-.6+.705*p,Math.abs(Math.sin(p*Math.PI*5))*.008,12.6-1.2*p);
 this.poseActor(this.strikerRig,this.time,'striker','runup',p);
 }else{
 this.striker.position.set(.105,0,11.4);if(state.phase==='aim')this.striker.position.set(-.6,0,12.6);
 this.poseActor(this.strikerRig,this.time,'striker',state.outcome==='goal'&&state.elapsed>1?'celebrate':state.phase,state.elapsed);
 }
 const angle=Math.atan2(this.shotOriginX,11),c=Math.cos(angle),s=Math.sin(angle),x=this.striker.position.x,z=this.striker.position.z-11;
 this.striker.position.set(this.shotOriginX+x*c+z*s,this.striker.position.y,11-x*s+z*c);this.striker.rotation.y=Math.PI+angle;
 }
 this.contactShadow.position.set(this.ball.position.x,.019,this.ball.position.z);const height=this.ball.position.y;
 this.contactShadow.scale.setScalar(1+height*.2);this.contactShadow.material.opacity=Math.max(.12,1-height*.25);
 if(this.netPulse>0){this.netPulse=Math.max(0,this.netPulse-dt*.7);const a=this.net.geometry.attributes.position.array,base=this.netBase;for(let i=0;i<a.length;i+=3){const d=Math.hypot(base[i]-this.netX,base[i+1]-this.netY);const anchored=base[i+1]<.02||Math.abs(base[i])>3.63||base[i+2]>-.01;a[i+2]=base[i+2]-(anchored?0:Math.exp(-d*1.6)*Math.sin((1-this.netPulse)*15-d*2)*this.netPulse*.35);}this.net.geometry.attributes.position.needsUpdate=true;}
 if(this.activeTarget>=0){const target=this.targets[this.activeTarget];if(target){target.rotation.z+=dt*.32;target.scale.setScalar(1+Math.sin(this.time*4)*.035);}}
 this.updateTargetBurst(dt);
 this.renderer.render(this.scene,this.camera);
 }
}
root.FSWorld=World;
})(window);
