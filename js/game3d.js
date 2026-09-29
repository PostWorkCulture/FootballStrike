// Global UI State
let gameActive = false;
let score = 0;

window.startGame = function(avatarUrl) {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    document.getElementById('player-avatar').src = avatarUrl;
    gameActive = true;
    score = 0;
    document.getElementById('score').innerText = score;
    spawnTargets();
    resetBall();
};

window.showMenu = function() {
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('game-ui').style.display = 'none';
    gameActive = false;
};

// Init Three.js
const scene = new THREE.Scene();
const textureLoader = new THREE.TextureLoader();
scene.background = new THREE.Color(0x060b13); 
scene.fog = new THREE.FogExp2(0x060b13, 0.012);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 6);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

// Lighting (Dramatic Night Game)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
scene.add(dirLight);

// Init Cannon.js (Physics)
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const physicsMaterial = new CANNON.Material("standard");
const physicsContactMaterial = new CANNON.ContactMaterial(physicsMaterial, physicsMaterial, { friction: 0.3, restitution: 0.7 });
world.addContactMaterial(physicsContactMaterial);

// --- Realistic High-Granularity Premier League Pitch & Markings ---
function createGranularTurfTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    const baseGrad = ctx.createLinearGradient(0, 0, 0, 2048);
    baseGrad.addColorStop(0, '#103314');
    baseGrad.addColorStop(0.5, '#143d19');
    baseGrad.addColorStop(1, '#0e2b12');
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, 2048, 2048);

    const imgData = ctx.getImageData(0, 0, 2048, 2048);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 44;
        const soilTint = Math.random() < 0.04 ? -22 : 0;
        data[i] = Math.min(255, Math.max(0, data[i] + noise * 0.6 + soilTint));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise * 1.1));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise * 0.45 + soilTint));
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.lineWidth = 1.3;
    for (let b = 0; b < 18000; b++) {
        const bx = Math.random() * 2048;
        const by = Math.random() * 2048;
        const len = 3 + Math.random() * 7;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
        const tone = Math.random();
        ctx.strokeStyle = tone > 0.65 ? 'rgba(56, 158, 68, 0.22)' : tone > 0.3 ? 'rgba(18, 64, 25, 0.28)' : 'rgba(88, 185, 102, 0.16)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
        ctx.stroke();
    }

    const stripeHeight = 2048 / 8;
    for (let s = 0; s < 8; s++) {
        ctx.fillStyle = (s % 2 === 0) ? 'rgba(255, 255, 255, 0.065)' : 'rgba(0, 0, 0, 0.085)';
        ctx.fillRect(0, s * stripeHeight, 2048, stripeHeight);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 10);
    tex.anisotropy = 16;
    return tex;
}

function createGrassBumpTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 512);

    const imgData = ctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const val = 128 + (Math.random() - 0.5) * 95;
        data[i] = val; data[i + 1] = val; data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(35, 70);
    return tex;
}

function createChalkMarkingsTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 2048, 2048);

    const goalLineY = 512;
    const centerX = 1024;
    const pxPerMeter = 51.2;

    function drawChalkLine(x1, y1, x2, y2, width) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
        ctx.lineWidth = width * 1.8;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

        const len = Math.hypot(x2 - x1, y2 - y1);
        const steps = Math.floor(len / 3.5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            const cx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * width * 1.6;
            const cy = y1 + (y2 - y1) * t + (Math.random() - 0.5) * width * 1.6;
            ctx.beginPath();
            ctx.arc(cx, cy, 0.9 + Math.random() * 1.3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    const regLineWidth = 12 * 0.0512 * 10;

    // 1. Goal Line
    drawChalkLine(0, goalLineY, 2048, goalLineY, regLineWidth);

    // 2. 6-Yard Box: 5.5m deep x 18.32m wide
    const halfGoalBoxW = (18.32 / 2) * pxPerMeter;
    const goalBoxDepth = 5.5 * pxPerMeter;
    drawChalkLine(centerX - halfGoalBoxW, goalLineY, centerX - halfGoalBoxW, goalLineY + goalBoxDepth, regLineWidth);
    drawChalkLine(centerX + halfGoalBoxW, goalLineY, centerX + halfGoalBoxW, goalLineY + goalBoxDepth, regLineWidth);
    drawChalkLine(centerX - halfGoalBoxW, goalLineY + goalBoxDepth, centerX + halfGoalBoxW, goalLineY + goalBoxDepth, regLineWidth);

    // 3. 18-Yard Box: 16.5m deep x 40.32m wide
    const halfPenBoxW = (40.32 / 2) * pxPerMeter;
    const penBoxDepth = 16.5 * pxPerMeter;
    drawChalkLine(centerX - halfPenBoxW, goalLineY, centerX - halfPenBoxW, goalLineY + penBoxDepth, regLineWidth);
    drawChalkLine(centerX + halfPenBoxW, goalLineY, centerX + halfPenBoxW, goalLineY + penBoxDepth, regLineWidth);
    drawChalkLine(centerX - halfPenBoxW, goalLineY + penBoxDepth, centerX + halfPenBoxW, goalLineY + penBoxDepth, regLineWidth);

    // 4. Penalty Spot (11m from goal line)
    const penSpotY = goalLineY + 11 * pxPerMeter;
    const spotRadius = (0.22 / 2) * pxPerMeter * 1.25;

    const wearGrad = ctx.createRadialGradient(centerX, penSpotY, spotRadius * 0.8, centerX, penSpotY, spotRadius * 8.5);
    wearGrad.addColorStop(0, 'rgba(34, 22, 11, 0.55)');
    wearGrad.addColorStop(0.35, 'rgba(78, 89, 39, 0.42)');
    wearGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = wearGrad;
    ctx.beginPath();
    ctx.arc(centerX, penSpotY, spotRadius * 8.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.beginPath();
    ctx.arc(centerX, penSpotY, spotRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    for (let p = 0; p < 90; p++) {
        const ra = Math.random() * spotRadius * 4.0;
        const th = Math.random() * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(centerX + Math.cos(th) * ra, penSpotY + Math.sin(th) * ra, 1.3, 0, Math.PI * 2);
        ctx.fill();
    }

    // 5. Penalty D-Arc (9.15m radius outside 18-yard box)
    const dRadius = 9.15 * pxPerMeter;
    const startAngle = Math.asin((penBoxDepth - 11 * pxPerMeter) / dRadius);
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.lineWidth = regLineWidth;
    ctx.beginPath();
    ctx.arc(centerX, penSpotY, dRadius, startAngle, Math.PI - startAngle, false);
    ctx.stroke();
    ctx.restore();

    // 6. Goalkeeper Shuffle Wear Trough (center of goal line)
    const gkWearGrad = ctx.createRadialGradient(centerX, goalLineY, 25, centerX, goalLineY, 300);
    gkWearGrad.addColorStop(0, 'rgba(42, 28, 14, 0.48)');
    gkWearGrad.addColorStop(0.5, 'rgba(85, 98, 48, 0.32)');
    gkWearGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gkWearGrad;
    ctx.beginPath();
    ctx.ellipse(centerX, goalLineY, 300, 55, 0, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    return tex;
}

const turfTexture = createGranularTurfTexture();
const grassBump = createGrassBumpTexture();

const groundMat = new THREE.MeshStandardMaterial({
    map: turfTexture,
    bumpMap: grassBump,
    bumpScale: 0.05,
    roughness: 0.52,
    metalness: 0.08
});

const groundGeo = new THREE.PlaneGeometry(80, 160);
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: physicsMaterial });
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

const chalkTexture = createChalkMarkingsTexture();
const chalkMat = new THREE.MeshBasicMaterial({
    map: chalkTexture,
    transparent: true,
    opacity: 0.98,
    depthWrite: false
});

const linesMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), chalkMat);
linesMesh.rotation.x = -Math.PI / 2;
linesMesh.position.set(0, 0.015, -10);
scene.add(linesMesh);

