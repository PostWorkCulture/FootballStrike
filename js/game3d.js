// ============================================================================
// FOOTBALL STRIKE 3D: PRO SHOOTOUT ENGINE
// True Aerodynamic Magnus Effect • Procedural Web Audio • AAA Pitch & Stadium
// ============================================================================

// --- Global State ---
let currentGameMode = 'targets'; // 'targets' | 'duel'
let isPlaying = false;
let isAiming = false;
let score = 0;
let streak = 0;
let activeTargets = [];
let particles = [];

// --- Procedural Web Audio Synthesizer (Zero External Dependencies) ---
class StadiumAudio {
    constructor() {
        this.ctx = null;
    }
    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }
    playKick(power = 1.0) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(140 * power, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);
        gain.gain.setValueAtTime(0.85 * power, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
    }
    playPost() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        [1150, 2300, 3450].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.3 / (i + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.6);
        });
    }
    playShatter() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.25;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2500, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }
    playNet() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 0.3;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }
    playCheer() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 1.5;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1400, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.45, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }
    playWhistle() {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine'; osc1.frequency.setValueAtTime(2800, now);
        osc2.type = 'sine'; osc2.frequency.setValueAtTime(3050, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain); osc2.connect(gain);
        gain.connect(this.ctx.destination);
        osc1.start(now); osc2.start(now);
        osc1.stop(now + 0.35); osc2.stop(now + 0.35);
    }
}
const sfx = new StadiumAudio();

// --- Three.js & Cannon.js Initialization ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030712);
scene.fog = new THREE.FogExp2(0x030712, 0.009);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.05, 600);
camera.position.set(0, 1.4, -4.8);
camera.lookAt(0, 0.8, -20);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// Cannon Physics World
const world = new CANNON.World();
world.gravity.set(0, -9.81, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const ballPhysMat = new CANNON.Material("ball");
const pitchPhysMat = new CANNON.Material("pitch");
const postPhysMat = new CANNON.Material("post");
const netPhysMat = new CANNON.Material("net");

world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, pitchPhysMat, { friction: 0.75, restitution: 0.45 }));
world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, postPhysMat, { friction: 0.2, restitution: 0.75 }));
world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, netPhysMat, { friction: 0.98, restitution: 0.0 }));

// --- Atmospheric Lighting ---
const ambientLight = new THREE.AmbientLight(0x7590b5, 0.45);
scene.add(ambientLight);

const mainSun = new THREE.DirectionalLight(0xffffff, 0.55);
mainSun.position.set(20, 35, 10);
mainSun.castShadow = true;
scene.add(mainSun);

const createFloodlight = (x, y, z, tx, ty, tz) => {
    const spot = new THREE.SpotLight(0xf2f7ff, 3.5, 160, Math.PI / 3.6, 0.35, 1.0);
    spot.position.set(x, y, z);
    spot.target.position.set(tx, ty, tz);
    spot.castShadow = true;
    spot.shadow.mapSize.width = 1024; spot.shadow.mapSize.height = 1024;
    scene.add(spot);
    scene.add(spot.target);
    return spot;
};
createFloodlight(36, 32, -45, 0, 0, -15);
createFloodlight(-36, 32, -45, 0, 0, -15);
createFloodlight(36, 32, 25, 0, 0, -10);
createFloodlight(-36, 32, 25, 0, 0, -10);

// --- High-Granularity Procedural Pitch & Markings ---
function generateTurf() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    const base = ctx.createLinearGradient(0, 0, 0, 2048);
    base.addColorStop(0, '#0e2b12'); base.addColorStop(0.5, '#133917'); base.addColorStop(1, '#0c2610');
    ctx.fillStyle = base; ctx.fillRect(0, 0, 2048, 2048);

    const imgData = ctx.getImageData(0, 0, 2048, 2048);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 44;
        const soil = Math.random() < 0.04 ? -22 : 0;
        d[i] = Math.min(255, Math.max(0, d[i] + n * 0.6 + soil));
        d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n * 1.15));
        d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n * 0.45 + soil));
    }
    ctx.putImageData(imgData, 0, 0);

    ctx.lineWidth = 1.35;
    for (let b = 0; b < 22000; b++) {
        const bx = Math.random() * 2048; const by = Math.random() * 2048;
        const len = 3 + Math.random() * 8;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.75;
        ctx.strokeStyle = Math.random() > 0.65 ? 'rgba(62, 172, 76, 0.24)' : 'rgba(18, 64, 25, 0.3)';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len); ctx.stroke();
    }

    const stripeH = 2048 / 8;
    for (let s = 0; s < 8; s++) {
        ctx.fillStyle = (s % 2 === 0) ? 'rgba(255, 255, 255, 0.068)' : 'rgba(0, 0, 0, 0.088)';
        ctx.fillRect(0, s * stripeH, 2048, stripeH);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 10); tex.anisotropy = 16;
    return tex;
}

function generateBump() {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 512, 512);
    const imgData = ctx.getImageData(0, 0, 512, 512); const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const val = 128 + (Math.random() - 0.5) * 95;
        d[i] = val; d[i + 1] = val; d[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(40, 80);
    return tex;
}

function generateChalkDecal() {
    const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, 2048, 2048);
    const goalLineY = 512, centerX = 1024, pxPerMeter = 51.2;

    function drawChalk(x1, y1, x2, y2, width) {
        ctx.save(); ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'; ctx.lineWidth = width * 1.8;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
    }
    const regLineWidth = 12 * 0.0512 * 10;

    // Goal Line, 6-Yard Box, 18-Yard Box
    drawChalk(0, goalLineY, 2048, goalLineY, regLineWidth);
    const hG = (18.32 / 2) * pxPerMeter, dG = 5.5 * pxPerMeter;
    drawChalk(centerX - hG, goalLineY, centerX - hG, goalLineY + dG, regLineWidth);
    drawChalk(centerX + hG, goalLineY, centerX + hG, goalLineY + dG, regLineWidth);
    drawChalk(centerX - hG, goalLineY + dG, centerX + hG, goalLineY + dG, regLineWidth);

    const hP = (40.32 / 2) * pxPerMeter, dP = 16.5 * pxPerMeter;
    drawChalk(centerX - hP, goalLineY, centerX - hP, goalLineY + dP, regLineWidth);
    drawChalk(centerX + hP, goalLineY, centerX + hP, goalLineY + dP, regLineWidth);
    drawChalk(centerX - hP, goalLineY + dP, centerX + hP, goalLineY + dP, regLineWidth);

    // 11m Penalty Spot & Wear Divot
    const spotY = goalLineY + 11 * pxPerMeter;
    const sRad = (0.22 / 2) * pxPerMeter * 1.25;
    const wearGrad = ctx.createRadialGradient(centerX, spotY, sRad * 0.7, centerX, spotY, sRad * 8.5);
    wearGrad.addColorStop(0, 'rgba(32, 20, 10, 0.58)');
    wearGrad.addColorStop(0.35, 'rgba(74, 85, 36, 0.44)');
    wearGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = wearGrad; ctx.beginPath(); ctx.arc(centerX, spotY, sRad * 8.5, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.beginPath(); ctx.arc(centerX, spotY, sRad, 0, Math.PI * 2); ctx.fill();

    // D-Arc
    const dRad = 9.15 * pxPerMeter;
    const sAng = Math.asin((dP - 11 * pxPerMeter) / dRad);
    ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; ctx.lineWidth = regLineWidth;
    ctx.beginPath(); ctx.arc(centerX, spotY, dRad, sAng, Math.PI - sAng, false); ctx.stroke(); ctx.restore();

    // Goalkeeper Shuffle Wear
    const gkWear = ctx.createRadialGradient(centerX, goalLineY, 25, centerX, goalLineY, 320);
    gkWear.addColorStop(0, 'rgba(38, 25, 12, 0.52)');
    gkWear.addColorStop(0.5, 'rgba(80, 94, 42, 0.35)');
    gkWear.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gkWear; ctx.beginPath(); ctx.ellipse(centerX, goalLineY, 320, 60, 0, 0, Math.PI * 2); ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 16;
    return tex;
}

