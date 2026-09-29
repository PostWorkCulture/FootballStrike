// ============================================================================
// FOOTBALL STRIKE 3D: TOURNAMENT EDITION (v5.0.0)
// True 3D Directional Raycast Aiming • Zero-Rebound Net Trap • Pro Goalkeeper Rig
// 4-Tier Stadium & Animated Crowd • Full Procedural Matchday Audio Engine
// ============================================================================

// --- Game State & Tournament Configuration ---
let currentGameMode = 'duel'; // 'duel' or 'targets'
let isPlaying = false;
let isAiming = false;
let shotComplete = false;
let score = 0;
let streak = 0;
let highestStreak = 0;
let maxSpeedRecord = 0;
let maxSpinRecord = 0;
let targetsShattered = 0;

// Duel Mode Configuration (5 Free Kick Rounds against GK + Wall)
let currentRound = 1;
const maxDuelShots = 5;
let duelResults = []; // 'goal', 'miss'
const freeKickSpots = [
    { x: 0, z: -9.0 },      // Round 1: Central Penalty Spot (11m)
    { x: -5.5, z: -10.5 },  // Round 2: Left Channel (16m)
    { x: 5.5, z: -10.5 },   // Round 3: Right Channel (16m)
    { x: -7.5, z: -12.0 },  // Round 4: Wide Left Arc (18m)
    { x: 7.5, z: -12.0 }    // Round 5: Wide Right Arc (18m)
];

// Target Race Configuration (45s Timed Shooting Gallery)
let targetRaceTimeLeft = 45;
let targetRaceTimer = null;
let activeTargets = [];
let particles = [];
let cameraFlashes = [];

// ============================================================================
// 1. PROCEDURAL WEB AUDIO SYNTHESIZER (REALISTIC MATCHDAY SOUNDSCAPE)
// ============================================================================
class StadiumAudio {
    constructor() {
        this.ctx = null;
        this.ambientGain = null;
        this.ambientSource = null;
    }
    init() {
        this.ensureAudio();
    }
    ensureAudio() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx !== null;
    }
    startAmbient() {
        if (!this.ensureAudio()) return;
        if (this.ambientSource) return;
        try {
            const bufferSize = this.ctx.sampleRate * 4.0;
            const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
            for (let ch = 0; ch < 2; ch++) {
                const data = buffer.getChannelData(ch);
                let b0 = 0, b1 = 0, b2 = 0;
                for (let i = 0; i < bufferSize; i++) {
                    const white = Math.random() * 2 - 1;
                    b0 = 0.99886 * b0 + white * 0.0555179;
                    b1 = 0.99332 * b1 + white * 0.0750759;
                    b2 = 0.96900 * b2 + white * 0.1538520;
                    data[i] = (b0 + b1 + b2) * 0.08;
                }
            }
            this.ambientSource = this.ctx.createBufferSource();
            this.ambientSource.buffer = buffer;
            this.ambientSource.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(360, this.ctx.currentTime);
            filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

            this.ambientGain = this.ctx.createGain();
            this.ambientGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
            this.ambientGain.gain.linearRampToValueAtTime(0.24, this.ctx.currentTime + 1.2);

            this.ambientSource.connect(filter);
            filter.connect(this.ambientGain);
            this.ambientGain.connect(this.ctx.destination);
            this.ambientSource.start();
        } catch (e) {
            // Audio context policy
        }
    }
    stopAmbient() {
        if (this.ambientGain && this.ctx) {
            try {
                this.ambientGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
                setTimeout(() => {
                    if (this.ambientSource) {
                        this.ambientSource.stop();
                        this.ambientSource.disconnect();
                        this.ambientSource = null;
                    }
                }, 500);
            } catch (e) {}
        }
    }
    playKick(power = 1.0) {
        if (!this.ensureAudio()) return;
        const now = this.ctx.currentTime;
        // Layer 1: Sub-bass chest thump
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        const startFreq = 135 + power * 40;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.14);
        oscGain.gain.setValueAtTime(0.8 * power, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);

        // Layer 2: High-velocity leather slap transient
        const bSize = Math.floor(this.ctx.sampleRate * 0.05);
        const b = this.ctx.createBuffer(1, bSize, this.ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < bSize; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bSize * 0.18));
        const noise = this.ctx.createBufferSource();
        noise.buffer = b;
        const nFilter = this.ctx.createBiquadFilter();
        nFilter.type = 'bandpass';
        nFilter.frequency.setValueAtTime(280, now);
        nFilter.Q.setValueAtTime(2.4, now);
        const nGain = this.ctx.createGain();
        nGain.gain.setValueAtTime(0.55 * power, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        noise.connect(nFilter);
        nFilter.connect(nGain);
        nGain.connect(this.ctx.destination);
        noise.start(now);
    }
    playPost() {
        if (!this.ensureAudio()) return;
        const now = this.ctx.currentTime;
        // Dual metallic chime
        [1150, 1720].forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.38 / (i + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.65);
        });
    }
    playShatter() {
        if (!this.ensureAudio()) return;
        const now = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.3);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(2600, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }
    playNet() {
        if (!this.ensureAudio()) return;
        const now = this.ctx.currentTime;
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.35);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(750, now);
        filter.Q.setValueAtTime(2.2, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }
    playCheer() {
        if (!this.ensureAudio()) return;
        const now = this.ctx.currentTime;
        // Stadium Airhorn Fanfare
        [220, 330].forEach((freq) => {
            const horn = this.ctx.createOscillator();
            const hGain = this.ctx.createGain();
            horn.type = 'sawtooth';
            horn.frequency.setValueAtTime(freq, now);
            hGain.gain.setValueAtTime(0.18, now);
            hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            horn.connect(hGain);
            hGain.connect(this.ctx.destination);
            horn.start(now);
            horn.stop(now + 0.45);
        });

        // Massive Stadium Crowd Roar
        const bufferSize = Math.floor(this.ctx.sampleRate * 2.5);
        const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
            }
        }
        const roar = this.ctx.createBufferSource();
        roar.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.55, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
        roar.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        roar.start(now);
    }
    playGasp() {
        if (!this.ensureAudio()) return;
        const now = this.ctx.currentTime;
        // "Oooooh!" Crowd Gasp on Miss or Save
        const bufferSize = Math.floor(this.ctx.sampleRate * 1.2);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(750, now);
        filter.frequency.exponentialRampToValueAtTime(320, now + 1.0);
        filter.Q.setValueAtTime(2.5, now);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.45, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        noise.start(now);
    }
    playKeeperSave() {
        if (!this.ensureAudio()) return;
        const now = this.ctx.currentTime;
        // Goalkeeper glove latex foam block
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.14);
    }
    playWhistle() {
        if (!this.ensureAudio()) return;
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine'; osc1.frequency.setValueAtTime(2850, now);
        osc2.type = 'sine'; osc2.frequency.setValueAtTime(3120, now);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc1.connect(gain); osc2.connect(gain);
        gain.connect(this.ctx.destination);
        osc1.start(now); osc2.start(now);
        osc1.stop(now + 0.38); osc2.stop(now + 0.38);
    }
}
const sfx = new StadiumAudio();

// ============================================================================
// 2. THREE.JS SCENE, CANNON PHYSICS & LIGHTING
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020617);
scene.fog = new THREE.FogExp2(0x020617, 0.004);

const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.05, 600);
camera.position.set(0, 1.4, -4.8);
camera.lookAt(0, 0.8, -20);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
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

// Atmospheric Matchday Floodlighting (Calibrated contrast)
const ambientLight = new THREE.AmbientLight(0x334155, 0.32);
scene.add(ambientLight);

const mainSun = new THREE.DirectionalLight(0xfff8ee, 0.50);
mainSun.position.set(18, 36, 12);
mainSun.castShadow = true;
scene.add(mainSun);

const createFloodlight = (x, y, z, tx, ty, tz) => {
    const spot = new THREE.SpotLight(0xf8fafc, 1.45, 110, Math.PI / 3.4, 0.45, 1.2);
    spot.position.set(x, y, z);
    spot.target.position.set(tx, ty, tz);
    spot.castShadow = true;
    spot.shadow.mapSize.width = 1024; spot.shadow.mapSize.height = 1024;
    scene.add(spot);
    scene.add(spot.target);
    return spot;
};
createFloodlight(38, 32, -42, 0, 1.2, -20);
createFloodlight(-38, 32, -42, 0, 1.2, -20);
createFloodlight(38, 32, 22, 0, 1.2, -15);
createFloodlight(-38, 32, 22, 0, 1.2, -15);