// Goal Frame (AAA Quality FORZA Goal)
const goalGroup = new THREE.Group();
const postMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.1 });
const postRadius = 0.06, postHeight = 3.0, goalWidth = 7.2, goalDepth = 2.0, topDepth = 0.8;

// Left Post, Right Post, Crossbar
const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 32);
const leftPost = new THREE.Mesh(postGeo, postMaterial); leftPost.position.set(-goalWidth/2, postHeight/2, 0); leftPost.castShadow = true; goalGroup.add(leftPost);
const rightPost = new THREE.Mesh(postGeo, postMaterial); rightPost.position.set(goalWidth/2, postHeight/2, 0); rightPost.castShadow = true; goalGroup.add(rightPost);
const crossbarGeo = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius*2, 32);
const crossbar = new THREE.Mesh(crossbarGeo, postMaterial); crossbar.rotation.z = Math.PI/2; crossbar.position.set(0, postHeight, 0); crossbar.castShadow = true; goalGroup.add(crossbar);

// Tension Brackets & Back Bars
const bracketGeo = new THREE.CylinderGeometry(0.025, 0.025, topDepth, 16);
const leftBracket = new THREE.Mesh(bracketGeo, postMaterial); leftBracket.rotation.x = Math.PI/2; leftBracket.position.set(-goalWidth/2, postHeight, -topDepth/2); goalGroup.add(leftBracket);
const rightBracket = new THREE.Mesh(bracketGeo, postMaterial); rightBracket.rotation.x = Math.PI/2; rightBracket.position.set(goalWidth/2, postHeight, -topDepth/2); goalGroup.add(rightBracket);
const topBackBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, goalWidth, 16), postMaterial); topBackBar.rotation.z = Math.PI/2; topBackBar.position.set(0, postHeight, -topDepth); goalGroup.add(topBackBar);
const groundSideBarGeo = new THREE.CylinderGeometry(0.025, 0.025, goalDepth, 16);
const leftGroundBar = new THREE.Mesh(groundSideBarGeo, postMaterial); leftGroundBar.rotation.x = Math.PI/2; leftGroundBar.position.set(-goalWidth/2, 0.025, -goalDepth/2); goalGroup.add(leftGroundBar);
const rightGroundBar = new THREE.Mesh(groundSideBarGeo, postMaterial); rightGroundBar.rotation.x = Math.PI/2; rightGroundBar.position.set(goalWidth/2, 0.025, -goalDepth/2); goalGroup.add(rightGroundBar);
const backGroundBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, goalWidth, 16), postMaterial); backGroundBar.rotation.z = Math.PI/2; backGroundBar.position.set(0, 0.025, -goalDepth); goalGroup.add(backGroundBar);

// AAA Procedural Diamond Mesh Net
const netCanvas = document.createElement('canvas'); netCanvas.width = 128; netCanvas.height = 128; const nctx = netCanvas.getContext('2d');
nctx.clearRect(0, 0, 128, 128); nctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; nctx.lineWidth = 6;
nctx.beginPath(); nctx.moveTo(64, 0); nctx.lineTo(128, 64); nctx.lineTo(64, 128); nctx.lineTo(0, 64); nctx.closePath(); nctx.stroke();
const netTexture = new THREE.CanvasTexture(netCanvas); netTexture.wrapS = THREE.RepeatWrapping; netTexture.wrapT = THREE.RepeatWrapping; netTexture.anisotropy = 4;
const netMaterial = new THREE.MeshStandardMaterial({ map: netTexture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, depthWrite: false, roughness: 0.8 });
function createNet(geometry, wRep, hRep) {
    const mat = netMaterial.clone(); mat.map = netTexture.clone(); mat.map.repeat.set(wRep * 4, hRep * 4); mat.map.needsUpdate = true;
    return new THREE.Mesh(geometry, mat);
}