const groundMat = new THREE.MeshStandardMaterial({
    map: generateTurf(), bumpMap: generateBump(), bumpScale: 0.05, roughness: 0.5, metalness: 0.06
});
const groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(85, 160), groundMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: pitchPhysMat });
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

const chalkMat = new THREE.MeshBasicMaterial({ map: generateChalkDecal(), transparent: true, opacity: 0.98, depthWrite: false });
const chalkMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), chalkMat);
chalkMesh.rotation.x = -Math.PI / 2;
chalkMesh.position.set(0, 0.015, -10);
scene.add(chalkMesh);

// --- 4-Sided 3D Stadium Architecture ---
const stadium = new THREE.Group();

function generateCrowdTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 512);

    const fanColors = ['#e11d48', '#38bdf8', '#fbbf24', '#ffffff', '#22c55e', '#64748b', '#cbd5e1', '#0284c7'];
    for (let row = 0; row < 512; row += 8) {
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, row, 1024, 2);
        for (let col = 0; col < 1024; col += 6) {
            if (Math.random() > 0.15) {
                ctx.fillStyle = fanColors[Math.floor(Math.random() * fanColors.length)];
                ctx.fillRect(col + (Math.random() * 2), row + 2, 4, 5);
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(col + 1, row + 1, 2, 2); // Supporter face/head
            }
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2);
    return tex;
}

const crowdTex = generateCrowdTexture();
const seatTiersMat = new THREE.MeshStandardMaterial({ 
    map: crowdTex, 
    roughness: 0.85, 
    metalness: 0.1 
});

for (let t = 0; t < 12; t++) {
    const w = 70 + t * 3;
    const tier = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 2.8), seatTiersMat);
    tier.position.set(0, 1.2 + t * 1.5, -30 - t * 2.6);
    stadium.add(tier);
}
for (let t = 0; t < 8; t++) {
    const w = 70 + t * 3;
    const tier = new THREE.Mesh(new THREE.BoxGeometry(w, 1.4, 2.8), seatTiersMat);
    tier.position.set(0, 1.2 + t * 1.5, 20 + t * 2.6);
    stadium.add(tier);
}
for (let t = 0; t < 10; t++) {
    const len = 95 + t * 2;
    const leftTier = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, len), seatTiersMat);
    leftTier.position.set(-36 - t * 2.5, 1.2 + t * 1.5, -8);
    stadium.add(leftTier);
    const rightTier = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, len), seatTiersMat);
    rightTier.position.set(36 + t * 2.5, 1.2 + t * 1.5, -8);
    stadium.add(rightTier);
}

// Perimeter LED Boards
const adTexCanvas = document.createElement('canvas');
adTexCanvas.width = 1024; adTexCanvas.height = 64;
const actx = adTexCanvas.getContext('2d');
actx.fillStyle = '#0f172a'; actx.fillRect(0,0,1024,64);
actx.fillStyle = '#f59e0b'; actx.font = 'bold 28px sans-serif';
actx.fillText('FOOTBALL STRIKE 3D • WORLD PENALTY CHAMPIONSHIP • MASTER THE SWERVE', 20, 44);
const adTex = new THREE.CanvasTexture(adTexCanvas);
adTex.wrapS = THREE.RepeatWrapping; adTex.repeat.set(4, 1);
const adMat = new THREE.MeshBasicMaterial({ map: adTex });

const northAd = new THREE.Mesh(new THREE.BoxGeometry(72, 1.0, 0.3), adMat);
northAd.position.set(0, 0.5, -27);
stadium.add(northAd);
const leftAd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 80), adMat);
leftAd.position.set(-34, 0.5, -8);
stadium.add(leftAd);
const rightAd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 80), adMat);
rightAd.position.set(34, 0.5, -8);
stadium.add(rightAd);
scene.add(stadium);

// --- Regulation Goal Frame & Fully Enclosed Dynamic Net ---
const goalGroup = new THREE.Group();
const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.35 });
const stanchionMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.8 });
const postRadius = 0.06, postHeight = 2.44, goalWidth = 7.32, goalDepth = 2.0;

// Front Goal Posts & Crossbar
const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 32), postMat);
leftPost.position.set(-goalWidth / 2, postHeight / 2, 0); leftPost.castShadow = true; goalGroup.add(leftPost);

const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 32), postMat);
rightPost.position.set(goalWidth / 2, postHeight / 2, 0); rightPost.castShadow = true; goalGroup.add(rightPost);

const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius * 2, 32), postMat);
crossbar.rotation.z = Math.PI / 2; crossbar.position.set(0, postHeight, 0); crossbar.castShadow = true; goalGroup.add(crossbar);

// Rear Support Tension Stanchions
const leftStanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.15, 16), stanchionMat);
leftStanchion.position.set(-goalWidth / 2 - 0.02, postHeight / 2, -goalDepth / 2);
leftStanchion.rotation.x = -0.58; goalGroup.add(leftStanchion);

const rightStanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.15, 16), stanchionMat);
rightStanchion.position.set(goalWidth / 2 + 0.02, postHeight / 2, -goalDepth / 2);
rightStanchion.rotation.x = -0.58; goalGroup.add(rightStanchion);