// ============================================================================
// 3. PITCH, CHALK MARKINGS & GOAL FRAME
// ============================================================================
function generateTurf() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    const base = ctx.createLinearGradient(0, 0, 0, 2048);
    base.addColorStop(0, '#164e24'); base.addColorStop(1, '#0e3818');
    ctx.fillStyle = base; ctx.fillRect(0, 0, 2048, 2048);

    const stripeCount = 28;
    const sH = 2048 / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(38, 128, 54, 0.28)' : 'rgba(10, 48, 18, 0.22)';
        ctx.fillRect(0, i * sH, 2048, sH);
    }
    const idata = ctx.getImageData(0, 0, 2048, 2048);
    const d = idata.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 16;
        d[i] = Math.min(255, Math.max(0, d[i] + n));
        d[i+1] = Math.min(255, Math.max(0, d[i+1] + n * 1.3));
        d[i+2] = Math.min(255, Math.max(0, d[i+2] + n));
    }
    ctx.putImageData(idata, 0, 0);

    ctx.lineWidth = 1.35;
    for (let b = 0; b < 12000; b++) {
        const bx = Math.random() * 2048, by = Math.random() * 2048;
        const len = 3 + Math.random() * 6;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
        ctx.strokeStyle = Math.random() > 0.65 ? 'rgba(62, 172, 76, 0.24)' : 'rgba(18, 64, 25, 0.3)';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, 10);
    return tex;
}

function generateBump() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 20000; i++) {
        const v = Math.floor(Math.random() * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);
    return tex;
}

function generateChalkDecal() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext('2d');
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
    drawChalk(0, goalLineY, 2048, goalLineY, regLineWidth);
    const hG = 9.16 * pxPerMeter, dG = 5.5 * pxPerMeter;
    drawChalk(centerX - hG, goalLineY, centerX - hG, goalLineY + dG, regLineWidth);
    drawChalk(centerX + hG, goalLineY, centerX + hG, goalLineY + dG, regLineWidth);
    drawChalk(centerX - hG, goalLineY + dG, centerX + hG, goalLineY + dG, regLineWidth);

    const hP = 20.16 * pxPerMeter, dP = 16.5 * pxPerMeter;
    drawChalk(centerX - hP, goalLineY, centerX - hP, goalLineY + dP, regLineWidth);
    drawChalk(centerX + hP, goalLineY, centerX + hP, goalLineY + dP, regLineWidth);
    drawChalk(centerX - hP, goalLineY + dP, centerX + hP, goalLineY + dP, regLineWidth);

    const spotY = goalLineY + 11 * pxPerMeter;
    ctx.save(); ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath(); ctx.arc(centerX, spotY, 0.11 * pxPerMeter * 1.8, 0, Math.PI * 2); ctx.fill();

    const dRad = 9.15 * pxPerMeter;
    const dy = (goalLineY + dP) - spotY;
    const sAng = Math.acos(dy / dRad);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'; ctx.lineWidth = regLineWidth;
    ctx.beginPath(); ctx.arc(centerX, spotY, dRad, sAng, Math.PI - sAng, false); ctx.stroke(); ctx.restore();

    // Goalmouth wear
    const gkWear = ctx.createRadialGradient(centerX, goalLineY, 25, centerX, goalLineY, 320);
    gkWear.addColorStop(0, 'rgba(84, 58, 28, 0.65)');
    gkWear.addColorStop(0.6, 'rgba(56, 42, 22, 0.35)');
    gkWear.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gkWear; ctx.beginPath(); ctx.ellipse(centerX, goalLineY, 320, 60, 0, 0, Math.PI * 2); ctx.fill();

    return new THREE.CanvasTexture(canvas);
}

const pitchGeo = new THREE.PlaneGeometry(80, 110);
const pitchMat = new THREE.MeshStandardMaterial({
    map: generateTurf(),
    bumpMap: generateBump(),
    bumpScale: 0.05,
    roughness: 0.88,
    metalness: 0.05
});
const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
pitchMesh.rotation.x = -Math.PI / 2;
pitchMesh.receiveShadow = true;
scene.add(pitchMesh);

const groundBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Plane(),
    material: pitchPhysMat
});
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

const chalkGeo = new THREE.PlaneGeometry(40, 40);
const chalkMat = new THREE.MeshBasicMaterial({
    map: generateChalkDecal(),
    transparent: true,
    opacity: 0.92,
    depthWrite: false
});
const chalkMesh = new THREE.Mesh(chalkGeo, chalkMat);
chalkMesh.rotation.x = -Math.PI / 2;
chalkMesh.position.set(0, 0.02, -10);
scene.add(chalkMesh);

// ============================================================================
// 4. 4-TIER STADIUM BOWL, ANIMATED CROWD & FLOODLIGHT TOWERS
// ============================================================================
const stadium = new THREE.Group();

function generateCrowdTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Background seat shell
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1024, 512);

    const fanColors = ['#dc2626', '#2563eb', '#38bdf8', '#fbbf24', '#ffffff', '#16a34a', '#ea580c', '#6366f1', '#e2e8f0'];
    const skinTones = ['#f8d7b8', '#e09d72', '#a56842', '#693e25', '#f3c299'];

    // 8 distinct rows of spectators
    const rowH = 64;
    for (let r = 0; r < 8; r++) {
        const rowY = r * rowH;
        // Concrete riser & step nosing
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, rowY, 1024, 14);
        ctx.fillStyle = '#fbbf24'; // Yellow safety edge
        ctx.fillRect(0, rowY + 12, 1024, 2);

        // Individual human-scale spectators
        for (let s = 0; s < 16; s++) {
            const colX = s * 64 + 4;
            const kit = fanColors[Math.floor(Math.random() * fanColors.length)];
            const skin = skinTones[Math.floor(Math.random() * skinTones.length)];

            // Fan Torso
            ctx.fillStyle = kit;
            ctx.beginPath();
            ctx.roundRect(colX + 6, rowY + 28, 44, 34, [6, 6, 0, 0]);
            ctx.fill();

            // Head & Face
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.arc(colX + 28, rowY + 22, 11, 0, Math.PI * 2);
            ctx.fill();

            // Hair / Cap
            if (Math.random() > 0.3) {
                ctx.fillStyle = Math.random() > 0.5 ? '#18181b' : kit;
                ctx.beginPath();
                ctx.arc(colX + 28, rowY + 18, 11, Math.PI, Math.PI * 2);
                ctx.fill();
            }

            // Scarf or Cheering Arms
            if (Math.random() > 0.5) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(colX + 10, rowY + 34, 36, 6);
            }
        }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

const crowdTex = generateCrowdTexture();
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.7 });
const suiteMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

// North Stand Behind Goal (14 Stepped Tiers with Human-Scaled Crowd Risers)
for (let t = 0; t < 14; t++) {
    const w = 72 + t * 2.8;
    const tierDepth = 2.4;
    const tierH = 1.35;
    const tierZ = -28 - t * 2.1;
    const tierY = 1.1 + t * 1.35;

    // Concrete Step Base
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, tierDepth), concreteMat);
    step.position.set(0, tierY, tierZ);
    stadium.add(step);

    // Front Spectator Riser Plane
    const crowdMat = new THREE.MeshStandardMaterial({
        map: crowdTex.clone(),
        roughness: 0.7
    });
    crowdMat.map.repeat.set(Math.round(w / 3.0), 1);
    crowdMat.map.needsUpdate = true;

    const riser = new THREE.Mesh(new THREE.PlaneGeometry(w, tierH), crowdMat);
    riser.position.set(0, tierY + tierH * 0.5, tierZ + tierDepth * 0.5);
    stadium.add(riser);
}

// Upper Executive VIP Hospitality Boxes
const suiteBox = new THREE.Mesh(new THREE.BoxGeometry(105, 3.5, 4.0), concreteMat);
suiteBox.position.set(0, 21.5, -57.5);
stadium.add(suiteBox);
for (let s = 0; s < 18; s++) {
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.2), suiteMat);
    windowMesh.position.set(-44 + s * 5.2, 21.5, -55.4);
    stadium.add(windowMesh);
}

// Cantilever Steel Girders & Stadium Canopy
const northRoof = new THREE.Mesh(new THREE.BoxGeometry(116, 1.2, 38), roofMat);
northRoof.position.set(0, 26.5, -46);
stadium.add(northRoof);

// South Stand (8 Tiers)
for (let t = 0; t < 8; t++) {
    const w = 72 + t * 2.8;
    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, 2.4), concreteMat);
    step.position.set(0, 1.1 + t * 1.35, 20 + t * 2.2);
    stadium.add(step);
}