const topNet = createNet(new THREE.PlaneGeometry(goalWidth, topDepth), goalWidth, topDepth); topNet.rotation.x = -Math.PI/2; topNet.position.set(0, postHeight, -topDepth/2); goalGroup.add(topNet);
const backNetHeight = Math.sqrt(Math.pow(postHeight, 2) + Math.pow(goalDepth - topDepth, 2));
const backNetAngle = Math.atan2(goalDepth - topDepth, postHeight);
const backNet = createNet(new THREE.PlaneGeometry(goalWidth, backNetHeight), goalWidth, backNetHeight); backNet.rotation.x = backNetAngle; backNet.position.set(0, postHeight/2, -(topDepth + goalDepth)/2); goalGroup.add(backNet);

// Fixed Side Net (Mathematically correct vertices mapped nicely)
const sideNetPos = new Float32Array([ 0, postHeight, 0,  0, postHeight, -topDepth,  0, 0, -goalDepth,  0, 0, 0 ]);
const sideNetIndices = [ 0, 1, 2,  0, 2, 3 ];
const sideNetUV = new Float32Array([ 0, 1,  0.25, 1,  1, 0,  0, 0 ]); // Valid 0-1 range to avoid ugly stretching!
const sideGeo = new THREE.BufferGeometry(); sideGeo.setAttribute('position', new THREE.BufferAttribute(sideNetPos, 3)); sideGeo.setAttribute('uv', new THREE.BufferAttribute(sideNetUV, 2)); sideGeo.setIndex(sideNetIndices); sideGeo.computeVertexNormals();
const leftSideNet = createNet(sideGeo, goalDepth, postHeight); leftSideNet.position.x = -goalWidth/2; goalGroup.add(leftSideNet);
const rightSideNet = createNet(sideGeo, goalDepth, postHeight); rightSideNet.position.x = goalWidth/2; goalGroup.add(rightSideNet);

goalGroup.position.set(0, 0, -20);
scene.add(goalGroup);

// Goal Physics (Dampened so ball stays in!)
const netPhysicsMat = new CANNON.Material("net");
const netContactMat = new CANNON.ContactMaterial(physicsMaterial, netPhysicsMat, { friction: 0.5, restitution: 0.05 });
world.addContactMaterial(netContactMat);

const createCylinderBody = (x, y, z, radius, height, eulerZ, mat) => {
    const body = new CANNON.Body({ mass: 0, material: mat });
    body.addShape(new CANNON.Cylinder(radius, radius, height, 16));
    body.position.set(x, y, z);
    if (eulerZ) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,0,1), eulerZ);
    world.addBody(body);
};
createCylinderBody(-3.6, 1.5, -20, 0.1, 3, 0, physicsMaterial); // Left post
createCylinderBody(3.6, 1.5, -20, 0.1, 3, 0, physicsMaterial); // Right post
createCylinderBody(0, 3, -20, 0.1, 7.2, Math.PI/2, physicsMaterial); // Crossbar

// Net physics bodies
const backNetBody = new CANNON.Body({ mass: 0, material: netPhysicsMat });
// Slanted back net physics
const backNetShape = new CANNON.Box(new CANNON.Vec3(3.6, backNetHeight/2, 0.05));
backNetBody.addShape(backNetShape);
backNetBody.position.set(0, postHeight/2, -20 - (topDepth + goalDepth)/2);
backNetBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1,0,0), backNetAngle);
world.addBody(backNetBody);

const sideNetShape = new CANNON.Box(new CANNON.Vec3(0.05, 1.5, goalDepth/2));
const leftNetBody = new CANNON.Body({ mass: 0, material: netPhysicsMat });
leftNetBody.addShape(sideNetShape); leftNetBody.position.set(-3.6, 1.5, -21); world.addBody(leftNetBody);
const rightNetBody = new CANNON.Body({ mass: 0, material: netPhysicsMat });
rightNetBody.addShape(sideNetShape); rightNetBody.position.set(3.6, 1.5, -21); world.addBody(rightNetBody);
const topNetBody = new CANNON.Body({ mass: 0, material: netPhysicsMat });
topNetBody.addShape(new CANNON.Box(new CANNON.Vec3(3.6, 0.05, topDepth/2)));
topNetBody.position.set(0, 3.0, -20.4); world.addBody(topNetBody);