// Bottom Ground Anchor Frame
const bottomBackBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, goalWidth, 16), stanchionMat);
bottomBackBar.rotation.z = Math.PI / 2; bottomBackBar.position.set(0, 0.03, -goalDepth); goalGroup.add(bottomBackBar);

// High-Fidelity Diamond Mesh Netting Texture
const netCanvas = document.createElement('canvas'); netCanvas.width = 64; netCanvas.height = 64;
const nctx = netCanvas.getContext('2d'); nctx.clearRect(0, 0, 64, 64);
nctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; nctx.lineWidth = 2.0;
nctx.beginPath(); nctx.moveTo(32, 0); nctx.lineTo(64, 32); nctx.lineTo(32, 64); nctx.lineTo(0, 32); nctx.closePath(); nctx.stroke();
const netTex = new THREE.CanvasTexture(netCanvas); netTex.wrapS = THREE.RepeatWrapping; netTex.wrapT = THREE.RepeatWrapping;
netTex.repeat.set(36, 12);
const netMat = new THREE.MeshStandardMaterial({ map: netTex, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.85 });

// 1. Deformable Subdivided Back Net (Dynamic Billow)
const backNetGeo = new THREE.PlaneGeometry(goalWidth, postHeight, 32, 20);
const netVertexCount = backNetGeo.attributes.position.count;
const netOrigPositions = new Float32Array(backNetGeo.attributes.position.array);
const netDisplacements = new Float32Array(netVertexCount);
const netVelocities = new Float32Array(netVertexCount);

const backNet = new THREE.Mesh(backNetGeo, netMat);
backNet.position.set(0, postHeight / 2, -goalDepth);
goalGroup.add(backNet);

// 2. Left Side Net
const sideNetTex = netTex.clone(); sideNetTex.repeat.set(10, 12);
const sideNetMat = new THREE.MeshStandardMaterial({ map: sideNetTex, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.85 });
const leftSideNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, postHeight), sideNetMat);
leftSideNet.rotation.y = Math.PI / 2;
leftSideNet.position.set(-goalWidth / 2, postHeight / 2, -goalDepth / 2);
goalGroup.add(leftSideNet);

// 3. Right Side Net
const rightSideNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, postHeight), sideNetMat);
rightSideNet.rotation.y = -Math.PI / 2;
rightSideNet.position.set(goalWidth / 2, postHeight / 2, -goalDepth / 2);
goalGroup.add(rightSideNet);

// 4. Roof Net
const roofNetTex = netTex.clone(); roofNetTex.repeat.set(36, 10);
const roofNetMat = new THREE.MeshStandardMaterial({ map: roofNetTex, transparent: true, alphaTest: 0.15, side: THREE.DoubleSide, roughness: 0.85 });
const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalDepth), roofNetMat);
roofNet.rotation.x = Math.PI / 2;
roofNet.position.set(0, postHeight, -goalDepth / 2);
goalGroup.add(roofNet);

goalGroup.position.set(0, 0, -20);
scene.add(goalGroup);

// Dynamic Net Billow & Wave Spring Solver
function triggerNetBillow(worldHitX, worldHitY) {
    const localHitX = worldHitX;
    const localHitY = worldHitY - (postHeight / 2);
    const pos = backNetGeo.attributes.position.array;

    for (let i = 0; i < netVertexCount; i++) {
        const vx = netOrigPositions[i * 3];
        const vy = netOrigPositions[i * 3 + 1];
        const dist = Math.hypot(vx - localHitX, vy - localHitY);
        if (dist < 1.35) {
            const gaussian = Math.exp(-(dist * dist) / (2 * 0.42 * 0.42));
            netVelocities[i] -= gaussian * 8.0; // Pocket backwards into goal
        }
    }
}

function updateNetDeformation(dt) {
    dt = Math.min(0.033, dt); // Clamped for absolute numerical stability
    const pos = backNetGeo.attributes.position.array;
    let active = false;

    for (let i = 0; i < netVertexCount; i++) {
        if (Math.abs(netDisplacements[i]) > 0.0005 || Math.abs(netVelocities[i]) > 0.0005) {
            active = true;
            // Spring force towards rest + viscous air damping
            const springForce = -36.0 * netDisplacements[i];
            const dampingForce = -8.5 * netVelocities[i];
            netVelocities[i] += (springForce + dampingForce) * dt;
            netVelocities[i] = Math.max(-8, Math.min(8, netVelocities[i])); // velocity clamp
            netDisplacements[i] += netVelocities[i] * dt;
            netDisplacements[i] = Math.max(-0.55, Math.min(0.02, netDisplacements[i])); // physical pocket clamp

            pos[i * 3 + 2] = netOrigPositions[i * 3 + 2] + netDisplacements[i];
        } else {
            pos[i * 3 + 2] = netOrigPositions[i * 3 + 2];
            netDisplacements[i] = 0;
            netVelocities[i] = 0;
        }
    }
    if (active) {
        backNetGeo.attributes.position.needsUpdate = true;
        backNetGeo.computeVertexNormals();
    }
}

// Rigid Goal Post & Crossbar Cannon Colliders
const addCylinderCollider = (x, y, z, r, h, rotZ) => {
    const b = new CANNON.Body({ mass: 0, material: postPhysMat });
    b.addShape(new CANNON.Cylinder(r, r, h, 16));
    b.position.set(x, y, z);
    if (rotZ) b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), rotZ);
    world.addBody(b);
};
addCylinderCollider(-goalWidth / 2, postHeight / 2, -20, postRadius, postHeight);
addCylinderCollider(goalWidth / 2, postHeight / 2, -20, postRadius, postHeight);
addCylinderCollider(0, postHeight, -20, postRadius, goalWidth, Math.PI / 2);

// --- High-Poly 3D Football ---
const ballRadius = 0.22;
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15 });

const bCanvas = document.createElement('canvas'); bCanvas.width = 512; bCanvas.height = 256;
const bctx = bCanvas.getContext('2d'); bctx.fillStyle = '#f8f8f8'; bctx.fillRect(0,0,512,256);
bctx.fillStyle = '#161616';
for(let p=0; p<6; p++) {
    bctx.beginPath(); bctx.arc(85 * p + 45, 64 + (p%2)*128, 28, 0, Math.PI*2); bctx.fill();
}
ballMat.map = new THREE.CanvasTexture(bCanvas);
const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true;
scene.add(ballMesh);

const ballBody = new CANNON.Body({
    mass: 0.43,
    shape: new CANNON.Sphere(ballRadius),
    material: ballPhysMat,
    linearDamping: 0.35,
    angularDamping: 0.75
});
world.addBody(ballBody);

// --- Goalkeeper Rig & AI (Athletic 3D Mesh) ---
const gkGroup = new THREE.Group();
gkGroup.position.set(0, 0, -19.6);
scene.add(gkGroup);