// East & West Grandstands
for (let t = 0; t < 12; t++) {
    const len = 96 + t * 2.2;
    const lStep = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, len), concreteMat);
    lStep.position.set(-36 - t * 2.2, 1.1 + t * 1.35, -8);
    stadium.add(lStep);

    const rStep = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, len), concreteMat);
    rStep.position.set(36 + t * 2.2, 1.1 + t * 1.35, -8);
    stadium.add(rStep);
}

// 4 High-Intensity Steel Lattice Floodlight Towers
const floodlightLampGeo = new THREE.BoxGeometry(0.7, 0.7, 0.4);
const floodlightLampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pylonMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });

const cornerPylons = [
    { x: -38, z: -44 },
    { x: 38, z: -44 },
    { x: -38, z: 26 },
    { x: 38, z: 26 }
];

cornerPylons.forEach(pos => {
    for (let leg = 0; leg < 4; leg++) {
        const lx = (leg % 2 === 0 ? -1 : 1) * 1.3;
        const lz = (leg < 2 ? -1 : 1) * 1.3;
        const pylonLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.32, 32, 8), pylonMat);
        pylonLeg.position.set(pos.x + lx, 16, pos.z + lz);
        stadium.add(pylonLeg);
    }
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.6, 4.8), concreteMat);
    gantry.position.set(pos.x, 32, pos.z);
    stadium.add(gantry);

    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
            const lamp = new THREE.Mesh(floodlightLampGeo, floodlightLampMat);
            lamp.position.set(pos.x - 1.65 + c * 1.1, 33.2 + r * 1.0, pos.z);
            stadium.add(lamp);
        }
    }
});

// Perimeter Animated Digital LED Boards
const adTexCanvas = document.createElement('canvas');
adTexCanvas.width = 1024; adTexCanvas.height = 64;
const actx = adTexCanvas.getContext('2d');
actx.fillStyle = '#0284c7'; actx.fillRect(0, 0, 1024, 64);
actx.fillStyle = '#ffffff'; actx.font = '900 28px sans-serif';
actx.fillText('FOOTBALL STRIKE 3D • WORLD CHAMPIONSHIP • MASTER THE SWERVE', 20, 43);
const adTex = new THREE.CanvasTexture(adTexCanvas);
adTex.wrapS = THREE.RepeatWrapping; adTex.repeat.set(4, 1);
const adMat = new THREE.MeshBasicMaterial({ map: adTex });

const northAd = new THREE.Mesh(new THREE.BoxGeometry(72, 1.0, 0.3), adMat);
northAd.position.set(0, 0.5, -26.5);
stadium.add(northAd);
const leftAd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 80), adMat);
leftAd.position.set(-34, 0.5, -8);
stadium.add(leftAd);
const rightAd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 80), adMat);
rightAd.position.set(34, 0.5, -8);
stadium.add(rightAd);

// 12 Stadium Camera Flashbulbs
const flashGeo = new THREE.SphereGeometry(0.4, 8, 8);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
for (let i = 0; i < 12; i++) {
    const flash = new THREE.Mesh(flashGeo, flashMat.clone());
    flash.position.set((Math.random() - 0.5) * 65, 4 + Math.random() * 14, -30 - Math.random() * 15);
    stadium.add(flash);
    cameraFlashes.push({ mesh: flash, timer: Math.random() * 2.5 });
}

scene.add(stadium);

// ============================================================================
// 5. REGULATION GOAL FRAME & SPRING-DEFORMING NET
// ============================================================================
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

// Rear Stanchions
const leftStanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, postHeight, 16), stanchionMat);
leftStanchion.position.set(-goalWidth / 2 - 0.02, postHeight / 2, -goalDepth / 2);
leftStanchion.rotation.x = 0.22; goalGroup.add(leftStanchion);

const rightStanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, postHeight, 16), stanchionMat);
rightStanchion.position.set(goalWidth / 2 + 0.02, postHeight / 2, -goalDepth / 2);
rightStanchion.rotation.x = 0.22; goalGroup.add(rightStanchion);

const bottomBackBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, goalWidth, 16), stanchionMat);
bottomBackBar.rotation.z = Math.PI / 2; bottomBackBar.position.set(0, 0.03, -goalDepth); goalGroup.add(bottomBackBar);

// Procedural Hexagonal Net Pattern
const netCanvas = document.createElement('canvas'); netCanvas.width = 64; netCanvas.height = 64;
const nctx = netCanvas.getContext('2d');
nctx.fillStyle = 'rgba(0, 0, 0, 0)'; nctx.fillRect(0, 0, 64, 64);
nctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; nctx.lineWidth = 2.0;
nctx.beginPath(); nctx.moveTo(32, 0); nctx.lineTo(64, 32); nctx.lineTo(32, 64); nctx.lineTo(0, 32); nctx.closePath(); nctx.stroke();
const netTex = new THREE.CanvasTexture(netCanvas);
netTex.wrapS = THREE.RepeatWrapping; netTex.wrapT = THREE.RepeatWrapping;
netTex.repeat.set(24, 12);

const netMat = new THREE.MeshStandardMaterial({
    map: netTex,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    roughness: 0.7
});

// Dynamic Back Net Mesh with Spring Vertex Deformations
const backNetSegmentsX = 32, backNetSegmentsY = 16;
const backNetGeo = new THREE.PlaneGeometry(goalWidth, postHeight, backNetSegmentsX, backNetSegmentsY);
const backNet = new THREE.Mesh(backNetGeo, netMat);
backNet.position.set(0, postHeight / 2, -goalDepth);
goalGroup.add(backNet);

const sideNetMat = netMat.clone(); sideNetMat.map = netTex.clone(); sideNetMat.map.repeat.set(8, 12);
const leftSideNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, postHeight), sideNetMat);
leftSideNet.rotation.y = Math.PI / 2;
leftSideNet.position.set(-goalWidth / 2, postHeight / 2, -goalDepth / 2);
goalGroup.add(leftSideNet);

const rightSideNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, postHeight), sideNetMat);
rightSideNet.rotation.y = -Math.PI / 2;
rightSideNet.position.set(goalWidth / 2, postHeight / 2, -goalDepth / 2);
goalGroup.add(rightSideNet);

const roofNetMat = netMat.clone(); roofNetMat.map = netTex.clone(); roofNetMat.map.repeat.set(24, 8);
const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalDepth), roofNetMat);
roofNet.rotation.x = Math.PI / 2;
roofNet.position.set(0, postHeight, -goalDepth / 2);
goalGroup.add(roofNet);

goalGroup.position.set(0, 0, -20);
scene.add(goalGroup);

// Net Spring Vertex State
const netVertexCount = backNetGeo.attributes.position.count;
const netDisplacements = new Float32Array(netVertexCount);
const netVelocities = new Float32Array(netVertexCount);
const netOrigPositions = backNetGeo.attributes.position.array.slice();

function triggerNetBillow(worldHitX, worldHitY) {
    const localHitX = worldHitX;
    const localHitY = worldHitY - postHeight / 2;
    const pos = backNetGeo.attributes.position.array;

    for (let i = 0; i < netVertexCount; i++) {
        const vx = pos[i * 3];
        const vy = pos[i * 3 + 1];
        const dist = Math.hypot(vx - localHitX, vy - localHitY);
        if (dist < 2.2) {
            const impactForce = Math.max(0, (1 - dist / 2.2)) * -0.55;
            netVelocities[i] += impactForce * 12.0;
        }
    }
}