// High Quality Telstar Ball (Loaded Texture)
const ballRadius = 0.22;
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballTex = textureLoader.load('assets/ball_texture.jpg');
const ballMat = new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.6, metalness: 0.1 });
const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true; 
scene.add(ballMesh);

const ballBody = new CANNON.Body({ mass: 0.43, shape: new CANNON.Sphere(ballRadius), material: physicsMaterial, linearDamping: 0.1, angularDamping: 0.1 });
world.addBody(ballBody);

// --- Massive 3D Stadium (InstancedMesh) ---
const stadiumGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
const stadiumMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, roughness: 0.8 });
const instancedSeats = new THREE.InstancedMesh(stadiumGeo, stadiumMat, 20000);
let seatIdx = 0;
const dummy = new THREE.Object3D();
for(let r=0; r<40; r++) { 
    let radiusX = 30 + r * 1.5;
    let radiusZ = 40 + r * 1.5;
    let y = r * 1.0;
    let numSeats = Math.floor(Math.PI * 2 * Math.sqrt((radiusX*radiusX + radiusZ*radiusZ)/2) / 0.6);
    if (seatIdx + numSeats > 20000) break;
    for(let i=0; i<numSeats; i++) {
        let angle = (i / numSeats) * Math.PI * 2;
        let x = Math.cos(angle) * radiusX;
        let z = Math.sin(angle) * radiusZ;
        dummy.position.set(x, y, z);
        dummy.lookAt(0, y, 0);
        dummy.updateMatrix();
        instancedSeats.setMatrixAt(seatIdx, dummy.matrix);
        instancedSeats.setColorAt(seatIdx, new THREE.Color().setHSL(Math.random()*0.1 + 0.9, 0.8, 0.5));
        seatIdx++;
    }
}
instancedSeats.count = seatIdx;
instancedSeats.instanceColor.needsUpdate = true;
scene.add(instancedSeats);

// Stadium Lights
const addFloodlight = (x, y, z) => {
    const fl = new THREE.SpotLight(0xffffff, 2, 200, Math.PI/6, 0.5, 1);
    fl.position.set(x, y, z);
    fl.target.position.set(0,0,0);
    fl.castShadow = true;
    scene.add(fl);
    scene.add(fl.target);
    const poleGeo = new THREE.CylinderGeometry(0.5, 0.5, y, 8);
    const pole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({color: 0x333333}));
    pole.position.set(x, y/2, z);
    scene.add(pole);
};
addFloodlight(40, 30, -50); addFloodlight(-40, 30, -50);
addFloodlight(40, 30, 50); addFloodlight(-40, 30, 50);

scene.background = new THREE.Color(0x000511); // Dark night sky
scene.fog = new THREE.FogExp2(0x000511, 0.015);

// --- 3D Animated Goalkeeper (GLTF) ---
let mixer;
let gkModel;
const gkGroup = new THREE.Group();
gkGroup.position.set(0, 0, -19.5);
scene.add(gkGroup);

const loader = new THREE.GLTFLoader();
loader.load('assets/goalkeeper.glb', (gltf) => {
    gkModel = gltf.scene;
    gkModel.scale.set(1.8, 1.8, 1.8); 
    gkModel.rotation.y = Math.PI; 
    gkModel.position.set(0, 0, 0);
    gkModel.traverse((child) => {
        if(child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({ color: 0x00ff00, roughness: 0.5, metalness: 0.1 });
            child.castShadow = true;
        }
    });
    gkGroup.add(gkModel);
    if(gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(gkModel);
        mixer.clipAction(gltf.animations[0]).play();
    }
});

const gkBodyPhysics = new CANNON.Body({
    mass: 0, type: CANNON.Body.KINEMATIC,
    shape: new CANNON.Cylinder(0.5, 0.5, 2, 16),
    position: new CANNON.Vec3(0, 1.0, -19.5)
});
world.addBody(gkBodyPhysics);