// Materials
const gkJerseyMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.35, metalness: 0.1 }); // Volt Emerald Jersey
const gkShortsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 }); // Navy Shorts
const gkSkinMat = new THREE.MeshStandardMaterial({ color: 0xe29d72, roughness: 0.6 }); // Skin
const gkGloveMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.2 }); // Neon Gold Latex Gloves
const gkSockMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 }); // Matching Socks
const bootMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }); // Boots

// Torso
const gkTorso = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.75, 0.36), gkJerseyMat);
gkTorso.position.y = 1.35; gkTorso.castShadow = true; gkGroup.add(gkTorso);

// Head & Hair
const gkHead = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 20), gkSkinMat);
gkHead.position.y = 1.95; gkHead.castShadow = true; gkGroup.add(gkHead);
const gkHair = new THREE.Mesh(new THREE.SphereGeometry(0.20, 16, 16), new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.9 }));
gkHair.position.set(0, 1.99, -0.02); gkGroup.add(gkHair);

// Arms (Ready Stance)
const gkLeftUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.42, 12), gkJerseyMat);
gkLeftUpperArm.position.set(-0.48, 1.45, 0.05); gkLeftUpperArm.rotation.z = 0.4; gkLeftUpperArm.rotation.x = -0.3; gkGroup.add(gkLeftUpperArm);

const gkLeftForeArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.40, 12), gkSkinMat);
gkLeftForeArm.position.set(-0.64, 1.16, 0.22); gkLeftForeArm.rotation.x = -0.8; gkLeftForeArm.rotation.z = 0.2; gkGroup.add(gkLeftForeArm);

const gkLeftGlove = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.12), gkGloveMat);
gkLeftGlove.position.set(-0.68, 0.98, 0.36); gkLeftGlove.castShadow = true; gkGroup.add(gkLeftGlove);

const gkRightUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.42, 12), gkJerseyMat);
gkRightUpperArm.position.set(0.48, 1.45, 0.05); gkRightUpperArm.rotation.z = -0.4; gkRightUpperArm.rotation.x = -0.3; gkGroup.add(gkRightUpperArm);

const gkRightForeArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.40, 12), gkSkinMat);
gkRightForeArm.position.set(0.64, 1.16, 0.22); gkRightForeArm.rotation.x = -0.8; gkRightForeArm.rotation.z = -0.2; gkGroup.add(gkRightForeArm);

const gkRightGlove = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.12), gkGloveMat);
gkRightGlove.position.set(0.68, 0.98, 0.36); gkRightGlove.castShadow = true; gkGroup.add(gkRightGlove);

// Shorts & Legs
const gkPelvis = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.32, 0.34), gkShortsMat);
gkPelvis.position.y = 0.88; gkGroup.add(gkPelvis);

const gkLeftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.72, 12), gkSockMat);
gkLeftLeg.position.set(-0.22, 0.45, 0); gkLeftLeg.castShadow = true; gkGroup.add(gkLeftLeg);
const gkLeftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.32), bootMat);
gkLeftBoot.position.set(-0.22, 0.08, 0.06); gkGroup.add(gkLeftBoot);

const gkRightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.72, 12), gkSockMat);
gkRightLeg.position.set(0.22, 0.45, 0); gkRightLeg.castShadow = true; gkGroup.add(gkRightLeg);
const gkRightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.32), bootMat);
gkRightBoot.position.set(0.22, 0.08, 0.06); gkGroup.add(gkRightBoot);

// Cannon Physics Collider for Keeper
const gkBodyCollider = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    shape: new CANNON.Box(new CANNON.Vec3(0.65, 1.05, 0.35)),
    position: new CANNON.Vec3(0, 1.05, -19.6),
    material: postPhysMat
});
gkBodyCollider.collisionResponse = 0;
world.addBody(gkBodyCollider);

// --- Professional Training Mannequin Wall (Free Kick Mode) ---
const wallGroup = new THREE.Group();
wallGroup.position.set(0, 0, -13.5); // 6m in front of penalty spot
const wallBodies = [];

const bibMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.4 }); // Neon Orange Training Bib
const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 }); // Steel Stand
const mannequinMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 }); // Blue Kit

for (let w = -1; w <= 1; w++) {
    const dummy = new THREE.Group();
    const xOffset = w * 0.85;

    // Steel Base Plate & Twin Rods
    const basePlate = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.06, 16), steelMat);
    basePlate.position.y = 0.03; dummy.add(basePlate);

    const rodL = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 8), steelMat);
    rodL.position.set(-0.14, 0.40, 0); dummy.add(rodL);
    const rodR = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 8), steelMat);
    rodR.position.set(0.14, 0.40, 0); dummy.add(rodR);

    // Torso with Athletic Bib
    const dummyTorso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.76, 0.28), bibMat);
    dummyTorso.position.y = 1.15; dummyTorso.castShadow = true; dummy.add(dummyTorso);

    // Folded Defensive Arms
    const dummyArms = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.22, 0.34), mannequinMat);
    dummyArms.position.set(0, 1.05, 0.08); dummyArms.castShadow = true; dummy.add(dummyArms);

    // Head
    const dummyHead = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), mannequinMat);
    dummyHead.position.y = 1.68; dummyHead.castShadow = true; dummy.add(dummyHead);

    dummy.position.set(xOffset, 0, 0);
    wallGroup.add(dummy);

    // Cannon Physics Collider for Wall Dummy
    const dummyBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        shape: new CANNON.Box(new CANNON.Vec3(0.35, 0.95, 0.2)),
        position: new CANNON.Vec3(xOffset, 0.95, -13.5),
        material: postPhysMat
    });
    world.addBody(dummyBody);
    wallBodies.push(dummyBody);
}
scene.add(wallGroup);
wallGroup.visible = false;
wallBodies.forEach(b => { b.collisionResponse = 0; });

// --- Tournament State & Records ---
let currentRound = 1;
const maxDuelShots = 5;
let duelResults = [];
let targetRaceTimeLeft = 45;
let targetRaceTimer = null;
let maxSpeedRecord = 0;
let maxSpinRecord = 0;
let highestStreak = 0;
let targetsShattered = 0;
let shotComplete = false;

const freeKickSpots = [
    { x: 0, z: -9.0 },       // Round 1: Central 11m penalty spot
    { x: 2.2, z: -7.6 },     // Round 2: Right side 14.5m
    { x: -2.4, z: -7.0 },    // Round 3: Left side 15m
    { x: 0.5, z: -5.5 },     // Round 4: Deep center 16.5m (over wall)
    { x: -3.4, z: -6.5 }     // Round 5: Sharp wide angle 16m
];