function updateNetDeformation(dt) {
    let active = false;
    const pos = backNetGeo.attributes.position.array;
    const stiffness = 85.0;
    const damping = 9.0;

    for (let i = 0; i < netVertexCount; i++) {
        if (Math.abs(netDisplacements[i]) > 0.001 || Math.abs(netVelocities[i]) > 0.01) {
            active = true;
            const force = -stiffness * netDisplacements[i] - damping * netVelocities[i];
            netVelocities[i] += force * dt;
            netDisplacements[i] += netVelocities[i] * dt;
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

// ============================================================================
// 6. HIGH-POLY 3D MATCH BALL
// ============================================================================
const ballRadius = 0.22;
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.15 });

const bCanvas = document.createElement('canvas'); bCanvas.width = 512; bCanvas.height = 256;
const bctx = bCanvas.getContext('2d'); bctx.fillStyle = '#f8f8f8'; bctx.fillRect(0, 0, 512, 256);
bctx.fillStyle = '#161616';
for (let p = 0; p < 6; p++) {
    bctx.beginPath(); bctx.arc(85 * p + 45, 64 + (p % 2) * 128, 28, 0, Math.PI * 2); bctx.fill();
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
window.ballBody = ballBody;
window.ballMesh = ballMesh;

// ============================================================================
// 7. ATHLETIC 3D GOALKEEPER MODEL & ANIMATION RIG
// ============================================================================
const gkGroup = new THREE.Group();
gkGroup.position.set(0, 0, -19.6);
scene.add(gkGroup);

// Procedural Pro Jersey Texture (Volt Emerald with Squad #1 & Crest)
function createKeeperJerseyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base Volt Emerald Neon Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#10b981'); grad.addColorStop(1, '#059669');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 1024);

    // Micro-mesh jacquard texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    for (let y = 0; y < 1024; y += 8) {
        for (let x = 0; x < 1024; x += 8) {
            if ((x + y) % 16 === 0) ctx.fillRect(x, y, 4, 4);
        }
    }

    // Flank athletic contour breathing panels
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 300, 120, 724);
    ctx.fillRect(904, 300, 120, 724);

    // Gold & White Tournament Crest Shield
    ctx.save();
    ctx.translate(320, 260);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(0, -50); ctx.lineTo(45, -20); ctx.lineTo(40, 40); ctx.lineTo(0, 65); ctx.lineTo(-40, 40); ctx.lineTo(-45, -20);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GK', 0, 10);
    ctx.restore();

    // Sponsor Logo "STRIKE AERO"
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STRIKE AERO', 512, 460);

    // Front Squad Number "1"
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 120px sans-serif';
    ctx.fillText('1', 512, 360);

    // Back Squad Number "1" (Centered on bottom half of texture)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('KEEPER', 512, 680);
    ctx.font = '900 220px sans-serif';
    ctx.fillText('1', 512, 900);

    return new THREE.CanvasTexture(canvas);
}

// Procedural Athletic Face & Hair Texture
function createKeeperFaceTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Skin Tone
    ctx.fillStyle = '#e29d72';
    ctx.fillRect(0, 0, 512, 512);

    // Athletic Eyes & Eyebrows
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(170, 220, 45, 12); // Left Brow
    ctx.fillRect(295, 220, 45, 12); // Right Brow

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(175, 240, 35, 16); // Left Eye White
    ctx.fillRect(300, 240, 35, 16); // Right Eye White

    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(192, 248, 7, 0, Math.PI * 2); ctx.fill(); // Pupil L
    ctx.beginPath(); ctx.arc(317, 248, 7, 0, Math.PI * 2); ctx.fill(); // Pupil R

    // Nose bridge shading
    ctx.fillStyle = 'rgba(165, 104, 66, 0.4)';
    ctx.fillRect(248, 245, 16, 50);

    // Mouth / Stubble
    ctx.fillStyle = 'rgba(80, 50, 30, 0.35)';
    ctx.fillRect(230, 340, 52, 14);

    return new THREE.CanvasTexture(canvas);
}

const gkJerseyMat = new THREE.MeshStandardMaterial({
    map: createKeeperJerseyTexture(),
    roughness: 0.4,
    metalness: 0.1
});
const gkFaceMat = new THREE.MeshStandardMaterial({
    map: createKeeperFaceTexture(),
    roughness: 0.55
});
const gkShortsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65 });
const gkSkinMat = new THREE.MeshStandardMaterial({ color: 0xe29d72, roughness: 0.6 });
const gkSockMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.5 });
const bootUpperMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.2 });
const bootVoltMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 });
const studMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.85, roughness: 0.2 });

// Goalkeeper Spine & Torso Group
const gkSpine = new THREE.Group();
gkGroup.add(gkSpine);

// Sculpted Athletic Torso (Broad shoulders, tapered waist)
const torsoGeo = new THREE.BoxGeometry(0.74, 0.72, 0.36);
const gkTorso = new THREE.Mesh(torsoGeo, gkJerseyMat);
gkTorso.position.y = 1.35;
gkTorso.castShadow = true;
gkSpine.add(gkTorso);

// Head & Hair Cut
const headGeo = new THREE.SphereGeometry(0.20, 24, 24);
const gkHead = new THREE.Mesh(headGeo, gkFaceMat);
gkHead.position.y = 1.94;
gkHead.castShadow = true;
gkSpine.add(gkHead);

// 3D Skin Fade Pompadour Hair
const hairGeo = new THREE.SphereGeometry(0.21, 20, 20);
const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95 });
const gkHair = new THREE.Mesh(hairGeo, hairMat);
gkHair.position.set(0, 1.98, -0.02);
gkHair.scale.set(0.98, 1.05, 0.95);
gkSpine.add(gkHair);

// Ears
const earGeo = new THREE.BoxGeometry(0.04, 0.08, 0.05);
const earL = new THREE.Mesh(earGeo, gkSkinMat); earL.position.set(-0.21, 1.93, 0); gkSpine.add(earL);
const earR = new THREE.Mesh(earGeo, gkSkinMat); earR.position.set(0.21, 1.93, 0); gkSpine.add(earR);

// Articulated Pro Latex Gloves Function
function createProGloveGroup() {
    const glove = new THREE.Group();
    // Wrist strap
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.10, 16), strapMat);
    glove.add(strap);

    // Thick Contact Latex Palm
    const palmMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25, metalness: 0.2 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.24, 0.10), palmMat);
    palm.position.set(0, 0.14, 0);
    glove.add(palm);

    // Punch Zone Backhand (Neon Orange Protection Ribs)
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.3 });
    for (let r = 0; r < 3; r++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.04), ribMat);
        rib.position.set(0, 0.10 + r * 0.06, -0.06);
        glove.add(rib);
    }

    // 4 Articulated Fingers + Thumb
    const fingerMat = palmMat;
    for (let f = 0; f < 4; f++) {
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.11, 8), fingerMat);
        finger.position.set(-0.075 + f * 0.05, 0.28, 0);
        glove.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 0.09, 8), fingerMat);
    thumb.position.set(-0.11, 0.14, 0.02);
    thumb.rotation.z = 0.55;
    glove.add(thumb);

    return glove;
}

// Left & Right Arm Assemblies
const gkLeftArmGroup = new THREE.Group();
gkLeftArmGroup.position.set(-0.44, 1.55, 0);
gkSpine.add(gkLeftArmGroup);

const upperArmGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.38, 14);
const gkLeftUpperArm = new THREE.Mesh(upperArmGeo, gkJerseyMat);
gkLeftUpperArm.position.set(-0.06, -0.16, 0.02);
gkLeftUpperArm.rotation.z = 0.35; gkLeftUpperArm.rotation.x = -0.25;
gkLeftArmGroup.add(gkLeftUpperArm);

const foreArmGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.35, 14);
const gkLeftForeArm = new THREE.Mesh(foreArmGeo, gkSkinMat);
gkLeftForeArm.position.set(-0.16, -0.42, 0.18);
gkLeftForeArm.rotation.x = -0.75; gkLeftForeArm.rotation.z = 0.15;
gkLeftArmGroup.add(gkLeftForeArm);

const gkLeftGlove = createProGloveGroup();
gkLeftGlove.position.set(-0.20, -0.58, 0.32);
gkLeftGlove.rotation.x = -0.65;
gkLeftArmGroup.add(gkLeftGlove);

const gkRightArmGroup = new THREE.Group();
gkRightArmGroup.position.set(0.44, 1.55, 0);
gkSpine.add(gkRightArmGroup);

const gkRightUpperArm = new THREE.Mesh(upperArmGeo, gkJerseyMat);
gkRightUpperArm.position.set(0.06, -0.16, 0.02);
gkRightUpperArm.rotation.z = -0.35; gkRightUpperArm.rotation.x = -0.25;
gkRightArmGroup.add(gkRightUpperArm);

const gkRightForeArm = new THREE.Mesh(foreArmGeo, gkSkinMat);
gkRightForeArm.position.set(0.16, -0.42, 0.18);
gkRightForeArm.rotation.x = -0.75; gkRightForeArm.rotation.z = -0.15;
gkRightArmGroup.add(gkRightForeArm);

const gkRightGlove = createProGloveGroup();
gkRightGlove.position.set(0.20, -0.58, 0.32);
gkRightGlove.rotation.x = -0.65;
gkRightArmGroup.add(gkRightGlove);

// Shorts & Pelvis
const gkPelvis = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.34, 0.34), gkShortsMat);
gkPelvis.position.y = 0.88;
gkGroup.add(gkPelvis);

// Professional Molded Cleats (Boots + 3D Studs)
function createProBootGroup() {
    const boot = new THREE.Group();
    // Upper
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.34), bootUpperMat);
    upper.position.set(0, 0.06, 0.04);
    boot.add(upper);
    // Volt speed stripe
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.22), bootVoltMat);
    stripe.position.set(0, 0.06, 0.04);
    boot.add(stripe);
    // 6 Molded Conical Studs
    for (let s = 0; s < 6; s++) {
        const sx = (s % 2 === 0 ? -1 : 1) * 0.05;
        const sz = -0.10 + Math.floor(s / 2) * 0.12;
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.03, 8), studMat);
        stud.position.set(sx, 0.01, sz);
        boot.add(stud);
    }
    return boot;
}