// --- Moving Targets ---
let targets = [];
window.spawnTargets = function() {
    targets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
    targets = [];
    
    // Spawn 3 dynamic targets with varying sizes and movement
    for(let i=0; i<3; i++) {
        let size = Math.random() * 0.3 + 0.4; // 0.4m to 0.7m radius
        let isMoving = Math.random() > 0.3; // 70% chance to move
        
        // Procedural Target Texture (Concentric circles)
        const tc = document.createElement('canvas'); tc.width = 256; tc.height = 256;
        const tctx = tc.getContext('2d');
        tctx.fillStyle = '#ff0000'; tctx.beginPath(); tctx.arc(128,128,128,0,Math.PI*2); tctx.fill();
        tctx.fillStyle = '#ffffff'; tctx.beginPath(); tctx.arc(128,128,85,0,Math.PI*2); tctx.fill();
        tctx.fillStyle = '#ff0000'; tctx.beginPath(); tctx.arc(128,128,42,0,Math.PI*2); tctx.fill();
        
        let tMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(size, size, 0.1, 32), 
            new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(tc), roughness: 0.3 })
        );
        tMesh.rotation.x = Math.PI / 2;
        let x = (Math.random() - 0.5) * 6.0;
        let y = Math.random() * 1.5 + 0.8;
        tMesh.position.set(x, y, -20.2); // Just inside the net
        tMesh.castShadow = true;
        scene.add(tMesh);
        
        let tBody = new CANNON.Body({ isTrigger: true, shape: new CANNON.Cylinder(size, size, 0.1, 16), position: new CANNON.Vec3(x, y, -20.2) });
        let q = new CANNON.Quaternion(); q.setFromAxisAngle(new CANNON.Vec3(1,0,0), Math.PI/2);
        tBody.quaternion.copy(q);
        world.addBody(tBody);
        
        targets.push({ mesh: tMesh, body: tBody, active: true, isMoving: isMoving, originX: x, originY: y, speed: Math.random()*2+1.0, offset: Math.random()*Math.PI*2, points: Math.round(1/size * 100), size: size });
    }
};

// --- Particles ---
const particles = [];
const createExplosion = (x, y, z, colorStr) => {
    const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(colorStr) });
    for(let i=0; i<30; i++) {
        const p = new THREE.Mesh(pGeo, pMat); p.position.set(x, y, z); scene.add(p);
        particles.push({ mesh: p, vx: (Math.random() - 0.5) * 15, vy: Math.random() * 15, vz: (Math.random() - 0.5) * 15, life: 1.0 });
    }
};

// --- Game Logic ---
let isAiming = false;
let swipeStart = { x: 0, y: 0, time: 0 };
let swipeEnd = { x: 0, y: 0, time: 0 };
let curveAmount = 0;

window.resetBall = function() {
    ballBody.position.set(0, ballRadius, -9); // Real penalty spot 11m from goal line
    ballBody.velocity.set(0, 0, 0); 
    ballBody.angularVelocity.set(0, 0, 0);
    ballMesh.position.copy(ballBody.position); 
    ballMesh.quaternion.copy(ballBody.quaternion);
    ballBody.scored = false; curveAmount = 0;
    
    camera.position.set(0, 1.5, -4); // Place camera directly behind the penalty spot
    camera.lookAt(0, 1, -20);
    if(targets.filter(t => t.active).length === 0) spawnTargets();
    document.getElementById('msg').style.display = 'none';
    isAiming = true;
};

window.nextShot = function() {
    document.getElementById('next-btn').style.display = 'none';
    resetBall();
};

window.addEventListener('pointerdown', (e) => {
    if(!gameActive || !isAiming || e.target.tagName === 'BUTTON' || e.target.closest('.char-card')) return;
    swipeStart.x = e.clientX; swipeStart.y = e.clientY; swipeStart.time = Date.now();
});