const targetSlotDefs = [
    { id: 0, x: -3.0, y: 2.05, type: 'glass', pts: 500, label: 'TOP CORNER!' },
    { id: 1, x: 3.0, y: 2.05, type: 'glass', pts: 500, label: 'TOP CORNER!' },
    { id: 2, x: 0, y: 1.25, type: 'bullseye', pts: 300, label: 'BULLSEYE!', isMoving: true },
    { id: 3, x: -2.8, y: 0.65, type: 'glass', pts: 350, label: 'BOTTOM CORNER!' },
    { id: 4, x: 2.8, y: 0.65, type: 'glass', pts: 350, label: 'BOTTOM CORNER!' }
];

// --- Target Factory & Continuous Respawning ---
function createTargetMeshAndBody(c) {
    const size = 0.5;
    let mesh;
    if (c.type === 'glass') {
        mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.85, 0.85, 0.05),
            new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.9 })
        );
    } else {
        const tCanvas = document.createElement('canvas'); tCanvas.width = 256; tCanvas.height = 256;
        const tctx = tCanvas.getContext('2d');
        tctx.fillStyle = '#ef4444'; tctx.beginPath(); tctx.arc(128,128,128,0,Math.PI*2); tctx.fill();
        tctx.fillStyle = '#ffffff'; tctx.beginPath(); tctx.arc(128,128,85,0,Math.PI*2); tctx.fill();
        tctx.fillStyle = '#ef4444'; tctx.beginPath(); tctx.arc(128,128,42,0,Math.PI*2); tctx.fill();
        mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(size, size, 0.05, 32),
            new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(tCanvas), roughness: 0.3 })
        );
        mesh.rotation.x = Math.PI / 2;
    }
    mesh.position.set(c.x, c.y, -20.1);
    mesh.castShadow = true;
    scene.add(mesh);

    const body = new CANNON.Body({ shape: new CANNON.Box(new CANNON.Vec3(size, size, 0.1)), position: new CANNON.Vec3(c.x, c.y, -20.1) });
    body.collisionResponse = 0;
    world.addBody(body);

    return { mesh, body, active: true, pts: c.pts, label: c.label, type: c.type, originX: c.x, isMoving: !!c.isMoving, slotId: c.id };
}

function spawnSingleTarget(slotId) {
    if (currentGameMode !== 'targets' || !isPlaying) return;
    if (activeTargets.some(t => t.active && t.slotId === slotId)) return;
    const def = targetSlotDefs.find(s => s.id === slotId);
    if (def) {
        activeTargets.push(createTargetMeshAndBody(def));
    }
}

function spawnRandomTarget() {
    if (currentGameMode !== 'targets' || !isPlaying) return;
    const occupiedSlotIds = activeTargets.filter(t => t.active).map(t => t.slotId);
    const availableDefs = targetSlotDefs.filter(d => !occupiedSlotIds.includes(d.id));
    if (availableDefs.length > 0) {
        const picked = availableDefs[Math.floor(Math.random() * availableDefs.length)];
        activeTargets.push(createTargetMeshAndBody(picked));
    }
}

let shotOutcomeTimer = null;
function finishShot(outcome, bannerMain, bannerSub, bannerColor) {
    if (shotComplete) return;
    shotComplete = true;
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);

    if (bannerMain) {
        showBanner(bannerMain, bannerSub, bannerColor);
    }

    if (currentGameMode === 'duel') {
        duelResults[currentRound - 1] = outcome;
        updateDuelPills();
    }

    document.getElementById('next-shot-btn').style.display = 'block';
    document.getElementById('tap-prompt').style.display = 'block';

    shotOutcomeTimer = setTimeout(() => {
        triggerNextShot();
    }, 2200);
}

function spawnTargets() {
    activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
    activeTargets = [];

    if (currentGameMode === 'targets') {
        wallGroup.visible = false;
        wallBodies.forEach(b => { b.collisionResponse = 0; });
        gkGroup.visible = false;
        gkBodyCollider.collisionResponse = 0;

        // Spawn initial 3 targets
        [0, 1, 2].forEach(slotId => spawnSingleTarget(slotId));
    } else {
        // Duel Mode (Goalkeeper + Defensive Wall)
        wallGroup.visible = true;
        gkGroup.visible = true;
        gkBodyCollider.collisionResponse = 1;
    }
}

function updateDuelPills() {
    const container = document.getElementById('shot-pills');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < maxDuelShots; i++) {
        const pill = document.createElement('div');
        pill.style.width = '24px';
        pill.style.height = '24px';
        pill.style.borderRadius = '50%';
        pill.style.display = 'flex';
        pill.style.alignItems = 'center';
        pill.style.justifyContent = 'center';
        pill.style.fontSize = '12px';
        pill.style.fontWeight = 'bold';
        
        if (duelResults[i] === 'goal') {
            pill.style.background = '#22c55e';
            pill.style.color = '#fff';
            pill.innerText = '✓';
            pill.style.boxShadow = '0 0 10px rgba(34, 197, 94, 0.6)';
        } else if (duelResults[i] === 'miss') {
            pill.style.background = '#ef4444';
            pill.style.color = '#fff';
            pill.innerText = '✕';
        } else if (i === currentRound - 1) {
            pill.style.border = '2px solid #38bdf8';
            pill.style.background = 'rgba(56, 189, 248, 0.2)';
            pill.innerText = (i + 1).toString();
            pill.style.color = '#38bdf8';
        } else {
            pill.style.background = 'rgba(255, 255, 255, 0.1)';
            pill.style.color = '#64748b';
            pill.innerText = (i + 1).toString();
        }
        container.appendChild(pill);
    }
}

window.showMatchResults = function(title) {
    isPlaying = false;
    isAiming = false;
    if (targetRaceTimer) clearInterval(targetRaceTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    
    sfx.playCheer();
    
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-final-score').innerText = score.toLocaleString() + ' PTS';
    
    if (currentGameMode === 'duel') {
        const goalsCount = duelResults.filter(r => r === 'goal').length;
        document.getElementById('stat-modal-accuracy').innerText = `${goalsCount} / ${maxDuelShots} Goals`;
    } else {
        document.getElementById('stat-modal-accuracy').innerText = `${targetsShattered} Targets Hit`;
    }
    
    document.getElementById('stat-modal-speed').innerText = `${maxSpeedRecord || 85} KM/H`;
    document.getElementById('stat-modal-spin').innerText = `${maxSpinRecord || 0} RPM`;
    document.getElementById('stat-modal-streak').innerText = `${Math.max(1, highestStreak)}X STREAK`;
    
    document.getElementById('results-modal').style.display = 'flex';
};

window.restartCurrentMode = function() {
    document.getElementById('results-modal').style.display = 'none';
    selectMode(currentGameMode);
};

// Dynamic Animation State
let gkDiving = false;
let gkTargetX = 0;
let gkTargetY = 1.05;
let gkTargetRotZ = 0;
let wallJumping = false;
let wallJumpTimer = 0;

// --- Particle FX (Glass Shatters & Goal Sparks) ---
function createShatterFX(x, y, z, color = 0x38bdf8) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.2 });
    for (let i = 0; i < 40; i++) {
        const p = new THREE.Mesh(geo, mat);
        p.position.set(x, y, z);
        scene.add(p);
        particles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * 12,
            vy: Math.random() * 10 + 2,
            vz: (Math.random() - 0.5) * 12,
            life: 1.0
        });
    }
}