// Legs & Socks
const legGeo = new THREE.CylinderGeometry(0.11, 0.095, 0.74, 14);

const gkLeftLeg = new THREE.Mesh(legGeo, gkSockMat);
gkLeftLeg.position.set(-0.22, 0.46, 0); gkLeftLeg.castShadow = true; gkGroup.add(gkLeftLeg);
const gkLeftBoot = createProBootGroup();
gkLeftBoot.position.set(-0.22, 0.03, 0.05); gkGroup.add(gkLeftBoot);

const gkRightLeg = new THREE.Mesh(legGeo, gkSockMat);
gkRightLeg.position.set(0.22, 0.46, 0); gkRightLeg.castShadow = true; gkGroup.add(gkRightLeg);
const gkRightBoot = createProBootGroup();
gkRightBoot.position.set(0.22, 0.03, 0.05); gkGroup.add(gkRightBoot);

// Cannon Physics Collider for Goalkeeper (Wide athletic coverage box)
const gkBodyCollider = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    shape: new CANNON.Box(new CANNON.Vec3(0.75, 1.15, 0.45)),
    position: new CANNON.Vec3(0, 1.15, -19.6),
    material: postPhysMat
});
gkBodyCollider.collisionResponse = 0;
world.addBody(gkBodyCollider);

// ============================================================================
// 8. DEFENSIVE WALL (3 ATHLETIC CRIMSON AWAY KIT DEFENDERS #4, #5, #6)
// ============================================================================
const wallGroup = new THREE.Group();
wallGroup.position.set(0, 0, -13.5);
const wallBodies = [];

function createWallJerseyTexture(numberStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Rich saturated Crimson red fabric
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 0, 512, 512);

    // Dark Navy Athletic Diagonal Sash
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, 60);
    ctx.lineTo(512, 340);
    ctx.lineTo(512, 430);
    ctx.lineTo(0, 150);
    ctx.closePath();
    ctx.fill();

    // White trim collar
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 24);
    ctx.fillRect(170, 24, 172, 16);

    // Gold Club Crest Badge (Left chest)
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(130, 160, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(130, 160, 16, 0, Math.PI * 2);
    ctx.fill();

    // Sponsor Brand Across Midriff
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.letterSpacing = '3px';
    ctx.fillText('STRIKE', 256, 290);

    // Bold Squad Number on Back/Chest
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 96px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(numberStr, 380, 200);

    return new THREE.CanvasTexture(canvas);
}

function createWallDefenderMesh(numberStr) {
    const defender = new THREE.Group();

    // 1. Pelvis & Shorts (Navy #1e293b with white trim)
    const shortsMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.65 });
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.28), shortsMat);
    pelvis.position.y = 0.88;
    pelvis.castShadow = true;
    defender.add(pelvis);

    // Shorts white side stripes
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const stripeL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.29), stripeMat);
    stripeL.position.set(-0.295, 0.88, 0); defender.add(stripeL);
    const stripeR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.32, 0.29), stripeMat);
    stripeR.position.set(0.295, 0.88, 0); defender.add(stripeR);

    // 2. Muscular Legs & Crimson Socks
    const defenderSockMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
    const legGeo = new THREE.CylinderGeometry(0.10, 0.085, 0.74, 14);

    const leftLeg = new THREE.Mesh(legGeo, defenderSockMat);
    leftLeg.position.set(-0.18, 0.46, 0); leftLeg.castShadow = true; defender.add(leftLeg);
    const leftBoot = createProBootGroup();
    leftBoot.position.set(-0.18, 0.03, 0.05); defender.add(leftBoot);

    const rightLeg = new THREE.Mesh(legGeo, defenderSockMat);
    rightLeg.position.set(0.18, 0.46, 0); rightLeg.castShadow = true; defender.add(rightLeg);
    const rightBoot = createProBootGroup();
    rightBoot.position.set(0.18, 0.03, 0.05); defender.add(rightBoot);

    // 3. Sculpted Torso with Crimson Away Jersey & Squad Number
    const jerseyMat = new THREE.MeshStandardMaterial({
        map: createWallJerseyTexture(numberStr),
        roughness: 0.45,
        metalness: 0.05
    });
    const torsoGeo = new THREE.BoxGeometry(0.68, 0.70, 0.32);
    const torso = new THREE.Mesh(torsoGeo, jerseyMat);
    torso.position.y = 1.34;
    torso.castShadow = true;
    defender.add(torso);

    // 4. Head, Face & Athletic Hair Cut
    const headMat = new THREE.MeshStandardMaterial({
        map: createKeeperFaceTexture(),
        roughness: 0.55
    });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 24), headMat);
    head.position.y = 1.90;
    head.castShadow = true;
    defender.add(head);

    const hairGeo = new THREE.SphereGeometry(0.185, 18, 18);
    const hair = new THREE.Mesh(hairGeo, new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.95 }));
    hair.position.set(0, 1.95, -0.04);
    hair.scale.set(0.95, 0.90, 0.90);
    defender.add(hair);

    // 5. Classic Defensive Wall Stance (Arms locked tight across groin/body protecting torso)
    const armGeo = new THREE.CylinderGeometry(0.07, 0.06, 0.32, 10);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe29d72, roughness: 0.6 });

    const lUpper = new THREE.Mesh(armGeo, jerseyMat);
    lUpper.position.set(-0.32, 1.30, 0.08);
    lUpper.rotation.set(-0.35, 0, 0.45);
    defender.add(lUpper);

    const lFore = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.30, 10), skinMat);
    lFore.position.set(-0.10, 1.12, 0.16);
    lFore.rotation.set(-0.7, 0, -1.2);
    defender.add(lFore);

    const rUpper = new THREE.Mesh(armGeo, jerseyMat);
    rUpper.position.set(0.32, 1.30, 0.08);
    rUpper.rotation.set(-0.35, 0, -0.45);
    defender.add(rUpper);

    const rFore = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.30, 10), skinMat);
    rFore.position.set(0.10, 1.12, 0.16);
    rFore.rotation.set(-0.7, 0, 1.2);
    defender.add(rFore);

    return defender;
}

const wallSquadNumbers = ['4', '5', '6'];
for (let i = 0; i < 3; i++) {
    const w = i - 1; // -1, 0, 1
    const xOffset = w * 0.85;
    const defender = createWallDefenderMesh(wallSquadNumbers[i]);
    defender.position.set(xOffset, 0, 0);
    wallGroup.add(defender);

    const dummyBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(0.38, 0.95, 0.24)),
        position: new CANNON.Vec3(xOffset, 0.95, -13.5),
        material: postPhysMat
    });
    dummyBody.addEventListener('collide', () => {
        if (ballInFlight && !ballBody.scored && !ballBody.saved && !ballBody.blocked) {
            ballBody.blocked = true;
            streak = 0;
            updateHUD();
            sfx.playPost();
            sfx.playGasp();
            finishShot('miss', 'BLOCKED!', 'HIT THE DEFENSIVE WALL', '#ef4444');
        }
    });
    world.addBody(dummyBody);
    wallBodies.push(dummyBody);
}
scene.add(wallGroup);

// ============================================================================
// 9. TARGET RACE TARGETS & SHATTER EFFECTS
// ============================================================================
const targetSlotConfigs = [
    { x: -2.8, y: 1.85, z: -19.9, isMoving: false, radius: 0.44 }, // Top Left Corner
    { x: 2.8, y: 1.85, z: -19.9, isMoving: false, radius: 0.44 },  // Top Right Corner
    { x: 0, y: 1.25, z: -19.9, isMoving: true, radius: 0.52 },     // Center Moving Sweeper
    { x: -2.6, y: 0.45, z: -19.9, isMoving: false, radius: 0.44 }, // Bottom Left Corner
    { x: 2.6, y: 0.45, z: -19.9, isMoving: false, radius: 0.44 }   // Bottom Right Corner
];