window.addEventListener('pointerup', (e) => {
    if(!gameActive || !isAiming || e.target.tagName === 'BUTTON' || e.target.closest('.char-card')) return;
    swipeEnd.x = e.clientX; swipeEnd.y = e.clientY; swipeEnd.time = Date.now();
    
    const dx = swipeEnd.x - swipeStart.x; const dy = swipeEnd.y - swipeStart.y; const dt = (swipeEnd.time - swipeStart.time) / 1000;
    
    if (dt > 0 && dy < -10) {
        isAiming = false;
        // Fine-tuned AAA swipe mechanics
        let vz = Math.max(dy * 0.1, -40); 
        let vy = Math.min(-dy * 0.03, 10);
        let vx = dx * 0.02;
        ballBody.velocity.set(vx, vy, vz);
        curveAmount = dx * 0.02;
        setTimeout(() => { document.getElementById('next-btn').style.display = 'block'; }, 3000);
    }
});

const clock = new THREE.Clock();
const update = () => {
    requestAnimationFrame(update);
    if(!gameActive) return; // Pause rendering/physics if menu is open
    
    const dt = clock.getDelta();
    const time = Date.now() * 0.002;
    world.step(1/60, dt, 3);
    
    // Magnus curve logic
    if (!isAiming && ballBody.position.y > ballRadius + 0.1) {
        ballBody.force.x += curveAmount * 2.0;
        ballBody.angularVelocity.set(0, curveAmount, -ballBody.velocity.z * 0.5);
    }
    
    ballMesh.position.copy(ballBody.position); ballMesh.quaternion.copy(ballBody.quaternion);
    
    // Dynamic Camera Tracking (follows ball dynamically)
    if (!isAiming) {
        camera.position.z += ((ballMesh.position.z + 4) - camera.position.z) * 0.1;
        camera.position.x += ((ballMesh.position.x * 0.3) - camera.position.x) * 0.1;
        camera.lookAt(ballMesh.position);
    }
    
    // GK AI Patrol
    let targetX = Math.sin(time) * 2.0; 
    if (!isAiming && ballBody.position.z > -20 && ballBody.position.z < -10) {
        targetX = Math.max(-3.5, Math.min(3.5, ballBody.position.x)); // Dive
    }
    gkGroup.position.x += (targetX - gkGroup.position.x) * 0.1;
    gkBodyPhysics.position.x = gkGroup.position.x;
    if(mixer) mixer.update(dt);

    
    // Process Targets
    targets.forEach(t => {
        if(t.active) {
            if(t.isMoving) {
                t.mesh.position.x = t.originX + Math.sin(time * t.speed + t.offset) * 1.5;
                t.mesh.position.x = Math.max(-3.2, Math.min(3.2, t.mesh.position.x)); // Clamp inside net
                t.body.position.copy(t.mesh.position);
            }
            if(ballBody.position.distanceTo(t.body.position) < t.size + ballRadius) {
                t.active = false; scene.remove(t.mesh); world.removeBody(t.body);
                score += t.points; document.getElementById('score').innerText = score;
                const msg = document.getElementById('msg');
                msg.innerText = "BULLSEYE! +" + t.points;
                msg.style.color = '#ffaa00';
                msg.style.display = 'block';
                createExplosion(t.body.position.x, t.body.position.y, t.body.position.z, '#ff0000');
            }
        }
    });
    
    // Process Goal Net
    if(!isAiming && ballBody.position.z < -20 && ballBody.position.x > -3.6 && ballBody.position.x < 3.6 && ballBody.position.y < 3 && !ballBody.scored) {
        ballBody.scored = true; score += 10; document.getElementById('score').innerText = score;
        const msg = document.getElementById('msg'); 
        if(!msg.innerText.includes("BULLSEYE")) {
            msg.innerText = "GOAL!"; msg.style.color = "#00ff00"; msg.style.display = 'block';
        }
    }
    
    for(let i=particles.length-1; i>=0; i--) {
        const p = particles[i]; p.life -= dt;
        if(p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); } 
        else { p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; p.vy -= 15 * dt; }
    }
    renderer.render(scene, camera);
};
update();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