// --- Magnus Flight & Swipe Recognition ---
let spinVector = new THREE.Vector3(); // Angular velocity (rad/s)
let shotTelemetry = { speed: 0, spin: 0, style: 'Direct' };
let swipeSamples = [];
let ballInFlight = false;
let slowMo = false;

window.resetBall = function() {
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    swipeSamples = [];
    let spotX = 0;
    let spotZ = -9.0;
    if (currentGameMode === 'duel') {
        const spotIdx = (currentRound - 1) % freeKickSpots.length;
        const spot = freeKickSpots[spotIdx];
        spotX = spot.x;
        spotZ = spot.z;
    }

    ballBody.position.set(spotX, ballRadius, spotZ);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    spinVector.set(0, 0, 0);
    ballInFlight = false;
    slowMo = false;
    ballBody.scored = false;
    ballBody.saved = false;
    shotComplete = false;

    // Reset Goalkeeper & Wall
    gkDiving = false;
    wallJumping = false;
    wallJumpTimer = 0;
    wallGroup.position.y = 0;
    wallBodies.forEach(b => { b.position.y = 0.95; });

    if (currentGameMode === 'duel') {
        const dxToGoal = -spotX;
        const wallSide = dxToGoal >= 0 ? 1 : -1;
        const wallX = spotX * 0.45 + (wallSide * 0.75);
        const wallZ = spotZ - 5.5;
        wallGroup.position.set(wallX, 0, wallZ);
        wallBodies.forEach((b, idx) => {
            const offset = (idx - 1) * 0.85;
            b.position.set(wallX + offset, 0.95, wallZ);
            b.collisionResponse = 1;
        });

        const gkStartX = -wallSide * 0.95;
        gkGroup.position.set(gkStartX, 0, -19.6);
        gkGroup.rotation.set(0, 0, 0);
        gkBodyCollider.position.set(gkStartX, 1.05, -19.6);
    }

    // Dynamic Camera Framing
    camera.position.set(spotX * 0.65, 1.4, spotZ + 4.2);
    camera.lookAt(0, 0.8, -20);

    document.getElementById('next-shot-btn').style.display = 'none';
    document.getElementById('tap-prompt').style.display = 'none';
    document.getElementById('banner').classList.remove('show');
    document.getElementById('telemetry').classList.remove('visible');

    isAiming = true;
    sfx.playWhistle();
};

// Mode Selection Handlers
window.selectMode = function(mode) {
    sfx.init();
    currentGameMode = mode;
    document.getElementById('menu').style.display = 'none';
    document.getElementById('results-modal').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    isPlaying = true;
    score = 0;
    streak = 0;
    maxSpeedRecord = 0;
    maxSpinRecord = 0;
    highestStreak = 0;
    targetsShattered = 0;
    updateHUD();

    if (targetRaceTimer) clearInterval(targetRaceTimer);

    if (mode === 'duel') {
        currentRound = 1;
        duelResults = [];
        document.getElementById('tracker-label').innerText = 'ROUND';
        document.getElementById('shot-pills').style.display = 'flex';
        document.getElementById('timer-display').style.display = 'none';
        updateDuelPills();
    } else {
        targetRaceTimeLeft = 45;
        document.getElementById('tracker-label').innerText = 'TIME';
        document.getElementById('shot-pills').style.display = 'none';
        document.getElementById('timer-display').style.display = 'block';
        document.getElementById('timer-display').style.color = '#38bdf8';
        document.getElementById('timer-display').innerText = '45s';

        targetRaceTimer = setInterval(() => {
            if (!isPlaying) { clearInterval(targetRaceTimer); return; }
            targetRaceTimeLeft--;
            document.getElementById('timer-display').innerText = targetRaceTimeLeft + 's';
            if (targetRaceTimeLeft <= 5 && targetRaceTimeLeft > 0) {
                sfx.playWhistle();
                document.getElementById('timer-display').style.color = '#ef4444';
            }
            if (targetRaceTimeLeft <= 0) {
                clearInterval(targetRaceTimer);
                showMatchResults('TARGET RACE COMPLETE!');
            }
        }, 1000);
    }

    spawnTargets();
    resetBall();
};