function createTargetMeshAndBody(c) {
    const group = new THREE.Group();
    // Bullseye Ring 1 (Gold Inner Core)
    const ring1 = new THREE.Mesh(new THREE.CylinderGeometry(c.radius * 0.35, c.radius * 0.35, 0.04, 32), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 }));
    ring1.rotation.x = Math.PI / 2; group.add(ring1);

    // Bullseye Ring 2 (Cyan Middle Ring)
    const ring2 = new THREE.Mesh(new THREE.CylinderGeometry(c.radius * 0.70, c.radius * 0.70, 0.03, 32), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4 }));
    ring2.rotation.x = Math.PI / 2; ring2.position.z = -0.005; group.add(ring2);

    // Bullseye Ring 3 (Navy Outer Rim)
    const ring3 = new THREE.Mesh(new THREE.CylinderGeometry(c.radius, c.radius, 0.02, 32), new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.5 }));
    ring3.rotation.x = Math.PI / 2; ring3.position.z = -0.01; group.add(ring3);

    group.position.set(c.x, c.y, c.z);
    scene.add(group);

    const body = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        shape: new CANNON.Cylinder(c.radius, c.radius, 0.1, 16),
        position: new CANNON.Vec3(c.x, c.y, c.z),
        material: postPhysMat
    });
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    body.collisionResponse = 0;
    world.addBody(body);

    return { mesh: group, body, config: c, active: true, isMoving: c.isMoving, originX: c.x };
}

function spawnSingleTarget(slotId) {
    const config = targetSlotConfigs[slotId];
    const targetObj = createTargetMeshAndBody(config);
    targetObj.slotId = slotId;
    activeTargets.push(targetObj);
}

function spawnRandomTarget() {
    const activeSlots = activeTargets.map(t => t.slotId);
    const availableSlots = [0, 1, 2, 3, 4].filter(s => !activeSlots.includes(s));
    if (availableSlots.length > 0) {
        const nextSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        spawnSingleTarget(nextSlot);
    }
}

// Particle Glass FX
function createShatterFX(x, y, z, color = 0x38bdf8) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.2 });
    for (let i = 0; i < 35; i++) {
        const p = new THREE.Mesh(geo, mat);
        p.position.set(x, y, z);
        scene.add(p);
        particles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * 12,
            vy: Math.random() * 9 + 2,
            vz: (Math.random() - 0.5) * 12,
            life: 0.9
        });
    }
}

// ============================================================================
// 10. GAMEPLAY FLOW, TELEMETRY, PRACTICE ARENA & MATCH OUTCOMES
// ============================================================================
let shotOutcomeTimer = null;

const practiceSpots = [
    { name: 'Center (19m)', x: 0, z: -9.0 },
    { name: 'Left Angle (21m)', x: -4.5, z: -8.0 },
    { name: 'Right Angle (21m)', x: 4.5, z: -8.0 },
    { name: 'Long Range (27m)', x: 0, z: -3.0 },
    { name: 'Penalty Spot (11m)', x: 0, z: -14.0 }
];

let practiceSettings = {
    targets: true,
    wall: true,
    keeper: true,
    spotIndex: 0
};

window.togglePracticeOption = function(type) {
    if (practiceSettings[type] === undefined) return;
    practiceSettings[type] = !practiceSettings[type];
    
    const btn = document.getElementById(`toggle-${type}-btn`);
    if (btn) {
        if (practiceSettings[type]) {
            btn.classList.add('active');
            btn.innerText = (type === 'targets' ? '🎯 Targets: ON' : (type === 'wall' ? '🛡️ Wall: ON' : '🧤 Keeper: ON'));
        } else {
            btn.classList.remove('active');
            btn.innerText = (type === 'targets' ? '🎯 Targets: OFF' : (type === 'wall' ? '🛡️ Wall: OFF' : '🧤 Keeper: OFF'));
        }
    }

    if (type === 'targets') {
        if (practiceSettings.targets) {
            spawnTargets();
        } else {
            activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
            activeTargets = [];
        }
    } else if (type === 'wall') {
        wallGroup.visible = practiceSettings.wall;
        wallBodies.forEach(b => { b.collisionResponse = practiceSettings.wall ? 1 : 0; });
    } else if (type === 'keeper') {
        gkGroup.visible = practiceSettings.keeper;
    }
};

window.cyclePracticeSpot = function() {
    practiceSettings.spotIndex = (practiceSettings.spotIndex + 1) % practiceSpots.length;
    const spot = practiceSpots[practiceSettings.spotIndex];
    const btn = document.getElementById('practice-spot-btn');
    if (btn) {
        btn.innerText = `📍 Spot: ${spot.name}`;
    }
    resetBall();
};

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

    if (currentGameMode === 'practice') {
        shotOutcomeTimer = setTimeout(() => {
            if (shotComplete && isPlaying && currentGameMode === 'practice') {
                resetBall();
            }
        }, 2200);
        return;
    }

    // Display Prominent Bottom Next Shot Button
    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn && currentGameMode === 'duel') {
        if (currentRound >= maxDuelShots) {
            nextRoundBtn.innerHTML = `<span>VIEW RESULTS</span><span style="font-size: 18px; font-weight: 900;">➔</span>`;
        } else {
            nextRoundBtn.innerHTML = `<span>NEXT SHOT</span><span style="font-size: 18px; font-weight: 900;">➔</span>`;
        }
        nextRoundBtn.style.display = 'flex';
    }
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn && currentGameMode === 'duel') topNextBtn.style.display = 'block';

    // Ample time for user to review score and press NEXT SHOT
    shotOutcomeTimer = setTimeout(() => {
        if (shotComplete && isPlaying) {
            triggerNextShot();
        }
    }, 12000);
}

function spawnTargets() {
    activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
    activeTargets = [];

    if (currentGameMode === 'targets') {
        wallGroup.visible = false;
        wallBodies.forEach(b => { b.collisionResponse = 0; });
        gkGroup.visible = false;
        gkBodyCollider.collisionResponse = 0;
        [0, 1, 2].forEach(slotId => spawnSingleTarget(slotId));
    } else if (currentGameMode === 'practice') {
        wallGroup.visible = practiceSettings.wall;
        wallBodies.forEach(b => { b.collisionResponse = practiceSettings.wall ? 1 : 0; });
        gkGroup.visible = practiceSettings.keeper;
        gkBodyCollider.collisionResponse = 0;
        if (practiceSettings.targets) {
            [0, 1, 2].forEach(slotId => spawnSingleTarget(slotId));
        }
    } else {
        wallGroup.visible = true;
        wallBodies.forEach(b => { b.collisionResponse = 1; });
        gkGroup.visible = true;
        gkBodyCollider.collisionResponse = 0;
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

// Dynamic Goalkeeper & Wall Motion State
let gkDiving = false;
let gkTargetX = 0;
let gkTargetY = 1.15;
let gkTargetRotZ = 0;
let wallJumping = false;
let wallJumpTimer = 0;

// Magnus Aerodynamic Spin & Ball Physics
let spinVector = new THREE.Vector3();
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
    } else if (currentGameMode === 'practice') {
        const spot = practiceSpots[practiceSettings.spotIndex];
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
    ballBody.blocked = false;
    ballBody.inNet = false;
    shotComplete = false;

    // Reset Goalkeeper & Wall Postures
    gkDiving = false;
    wallJumping = false;
    wallJumpTimer = 0;
    wallGroup.position.y = 0;
    wallBodies.forEach(b => { b.position.y = 0.95; });

    if (currentGameMode === 'duel' || currentGameMode === 'practice') {
        const dxToGoal = -spotX;
        const wallSide = dxToGoal >= 0 ? 1 : -1;
        const wallX = spotX * 0.45 + (wallSide * 0.75);
        const wallZ = Math.min(-11.0, spotZ - 5.5);
        wallGroup.position.set(wallX, 0, wallZ);
        wallBodies.forEach((b, idx) => {
            const offset = (idx - 1) * 0.85;
            b.position.set(wallX + offset, 0.95, wallZ);
            b.collisionResponse = (currentGameMode === 'duel' || practiceSettings.wall) ? 1 : 0;
        });

        const gkStartX = -wallSide * 0.95;
        gkGroup.position.set(gkStartX, 0, -19.6);
        gkGroup.rotation.set(0, 0, 0);
        gkSpine.rotation.set(0, 0, 0);
        gkLeftArmGroup.rotation.set(0, 0, 0);
        gkRightArmGroup.rotation.set(0, 0, 0);
        gkBodyCollider.position.set(gkStartX, 1.15, -19.6);
    }

    // Dynamic Camera Framing
    camera.position.set(spotX * 0.65, 1.4, spotZ + 4.2);
    camera.lookAt(0, 0.8, -20);

    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn) nextRoundBtn.style.display = 'none';
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn) topNextBtn.style.display = 'none';

    document.getElementById('banner').classList.remove('show');
    document.getElementById('telemetry').classList.remove('visible');

    isAiming = true;
    sfx.playWhistle();
};