window.resetToMenu = function() {
    isPlaying = false;
    if (targetRaceTimer) clearInterval(targetRaceTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('results-modal').style.display = 'none';
};

window.triggerNextShot = function() {
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    if (!isPlaying && document.getElementById('results-modal').style.display === 'flex') return;

    if (currentGameMode === 'duel') {
        if (currentRound >= maxDuelShots) {
            showMatchResults('MATCH FINISHED!');
            return;
        }
        currentRound++;
        updateDuelPills();
        resetBall();
    } else {
        resetBall();
    }
};

function updateHUD() {
    document.getElementById('score-display').innerText = score;
    document.getElementById('streak-badge').innerText = Math.max(1, streak) + 'X STREAK';
}

function showBanner(main, sub, color = '#38bdf8') {
    const banner = document.getElementById('banner');
    document.getElementById('banner-main').innerText = main;
    document.getElementById('banner-main').style.color = color;
    document.getElementById('banner-sub').innerText = sub;
    banner.classList.add('show');
}

// Swipe Gesture Parser with Multi-Point Curve Sampling
window.addEventListener('pointerdown', (e) => {
    if (!isPlaying) return;
    if (shotComplete) {
        triggerNextShot();
        return;
    }
    if (!isAiming || (e.target && e.target.closest && e.target.closest('button'))) return;
    sfx.init();
    swipeSamples = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
});

window.addEventListener('pointermove', (e) => {
    if (!isPlaying || !isAiming || swipeSamples.length === 0) return;
    swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
});

window.addEventListener('pointerup', (e) => {
    if (!isPlaying || !isAiming || swipeSamples.length < 2) return;
    swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });

    const last = swipeSamples[swipeSamples.length - 1];
    // Filter to active upward flick portion (within last 750ms)
    const activeSamples = swipeSamples.filter(s => (last.time - s.time) <= 750);
    const strokeStart = activeSamples.length >= 2 ? activeSamples[0] : swipeSamples[0];
    const dt = Math.max(0.02, (last.time - strokeStart.time) / 1000);
    const dy = last.y - strokeStart.y;
    const dx = last.x - strokeStart.x;

    // Must be an upward stroke
    if (dy < -15) {
        isAiming = false;
        ballInFlight = true;

        // Calculate Curvature Deflection (midpoint deviation from straight chord)
        let maxDeflection = 0;
        const midIdx = Math.floor(activeSamples.length / 2);
        const mid = activeSamples[midIdx];
        const chordX = strokeStart.x + (last.x - strokeStart.x) * 0.5;
        maxDeflection = mid.x - chordX;

        // Launch Velocities
        const strokeSpeed = Math.hypot(dx, dy) / dt; // px/sec
        const powerNorm = Math.min(1.0, Math.max(0.35, strokeSpeed / 1600));

        const vz = -18 - powerNorm * 18; // -18 to -36 m/s (~65 to 130 km/h)
        const vy = Math.min(14, Math.max(3.5, (-dy / window.innerHeight) * 22));
        const vx = (dx / window.innerWidth) * 20;

        ballBody.velocity.set(vx, vy, vz);

        // Angular Spin Vector (Magnus Effect)
        const spinRPM = (maxDeflection / 40) * 800; // up to 1200 RPM
        const omegaY = (spinRPM * Math.PI * 2) / 60;
        spinVector.set(0, omegaY, 0);

        // Knuckleball Detection (High speed + Zero spin)
        const isKnuckle = Math.abs(spinRPM) < 90 && Math.abs(vz) > 26;
        let style = 'Direct Strike';
        if (isKnuckle) style = 'Laser Knuckleball';
        else if (spinRPM > 200) style = 'Curling Inswing';
        else if (spinRPM < -200) style = 'Curling Outswing';

        // Telemetry Update & Match Records
        const speedKmh = Math.round(Math.abs(vz) * 3.6);
        maxSpeedRecord = Math.max(maxSpeedRecord, speedKmh);
        maxSpinRecord = Math.max(maxSpinRecord, Math.round(Math.abs(spinRPM)));

        document.getElementById('stat-speed').innerText = speedKmh + ' KM/H';
        document.getElementById('stat-spin').innerText = Math.round(Math.abs(spinRPM)) + ' RPM';
        document.getElementById('stat-style').innerText = style;
        document.getElementById('telemetry').classList.add('visible');

        sfx.playKick(powerNorm);

        // Trigger AI Goalkeeper Dive & Wall Jump
        if (currentGameMode === 'duel') {
            wallJumping = true;
            wallJumpTimer = 0;
            gkDiving = true;
            const predX = vx * 0.70 + (spinVector.y * -0.04);
            const speedRatio = Math.min(1.0, speedKmh / 115);
            const keeperSkill = 0.82 - speedRatio * 0.25;
            gkTargetX = Math.max(-3.2, Math.min(3.2, predX * keeperSkill));
            const predY = Math.max(0.65, Math.min(2.1, vy * 0.22));
            gkTargetY = predY;
            gkTargetRotZ = (gkTargetX > gkGroup.position.x ? -1 : 1) * Math.min(1.1, Math.abs(gkTargetX - gkGroup.position.x) * 0.4);
        }

        // Safety timeout for shot completion
        setTimeout(() => {
            if (ballInFlight && !shotComplete && isPlaying) {
                if (currentGameMode === 'duel') {
                    finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL!' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
                } else {
                    finishShot('complete');
                    setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 600);
                }
            }
        }, 2800);
    }
    swipeSamples = [];
});