window.selectMode = function(mode) {
    sfx.init();
    sfx.startAmbient();
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

    const practiceToolbar = document.getElementById('practice-toolbar');

    if (mode === 'duel') {
        if (practiceToolbar) practiceToolbar.style.display = 'none';
        currentRound = 1;
        duelResults = [];
        document.getElementById('tracker-label').innerText = 'ROUND';
        document.getElementById('shot-pills').style.display = 'flex';
        document.getElementById('timer-display').style.display = 'none';
        updateDuelPills();
    } else if (mode === 'practice') {
        if (practiceToolbar) practiceToolbar.style.display = 'flex';
        document.getElementById('tracker-label').innerText = 'PRACTICE';
        document.getElementById('shot-pills').style.display = 'none';
        document.getElementById('timer-display').style.display = 'none';
    } else {
        if (practiceToolbar) practiceToolbar.style.display = 'none';
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
    sfx.stopAmbient();
    if (targetRaceTimer) clearInterval(targetRaceTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('results-modal').style.display = 'none';
    const practiceToolbar = document.getElementById('practice-toolbar');
    if (practiceToolbar) practiceToolbar.style.display = 'none';
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

// ============================================================================
// ============================================================================
// 11. DIRECTIONAL SHOOTING ENGINE (3D RAYCAST PROJECTION + MAGNUS CURVE)
// ============================================================================
window.executeShot = function(targetScreenX, targetScreenY, speedKmh = 95, spinRPM = 0, powerNorm = 0.7) {
    if (!isPlaying || !isAiming) return;
    isAiming = false;
    ballInFlight = true;

    // --- 3D World Raycasting to Goal Plane (z = -20.0) ---
    const ndcX = (targetScreenX / window.innerWidth) * 2 - 1;
    const ndcY = -(targetScreenY / window.innerHeight) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

    const goalPlaneZ = -20.0;
    const tPlane = (goalPlaneZ - raycaster.ray.origin.z) / raycaster.ray.direction.z;
    const targetWorldX = raycaster.ray.origin.x + tPlane * raycaster.ray.direction.x;
    const targetWorldY = Math.max(0.2, raycaster.ray.origin.y + tPlane * raycaster.ray.direction.y);

    // Forward velocity: -22 to -36 m/s (~80 to 130 km/h)
    const vz = -Math.max(18, speedKmh / 3.6);
    const distZ = Math.abs(goalPlaneZ - ballBody.position.z);
    const flightTime = distZ / Math.abs(vz);

    // Calculate exact horizontal & vertical velocities to hit aimed world coordinate
    const vx = (targetWorldX - ballBody.position.x) / flightTime;
    const gravityComp = 0.5 * 9.81 * flightTime * flightTime;
    const vy = Math.min(15.5, Math.max(2.5, (targetWorldY - ballBody.position.y + gravityComp) / flightTime));

    ballBody.velocity.set(vx, vy, vz);

    // Curvature Deflection (Magnus Spin)
    const omegaY = (spinRPM * Math.PI * 2) / 60;
    spinVector.set(0, omegaY, 0);

    // Knuckleball & Trajectory Classification
    const isKnuckle = Math.abs(spinRPM) < 80 && Math.abs(vz) > 28;
    let style = 'Direct Strike';
    if (isKnuckle) style = 'Laser Knuckleball';
    else if (spinRPM > 180) style = 'Curling Inswing';
    else if (spinRPM < -180) style = 'Curling Outswing';

    // Telemetry Update
    const actualSpeedKmh = Math.round(Math.abs(vz) * 3.6);
    maxSpeedRecord = Math.max(maxSpeedRecord, actualSpeedKmh);
    maxSpinRecord = Math.max(maxSpinRecord, Math.round(Math.abs(spinRPM)));

    document.getElementById('stat-speed').innerText = actualSpeedKmh + ' KM/H';
    document.getElementById('stat-spin').innerText = Math.round(Math.abs(spinRPM)) + ' RPM';
    document.getElementById('stat-style').innerText = style;
    document.getElementById('telemetry').classList.add('visible');

    sfx.playKick(powerNorm);

    // Trigger AI Goalkeeper Dive & Wall Jump
    if (currentGameMode === 'duel' || currentGameMode === 'practice') {
        const allowWall = currentGameMode === 'duel' || practiceSettings.wall;
        const allowGk = currentGameMode === 'duel' || practiceSettings.keeper;
        if (allowWall) {
            wallJumping = true;
            wallJumpTimer = 0;
        }
        if (allowGk) {
            gkDiving = true;
            const speedRatio = Math.min(1.0, actualSpeedKmh / 115);
            const keeperSkill = 0.80 - speedRatio * 0.22;
            gkTargetX = Math.max(-3.3, Math.min(3.3, targetWorldX * keeperSkill));
            gkTargetY = Math.max(0.65, Math.min(2.2, targetWorldY * 0.90));
            gkTargetRotZ = (gkTargetX > gkGroup.position.x ? -1 : 1) * Math.min(1.15, Math.abs(gkTargetX - gkGroup.position.x) * 0.42);
        }
    }

    // Safety timeout for round resolution
    setTimeout(() => {
        if (ballInFlight && !shotComplete && isPlaying) {
            if (currentGameMode === 'duel' || currentGameMode === 'practice') {
                finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL!' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
            } else {
                finishShot('complete');
                setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 600);
            }
        }
    }, 2900);
};

window.addEventListener('pointerdown', (e) => {
    if (!isPlaying) return;
    if (e.target && e.target.closest && e.target.closest('button, #next-round-btn, #next-shot-btn, #practice-toolbar')) {
        return;
    }
    if (shotComplete) {
        if (currentGameMode === 'practice') {
            resetBall();
        } else {
            triggerNextShot();
        }
        return;
    }
    if (!isAiming) return;
    sfx.init();
    swipeSamples = [{ x: e.clientX, y: e.clientY, time: performance.now() }];
});

window.addEventListener('pointermove', (e) => {
    if (!isPlaying || !isAiming || swipeSamples.length === 0) return;
    swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
});

window.addEventListener('pointerup', (e) => {
    if (!isPlaying || !isAiming || swipeSamples.length === 0) {
        swipeSamples = [];
        return;
    }
    swipeSamples.push({ x: e.clientX, y: e.clientY, time: performance.now() });
    if (swipeSamples.length < 2) {
        swipeSamples = [];
        return;
    }

    const first = swipeSamples[0];
    const last = swipeSamples[swipeSamples.length - 1];
    const totalDx = last.x - first.x;
    const totalDy = last.y - first.y;

    // Minimum upward gesture: at least 15px upward
    if (totalDy < -15) {
        const dt = Math.max(0.04, (last.time - first.time) / 1000);
        const strokeSpeed = Math.hypot(totalDx, totalDy) / dt;

        // Calculate maximum lateral curvature/deflection from chord
        let maxDeflection = 0;
        const chordLen = Math.hypot(totalDx, totalDy);
        if (chordLen > 10) {
            for (let i = 1; i < swipeSamples.length - 1; i++) {
                const s = swipeSamples[i];
                const defl = ((s.x - first.x) * (-totalDy) + (s.y - first.y) * totalDx) / chordLen;
                if (Math.abs(defl) > Math.abs(maxDeflection)) {
                    maxDeflection = defl;
                }
            }
        }

        const powerNorm = Math.min(1.0, Math.max(0.4, strokeSpeed / 1400));
        const speedKmh = Math.round((22 + powerNorm * 14) * 3.6);
        const spinRPM = Math.round((maxDeflection / 40) * 850);

        // Directional Aim Projection:
        let targetScreenX, targetScreenY;
        if (last.y < window.innerHeight * 0.55) {
            targetScreenX = last.x;
            targetScreenY = last.y;
        } else {
            // Lower-screen flick: Project flick ray to goal plane height
            const elevation = Math.min(1.0, Math.max(0.15, strokeSpeed / 1200));
            const targetHorizonY = window.innerHeight * (0.42 - elevation * 0.16);
            const t = (targetHorizonY - first.y) / totalDy;
            targetScreenX = first.x + t * totalDx;
            targetScreenY = targetHorizonY;
        }

        window.executeShot(targetScreenX, targetScreenY, speedKmh, spinRPM, powerNorm);
    }
    swipeSamples = [];
});

// Direct Event Binding for Prominent Next Shot Buttons
const bindNextShotButtons = () => {
    const handleNext = (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        triggerNextShot();
    };
    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn) {
        nextRoundBtn.addEventListener('pointerdown', handleNext);
        nextRoundBtn.addEventListener('click', handleNext);
    }
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn) {
        topNextBtn.addEventListener('pointerdown', handleNext);
        topNextBtn.addEventListener('click', handleNext);
    }
};
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindNextShotButtons);
} else {
    bindNextShotButtons();
}

// ============================================================================
// 12. MAIN RENDER, ANIMATION & ZERO-REBOUND PHYSICS LOOP
// ============================================================================
const clock = new THREE.Clock();

function updateSimulation(dt) {
    const time = clock.getElapsedTime();

    world.step(1 / 60, dt, 3);

    // Camera Flashbulbs Animation
    cameraFlashes.forEach(f => {
        f.timer -= dt;
        if (f.timer <= 0) {
            f.mesh.material.opacity = 0.95;
            f.timer = 1.5 + Math.random() * 3.5;
        } else if (f.mesh.material.opacity > 0) {
            f.mesh.material.opacity = Math.max(0, f.mesh.material.opacity - dt * 4.0);
        }
    });

    // Goalkeeper and Wall Animations in Duel and Practice Modes
    if (currentGameMode === 'duel' || currentGameMode === 'practice') {
        const allowWall = currentGameMode === 'duel' || practiceSettings.wall;
        const allowGk = currentGameMode === 'duel' || practiceSettings.keeper;

        if (allowWall && wallJumping) {
            wallJumpTimer += dt;
            const jumpH = Math.sin(Math.min(1.0, wallJumpTimer * 3.0) * Math.PI) * 0.55;
            wallGroup.position.y = jumpH;
            wallBodies.forEach(b => { b.position.y = 0.95 + jumpH; });
            if (wallJumpTimer > 1.0) wallJumping = false;
        }

        if (allowGk) {
            if (gkDiving) {
                // High-Performance Goalkeeper Diving Extension
                const diveSpeed = 7.5;
                gkGroup.position.x += (gkTargetX - gkGroup.position.x) * diveSpeed * dt;
                gkGroup.position.y += (gkTargetY - gkGroup.position.y) * diveSpeed * dt;
                gkSpine.rotation.z += (gkTargetRotZ - gkSpine.rotation.z) * diveSpeed * dt;

                // Arm extension toward intercept point
                const diveDir = gkTargetX >= gkGroup.position.x ? 1 : -1;
                if (diveDir > 0) {
                    gkRightArmGroup.rotation.z = -1.2;
                    gkLeftArmGroup.rotation.z = -0.5;
                } else {
                    gkLeftArmGroup.rotation.z = 1.2;
                    gkRightArmGroup.rotation.z = 0.5;
                }
                gkBodyCollider.position.copy(gkGroup.position);
                gkBodyCollider.position.y += 1.15;
            } else {
                // Natural Ready Stance Idle Bounce
                const bounce = Math.sin(time * 3.8) * 0.035;
                gkSpine.position.y = bounce;
                gkLeftArmGroup.rotation.z = Math.sin(time * 3.8) * 0.08;
                gkRightArmGroup.rotation.z = -Math.sin(time * 3.8) * 0.08;
            }

            // Check Goalkeeper Save Block
            if (ballInFlight && !ballBody.scored && !ballBody.saved) {
                const distGk = ballMesh.position.distanceTo(gkBodyCollider.position);
                if (distGk < 0.95 && Math.abs(ballMesh.position.z - (-19.6)) < 0.70) {
                    ballBody.saved = true;
                    streak = 0;
                    updateHUD();
                    sfx.playKeeperSave();
                    sfx.playGasp();
                    ballBody.velocity.x *= -0.45;
                    ballBody.velocity.z *= -0.25;
                    ballBody.velocity.y = Math.max(1.8, ballBody.velocity.y + 2.5);
                    finishShot('miss', 'SAVED!', 'DENIED BY THE KEEPER', '#f59e0b');
                }
            }
        }
    }

    // Moving Sweeper Bullseye Oscillation (Target Race Mode)
    if (currentGameMode === 'targets') {
        activeTargets.forEach(t => {
            if (t.isMoving && t.active) {
                const moveX = t.originX + Math.sin(time * 2.2) * 1.6;
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
        ballBody.velocity.x += fx * dt;
    }

    // Target Race & Practice: Bullseye Collision Detection
    const checkTargets = currentGameMode === 'targets' || (currentGameMode === 'practice' && practiceSettings.targets);
    if (checkTargets && ballInFlight) {
        for (let i = 0; i < activeTargets.length; i++) {
            const t = activeTargets[i];
            if (!t.active) continue;
            const dist = ballMesh.position.distanceTo(t.mesh.position);
            if (dist < (t.config.radius + ballRadius * 0.85)) {
                t.active = false;
                targetsShattered++;
                const ringAccuracy = dist / (t.config.radius + ballRadius);
                let pts = 40;
                let bannerTxt = 'NICE HIT!';
                if (ringAccuracy < 0.40) { pts = 150; bannerTxt = 'BULLSEYE!!'; }
                else if (ringAccuracy < 0.70) { pts = 90; bannerTxt = 'GREAT SHOT!'; }

                streak++;
                highestStreak = Math.max(highestStreak, streak);
                const totalPts = pts * Math.min(5, streak);
                score += totalPts;
                updateHUD();

                sfx.playShatter();
                sfx.playCheer();
                createShatterFX(t.mesh.position.x, t.mesh.position.y, t.mesh.position.z);
                showBanner(bannerTxt, `+${totalPts} PTS`, '#38bdf8');

                scene.remove(t.mesh);
                world.removeBody(t.body);
                activeTargets.splice(i, 1);
                spawnRandomTarget();

                ballBody.velocity.z *= 0.2;
                ballBody.velocity.x *= 0.5;
                if (currentGameMode === 'targets') {
                    setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 750);
                } else if (currentGameMode === 'practice') {
                    finishShot('goal', bannerTxt, `+${totalPts} PTS`, '#38bdf8');
                }
                break;
            }
        }
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

    // ========================================================================
    // ZERO-REBOUND GOAL NET ENTRAPMENT & POSITIONAL HARD LOCK
    // ========================================================================
    const entersGoal = (ballBody.position.z <= -19.95 && ballBody.position.z >= -22.5 &&
                       Math.abs(ballBody.position.x) <= 3.70 && ballBody.position.y <= 2.50);

    if (entersGoal || ballBody.inNet) {
        ballBody.inNet = true;

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

        // Heavy Viscous Net Cord Damping (Instant forward and lateral arrest)
        ballBody.velocity.x *= 0.65;
        ballBody.velocity.z *= 0.65;
        ballBody.angularVelocity.scale(0.5, ballBody.angularVelocity);

        // Net downward pocket gravity
        ballBody.velocity.y -= 22.0 * dt;

        // Hard Positional Lock: ZERO FORWARD ESCAPE, ZERO REBOUND
        if (ballBody.velocity.z > 0) {
            ballBody.velocity.z = 0;
        }
        if (ballBody.position.z > -20.25) {
            ballBody.position.z = -20.25;
        }
        if (ballBody.position.z < -21.85) {
            ballBody.position.z = -21.85;
            ballBody.velocity.z = 0;
        }
        ballBody.position.x = Math.max(-3.50, Math.min(3.50, ballBody.position.x));
        if (ballBody.position.y > 2.38) {
            ballBody.position.y = 2.38;
            ballBody.velocity.y = -1.5;
        }

        // Rest on turf inside net pocket
        if (ballBody.position.y <= ballRadius + 0.02) {
            ballBody.position.y = ballRadius;
            ballBody.velocity.set(0, 0, 0);
            ballBody.angularVelocity.set(0, 0, 0);
            ballInFlight = false;
        }
    }

    // Duel & Practice: Check Off-Target Miss (passed goal plane without scoring or save)
    if ((currentGameMode === 'duel' || currentGameMode === 'practice') && ballInFlight && ballBody.position.z < -20.2 && !ballBody.inNet && !ballBody.saved && !ballBody.scored) {
        streak = 0;
        updateHUD();
        sfx.playGasp();
        finishShot('miss', 'OFF TARGET!', 'MISSED THE GOAL', '#ef4444');
    }

    // Realistic Turf Rolling Deceleration
    if (ballBody.position.y <= ballRadius + 0.05) {
        const hSpeed = Math.hypot(ballBody.velocity.x, ballBody.velocity.z);
        if (hSpeed > 0.01) {
            const decel = ballBody.inNet ? 8.5 : 4.5;
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
                if (!shotComplete && (currentGameMode === 'duel' || currentGameMode === 'practice')) {
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

    // Particle FX Update
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
}

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.033);
    updateSimulation(dt);
    renderer.render(scene, camera);
}
animate();

window.stepSimulation = function(seconds) {
    const steps = Math.ceil(seconds / 0.016);
    const dt = seconds / steps;
    for (let i = 0; i < steps; i++) {
        updateSimulation(dt);
    }
    renderer.render(scene, camera);
};

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