// --- Main Render & Physics Loop ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    if (!isPlaying) return;

    let dt = Math.min(0.033, clock.getDelta());
    if (slowMo) dt *= 0.35; // Cinematic slow motion near goal

    world.step(1 / 60, dt, 3);

    // Goalkeeper and Wall Animations in Duel Mode
    if (currentGameMode === 'duel') {
        if (wallJumping) {
            wallJumpTimer += dt * 4.8;
            const jumpOffset = Math.max(0, Math.sin(Math.min(Math.PI, wallJumpTimer)) * 0.52);
            wallGroup.position.y = jumpOffset;
            wallBodies.forEach(b => { b.position.y = 0.95 + jumpOffset; });
            if (wallJumpTimer >= Math.PI) {
                wallJumping = false;
                wallGroup.position.y = 0;
                wallBodies.forEach(b => { b.position.y = 0.95; });
            }
        }
        if (gkDiving) {
            gkGroup.position.x += (gkTargetX - gkGroup.position.x) * 0.12;
            gkGroup.position.y += (gkTargetY - gkGroup.position.y) * 0.10;
            gkGroup.rotation.z += (gkTargetRotZ - gkGroup.rotation.z) * 0.10;
            gkBodyCollider.position.x = gkGroup.position.x;
            gkBodyCollider.position.y = gkGroup.position.y;
        }

        // Check Goalkeeper Save
        if (ballInFlight && !ballBody.scored && !ballBody.saved) {
            const distGk = ballMesh.position.distanceTo(gkBodyCollider.position);
            if (distGk < 1.35 && Math.abs(ballMesh.position.z - (-19.6)) < 0.65) {
                ballBody.saved = true;
                streak = 0;
                updateHUD();
                sfx.playPost();
                ballBody.velocity.x *= -0.35;
                ballBody.velocity.z *= -0.25;
                ballBody.velocity.y = Math.max(1.5, ballBody.velocity.y + 2.0);
                finishShot('miss', 'SAVED!', 'DENIED BY THE KEEPER', '#f59e0b');
            }
        }
    }

    // Moving Bullseye Oscillation (Target Race Mode)
    if (currentGameMode === 'targets') {
        activeTargets.forEach(t => {
            if (t.isMoving && t.active) {
                const moveX = t.originX + Math.sin(clock.getElapsedTime() * 2.2) * 1.6;
                t.mesh.position.x = moveX;
                t.body.position.x = moveX;
            }
        });
    }

    // Dynamic Net Deform & Spring Relaxation
    updateNetDeformation(dt);

    // Continuous 3D Magnus Aerodynamic Forces
    if (ballInFlight && ballBody.position.z > -19.9) {
        const v = ballBody.velocity;
        const magnusCoeff = 0.0035;
        const fx = -spinVector.y * v.z * magnusCoeff;
        const fz = spinVector.y * v.x * magnusCoeff;

        ballBody.force.x += fx;
        ballBody.force.z += fz;

        // Ball visual spin rotation
        ballMesh.rotation.y += spinVector.y * dt;
        ballMesh.rotation.x += v.z * dt * 2.0;

        // Camera Smooth Tracking
        camera.position.z += ((ballMesh.position.z + 4.2) - camera.position.z) * 0.12;
        camera.position.x += ((ballMesh.position.x * 0.4) - camera.position.x) * 0.12;
        camera.lookAt(ballMesh.position.x, ballMesh.position.y + 0.3, ballMesh.position.z - 3);

        // Check Goal Post Collisions
        if (Math.abs(ballBody.position.z - (-20)) < 0.35 && Math.abs(ballBody.position.x) < 3.8 && ballBody.position.y < 2.6) {
            if (Math.abs(Math.abs(ballBody.position.x) - 3.66) < 0.22 || Math.abs(ballBody.position.y - 2.44) < 0.22) {
                sfx.playPost();
            }
        }
    }

    // Check Target Collisions (Target Race Mode - targets located at z = -20.1)
    if (currentGameMode === 'targets' && ballInFlight) {
        activeTargets.forEach(t => {
            if (t.active) {
                const distXY = Math.hypot(ballBody.position.x - t.mesh.position.x, ballBody.position.y - t.mesh.position.y);
                const distZ = Math.abs(ballBody.position.z - (-20.1));
                if (distXY < 0.75 && distZ < 1.1) {
                    t.active = false;
                    scene.remove(t.mesh);
                    world.removeBody(t.body);

                    targetsShattered++;
                    streak++;
                    highestStreak = Math.max(highestStreak, streak);
                    const awarded = t.pts * streak;
                    score += awarded;
                    updateHUD();

                    if (t.type === 'glass') sfx.playShatter();
                    else sfx.playNet();
                    sfx.playCheer();

                    createShatterFX(t.mesh.position.x, t.mesh.position.y, t.mesh.position.z, t.type === 'glass' ? 0x38bdf8 : 0xef4444);
                    showBanner(t.label, `+${awarded} PTS (${streak}X STREAK)`, '#38bdf8');

                    setTimeout(() => { spawnRandomTarget(); }, 750);
                    setTimeout(() => {
                        if (currentGameMode === 'targets' && isPlaying) resetBall();
                    }, 650);
                }
            }
        });
    }

    // Target Race: Auto-Reset on Miss / Low Speed
    if (currentGameMode === 'targets' && ballInFlight && (ballBody.position.z < -20.5 || (ballBody.position.z < -16 && ballBody.velocity.length() < 1.0))) {
        ballInFlight = false;
        streak = 0;
        updateHUD();
        setTimeout(() => {
            if (currentGameMode === 'targets' && isPlaying) resetBall();
        }, 650);
    }

    // Check Goal Net Entry & Volumetric Entrapment
    const inGoal = (ballBody.position.z <= -19.95 && ballBody.position.z >= -22.5 &&
                    Math.abs(ballBody.position.x) <= 3.70 && ballBody.position.y <= 2.50);

    if (inGoal) {
        if (!ballBody.scored && !ballBody.saved) {
            ballBody.scored = true;
            streak++;
            highestStreak = Math.max(highestStreak, streak);
            const pts = 200 * streak;
            score += pts;
            updateHUD();
            sfx.playNet();
            sfx.playCheer();
            slowMo = true;
            setTimeout(() => { slowMo = false; }, 600);
            triggerNetBillow(ballBody.position.x, ballBody.position.y);
            finishShot('goal', 'GOAL!', `+${pts} PTS!`, '#22c55e');
        }

        // Heavy Viscous Net Cord Damping (Instant energy dissipation)
        const netDamping = Math.max(0, 1 - 12.0 * dt);
        ballBody.velocity.x *= netDamping;
        ballBody.velocity.z *= netDamping;
        ballBody.angularVelocity.scale(netDamping, ballBody.angularVelocity);

        // Net downward pocket gravity
        ballBody.velocity.y -= 16.0 * dt;

        // Hard boundary containment (ZERO rebound, ZERO forward escape)
        if (ballBody.position.z < -21.85) {
            ballBody.position.z = -21.85;
            ballBody.velocity.z = 0;
        }
        if (ballBody.position.z < -20.10 && ballBody.velocity.z > 0) {
            ballBody.velocity.z = 0; // Forward escape physically impossible
        }
        ballBody.position.x = Math.max(-3.55, Math.min(3.55, ballBody.position.x));
        if (ballBody.position.y > 2.38) {
            ballBody.position.y = 2.38;
            ballBody.velocity.y = -1.5;
        }

        // Drop to rest on turf inside net
        if (ballBody.position.y <= ballRadius + 0.02) {
            ballBody.position.y = ballRadius;
            ballBody.velocity.set(0, 0, 0);
            ballBody.angularVelocity.set(0, 0, 0);
            ballInFlight = false;
        }
    }

    // Duel: Check Off-Target Miss (passed goal plane without scoring or save)
    if (currentGameMode === 'duel' && ballInFlight && ballBody.position.z < -20.2 && !inGoal && !ballBody.saved && !ballBody.scored) {
        streak = 0;
        updateHUD();
        finishShot('miss', 'OFF TARGET!', 'MISSED THE GOAL', '#ef4444');
    }

    // Realistic Turf Rolling Deceleration (Prevents infinite rolling anywhere on the pitch)
    if (ballBody.position.y <= ballRadius + 0.05) {
        const hSpeed = Math.hypot(ballBody.velocity.x, ballBody.velocity.z);
        if (hSpeed > 0.01) {
            const decel = inGoal ? 8.0 : 3.8; // Arrests roll in < 1 second
            const newSpeed = Math.max(0, hSpeed - decel * dt);
            const ratio = newSpeed / hSpeed;
            ballBody.velocity.x *= ratio;
            ballBody.velocity.z *= ratio;
            ballBody.angularVelocity.scale(ratio, ballBody.angularVelocity);
        } else {
            ballBody.velocity.x = 0;
            ballBody.velocity.z = 0;
            ballBody.angularVelocity.set(0, 0, 0);
            if (ballInFlight) {
                ballInFlight = false;
                if (!shotComplete && currentGameMode === 'duel') {
                    finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL!' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
                } else if (currentGameMode === 'targets') {
                    setTimeout(() => {
                        if (currentGameMode === 'targets' && isPlaying) resetBall();
                    }, 650);
                }
            }
        }
    }

    ballMesh.position.copy(ballBody.position);
    if (!ballInFlight) ballMesh.quaternion.copy(ballBody.quaternion);

    // Particle FX
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt * 1.5;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        } else {
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.vy -= 16 * dt;
        }
    }

    renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
