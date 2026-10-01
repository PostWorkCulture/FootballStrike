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
let goalsScored = 0;

// Duel Mode Configuration (5 Free Kick Rounds against GK + Wall)
let currentRound = 1;
const maxDuelShots = 5;
let duelResults = []; // 'goal', 'miss'
let spotX = 0;
let spotZ = -9.0;
const freeKickSpots = [
    { x: 0, z: -9.0, isPenalty: true },     // Round 1: Central Penalty Spot (11m, inside box, NO wall)
    { x: 0, z: -0.5, isPenalty: false },    // Round 2: Central Edge of Box (19.5m, outside box, 3-man wall)
    { x: -4.5, z: 0.5, isPenalty: false },  // Round 3: Left Channel (20.5m, 3-man wall)
    { x: 4.5, z: 0.5, isPenalty: false },   // Round 4: Right Channel (20.5m, 3-man wall)
    { x: -6.5, z: 2.0, isPenalty: false }   // Round 5: Wide Curler Arc (22m, 3-man wall)
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

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 600);
camera.position.set(0, 0.95, -6.5);
camera.lookAt(0, 1.10, -20);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Broadcast-Quality Post-Processing Pipeline
const composer = new THREE.EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

// Fine-Tuned UnrealBloomPass (Broadcast floodlight & specular radiance)
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.32,   // strength — balanced broadcast floodlight radiance without scene fogging
    0.45,   // radius — sharp optical halo around luminaire banks
    0.85    // threshold — highlights only floodlight emitters, metallic specular glints, and digital hoardings
);
composer.addPass(bloomPass);

// Soft Cinematic Broadcast Vignette (Subtle telephoto lens falloff)
const vignettePass = new THREE.ShaderPass(THREE.VignetteShader);
vignettePass.uniforms['offset'].value = 1.08;
vignettePass.uniforms['darkness'].value = 1.10;
composer.addPass(vignettePass);

// Sharp FXAA Anti-Aliasing (Synchronized to true backbuffer resolution)
const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
const curPr = composer._pixelRatio || Math.min(window.devicePixelRatio, 2);
fxaaPass.uniforms['resolution'].value.set(1.0 / (window.innerWidth * curPr), 1.0 / (window.innerHeight * curPr));
composer.addPass(fxaaPass);

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

// Matchday Broadcast Stadium Floodlighting & Character Illumination
const hemiLight = new THREE.HemisphereLight(0xf0f6ff, 0x1e3a1f, 0.72); // 5600K sky daylight tungsten with rich turf bounce
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0x334155, 0.40); // Stadium bowl shadow fill
scene.add(ambientLight);

// Dedicated High-Intensity Goalmouth Key Light (Brightens Goalkeeper Face, Kit & Gloves)
const goalKeyLight = new THREE.DirectionalLight(0xfffbf0, 1.25);
goalKeyLight.position.set(0, 18, -4);
goalKeyLight.target.position.set(0, 1.2, -20);
scene.add(goalKeyLight);
scene.add(goalKeyLight.target);

// 4-Point Stadium Floodlight Mast Arrays (5600K Daylight Tungsten: 0xf1f6ff)
// Cross-pitch lighting vectors producing realistic quad-shadows and specular gleams on aluminum posts & damp pitch
const mastFloodlights = [];
const createMastFloodlight = (x, y, z, tx, ty, tz, castShadow = true, intensity = 1.65) => {
    const spot = new THREE.SpotLight(0xf1f6ff, intensity, 140, Math.PI / 3.4, 0.38, 1.05);
    spot.position.set(x, y, z);
    spot.target.position.set(tx, ty, tz);
    if (castShadow) {
        spot.castShadow = true;
        spot.shadow.mapSize.width = 1024;
        spot.shadow.mapSize.height = 1024;
        spot.shadow.bias = -0.0004;
        spot.shadow.camera.near = 12;
        spot.shadow.camera.far = 135;
    }
    scene.add(spot);
    scene.add(spot.target);
    mastFloodlights.push(spot);
    return spot;
};

// 4 Corner Mast Floodlights:
// NW Mast Array (-38, 33, -44) -> Cross-pitch targeting pitch & goalmouth right channel
const floodlightNW = createMastFloodlight(-38, 33, -44, 2.5, 0.4, -18, true, 1.55);
// NE Mast Array (38, 33, -44) -> Cross-pitch targeting pitch & goalmouth left channel
const floodlightNE = createMastFloodlight(38, 33, -44, -2.5, 0.4, -18, true, 1.55);
// SW Mast Array (-38, 33, 26) -> Cross-pitch forward targeting penalty area and front of posts
const floodlightSW = createMastFloodlight(-38, 33, 26, 2.0, 1.2, -19.5, true, 1.70);
// SE Mast Array (38, 33, 26) -> Cross-pitch forward targeting penalty area and front of posts
const floodlightSE = createMastFloodlight(38, 33, 26, -2.0, 1.2, -19.5, true, 1.70);
window.mastFloodlights = mastFloodlights;

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

// Procedural PBR Texture Loader & Pitch Turf Maps
const pbrTextureLoader = new THREE.TextureLoader();

const turfNormalTex = pbrTextureLoader.load('assets/turf_normal_pbr.png');
turfNormalTex.wrapS = THREE.RepeatWrapping;
turfNormalTex.wrapT = THREE.RepeatWrapping;
turfNormalTex.repeat.set(16, 22);

const turfRoughnessTex = pbrTextureLoader.load('assets/turf_roughness_pbr.png');
turfRoughnessTex.wrapS = THREE.RepeatWrapping;
turfRoughnessTex.wrapT = THREE.RepeatWrapping;
turfRoughnessTex.repeat.set(16, 22);

const pitchGeo = new THREE.PlaneGeometry(80, 110);
const pitchMat = new THREE.MeshStandardMaterial({
    map: generateTurf(),
    normalMap: turfNormalTex,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: turfRoughnessTex,
    roughness: 0.78,
    metalness: 0.04
});
const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
pitchMesh.rotation.x = -Math.PI / 2;
pitchMesh.receiveShadow = true;
scene.add(pitchMesh);
window.pitchMesh = pitchMesh;

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
    
    // Deep stadium seating shadow base
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, 1024, 512);

    const fanColors = [
        '#dc2626', '#b91c1c', '#ef4444', // Home Reds
        '#1d4ed8', '#2563eb', '#38bdf8', // Royal & Sky Blues
        '#fbbf24', '#f59e0b',             // Club Gold/Amber
        '#ffffff', '#f1f5f9', '#94a3b8', // Matchday Whites & Grays
        '#15803d', '#16a34a',             // Emerald Green accents
        '#0f172a'                         // Dark coats/jackets
    ];
    const skinTones = ['#f8d7b8', '#e09d72', '#a56842', '#693e25', '#f3c299', '#dfa87e'];

    // 8 distinct tiered rows of spectators
    const rowH = 64;
    for (let r = 0; r < 8; r++) {
        const rowY = r * rowH;
        // Concrete riser & step nosing
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, rowY, 1024, 12);
        ctx.fillStyle = '#fbbf24'; // Yellow safety edge
        ctx.fillRect(0, rowY + 10, 1024, 2);

        // 16 spectator columns with access stairways at columns 4 & 12
        for (let s = 0; s < 16; s++) {
            if (s === 4 || s === 12) {
                // High-visibility yellow safety stair walkway
                ctx.fillStyle = '#d97706';
                ctx.fillRect(s * 64 + 4, rowY + 12, 56, 50);
                ctx.fillStyle = '#92400e';
                for (let step = 0; step < 4; step++) {
                    ctx.fillRect(s * 64 + 8, rowY + 16 + step * 10, 48, 2);
                }
                continue;
            }

            const colX = s * 64 + 4;
            const kit = fanColors[Math.floor(Math.random() * fanColors.length)];
            const skin = skinTones[Math.floor(Math.random() * skinTones.length)];

            // Fan Torso
            ctx.fillStyle = kit;
            ctx.beginPath();
            ctx.roundRect(colX + 8, rowY + 28, 40, 34, [6, 6, 0, 0]);
            ctx.fill();

            // Head & Face
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.arc(colX + 28, rowY + 21, 10, 0, Math.PI * 2);
            ctx.fill();

            // Hair / Cap
            if (Math.random() > 0.25) {
                ctx.fillStyle = Math.random() > 0.5 ? '#18181b' : kit;
                ctx.beginPath();
                ctx.arc(colX + 28, rowY + 17, 10, Math.PI, Math.PI * 2);
                ctx.fill();
            }

            // Scarf held overhead or cheering club banner
            if (Math.random() > 0.45) {
                ctx.fillStyle = Math.random() > 0.5 ? '#dc2626' : '#2563eb';
                ctx.fillRect(colX + 6, rowY + 33, 44, 7);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(colX + 16, rowY + 34, 24, 5);
            }

            // Cheering club flag on lower rows
            if (r < 3 && Math.random() > 0.68) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(colX + 44, rowY + 8, 2, 26);
                ctx.fillStyle = kit;
                ctx.beginPath();
                ctx.moveTo(colX + 46, rowY + 8);
                ctx.lineTo(colX + 62, rowY + 14);
                ctx.lineTo(colX + 46, rowY + 20);
                ctx.closePath();
                ctx.fill();
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
const seatMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.45 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.7 });
const suiteMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

// North Stand Behind Goal (14 Stepped 3D Tiers with Crowd Density Textures & Seating Rows)
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

    // 3D Stadium Seating Row
    const seatRow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.22, 0.45), seatMat);
    seatRow.position.set(0, tierY + 0.28, tierZ - 0.4);
    stadium.add(seatRow);
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

// Cantilever Structural Steel Girders & Stadium Canopy
const northRoof = new THREE.Mesh(new THREE.BoxGeometry(116, 1.2, 38), roofMat);
northRoof.position.set(0, 26.5, -46);
stadium.add(northRoof);

// South Stand (8 Stepped 3D Tiers with Spectator Crowd Risers)
for (let t = 0; t < 8; t++) {
    const w = 72 + t * 2.8;
    const tierDepth = 2.4;
    const tierH = 1.35;
    const tierZ = 20 + t * 2.2;
    const tierY = 1.1 + t * 1.35;

    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, tierDepth), concreteMat);
    step.position.set(0, tierY, tierZ);
    stadium.add(step);

    const sCrowdMat = new THREE.MeshStandardMaterial({
        map: crowdTex.clone(),
        roughness: 0.7
    });
    sCrowdMat.map.repeat.set(Math.round(w / 3.0), 1);
    sCrowdMat.map.needsUpdate = true;

    const riser = new THREE.Mesh(new THREE.PlaneGeometry(w, tierH), sCrowdMat);
    riser.rotation.y = Math.PI;
    riser.position.set(0, tierY + tierH * 0.5, tierZ - tierDepth * 0.5);
    stadium.add(riser);
}

// Flanking East & West Grandstands (12 Stepped 3D Tiers with Crowd Risers)
for (let t = 0; t < 12; t++) {
    const len = 96 + t * 2.2;
    const tierW = 2.4;
    const tierH = 1.35;
    const tierY = 1.1 + t * 1.35;
    const lx = -36 - t * 2.2;
    const rx = 36 + t * 2.2;

    // West Stand
    const lStep = new THREE.Mesh(new THREE.BoxGeometry(tierW, 0.35, len), concreteMat);
    lStep.position.set(lx, tierY, -8);
    stadium.add(lStep);

    const lCrowdMat = new THREE.MeshStandardMaterial({ map: crowdTex.clone(), roughness: 0.7 });
    lCrowdMat.map.repeat.set(Math.round(len / 3.0), 1);
    lCrowdMat.map.needsUpdate = true;
    const lRiser = new THREE.Mesh(new THREE.PlaneGeometry(len, tierH), lCrowdMat);
    lRiser.rotation.y = Math.PI / 2;
    lRiser.position.set(lx + tierW * 0.5, tierY + tierH * 0.5, -8);
    stadium.add(lRiser);

    // East Stand
    const rStep = new THREE.Mesh(new THREE.BoxGeometry(tierW, 0.35, len), concreteMat);
    rStep.position.set(rx, tierY, -8);
    stadium.add(rStep);

    const rCrowdMat = new THREE.MeshStandardMaterial({ map: crowdTex.clone(), roughness: 0.7 });
    rCrowdMat.map.repeat.set(Math.round(len / 3.0), 1);
    rCrowdMat.map.needsUpdate = true;
    const rRiser = new THREE.Mesh(new THREE.PlaneGeometry(len, tierH), rCrowdMat);
    rRiser.rotation.y = -Math.PI / 2;
    rRiser.position.set(rx - tierW * 0.5, tierY + tierH * 0.5, -8);
    stadium.add(rRiser);
}

// Sideline Team Dugouts / Technical Area Shelters
const dugoutCanopyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.40, roughness: 0.2 });
[-34.8, 34.8].forEach((dx, dIdx) => {
    const dugout = new THREE.Group();
    const shelter = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 9.0, 16, 1, false, 0, Math.PI), dugoutCanopyMat);
    shelter.rotation.z = Math.PI / 2;
    shelter.rotation.y = dIdx === 0 ? Math.PI / 2 : -Math.PI / 2;
    shelter.position.set(0, 1.4, 0);
    dugout.add(shelter);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 8.2), seatMat);
    bench.position.set(dIdx === 0 ? -0.4 : 0.4, 0.35, 0);
    dugout.add(bench);

    dugout.position.set(dx, 0, -8);
    stadium.add(dugout);
});

// 4 High-Intensity Steel Lattice Floodlight Mast Arrays (5600K Daylight Tungsten)
const floodlightLampGeo = new THREE.BoxGeometry(0.72, 0.72, 0.42);
const floodlightLampMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // 5600K high-luminance emitter face
const pylonMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
const pylonBraceMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.80, roughness: 0.30 });
const mastCoronaMat = new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const cornerPylons = [
    { x: -38, z: -44, rotY: Math.PI / 4 },
    { x: 38, z: -44, rotY: -Math.PI / 4 },
    { x: -38, z: 26, rotY: (3 * Math.PI) / 4 },
    { x: 38, z: 26, rotY: (-3 * Math.PI) / 4 }
];

cornerPylons.forEach(pos => {
    // 4 Inward-tapering steel lattice corner columns
    for (let leg = 0; leg < 4; leg++) {
        const lx0 = (leg % 2 === 0 ? -1 : 1) * 1.6;
        const lz0 = (leg < 2 ? -1 : 1) * 1.6;
        const lx1 = (leg % 2 === 0 ? -1 : 1) * 1.0;
        const lz1 = (leg < 2 ? -1 : 1) * 1.0;

        const pylonLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 33, 8), pylonMat);
        pylonLeg.position.set(pos.x + (lx0 + lx1) * 0.5, 16.5, pos.z + (lz0 + lz1) * 0.5);
        stadium.add(pylonLeg);
    }

    // 4 Horizontal cross-brace tiers along the tower height
    for (let b = 1; b <= 4; b++) {
        const bY = b * 7.5;
        const braceW = 3.2 - b * 0.35;
        const braceX = new THREE.Mesh(new THREE.BoxGeometry(braceW, 0.12, 0.12), pylonBraceMat);
        braceX.position.set(pos.x, bY, pos.z);
        stadium.add(braceX);
    }

    // Service Gantry & Maintenance Walkway Platform
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 5.2), concreteMat);
    gantry.position.set(pos.x, 33, pos.z);
    stadium.add(gantry);

    // Gantry Safety Railing
    const railMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    const railing = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.8, 5.1), railMat);
    railing.position.set(pos.x, 33.7, pos.z);
    stadium.add(railing);

    // Angled Floodlight Head Frame (Tilted ~35° down toward pitch)
    const headFrame = new THREE.Group();
    headFrame.position.set(pos.x, 34.2, pos.z);
    headFrame.rotation.y = pos.rotY;
    headFrame.rotation.x = 0.60; // Pitch downward

    // 4 Rows x 5 Columns = 20 Projector Luminaires per mast
    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const lamp = new THREE.Mesh(floodlightLampGeo, floodlightLampMat);
            lamp.position.set(-2.0 + c * 1.0, r * 0.95, 0.25);
            headFrame.add(lamp);
        }
    }

    // Soft Optical Corona Flare Billboard (Triggers UnrealBloomPass broadcast halo)
    const coronaMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mastCoronaMat);
    coronaMesh.position.set(0, 1.5, 0.6);
    headFrame.add(coronaMesh);

    stadium.add(headFrame);
});

// Perimeter Animated Digital LED Hoardings (2048x128 High-Definition Broadcast Graphics)
function generateAdHoardingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, 2048, 128);

    // Scanline matrix grid
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let y = 0; y < 128; y += 4) ctx.fillRect(0, y, 2048, 1);

    const panels = [
        { border: '#38bdf8', tag: 'OFFICIAL TOURNAMENT', main: '⚽ FOOTBALL STRIKE PRO', sub: 'WORLD SHOOTOUT CHAMPIONSHIP • NEXT-GEN BALL DYNAMICS' },
        { border: '#fbbf24', tag: 'BALL TELEMETRY', main: '⚡ HYPERVORTEX SPEED', sub: '120 KM/H RADAR TRACKING • CONTINUOUS AERODYNAMIC SWERVE' },
        { border: '#f87171', tag: 'MATCHDAY BROADCAST', main: '🏆 CONTINENTAL CUP', sub: 'LIVE MATCH ATMOSPHERE • ZERO-REBOUND PRO NETS' },
        { border: '#4ade80', tag: 'EQUIPMENT SPONSOR', main: '🧤 TITAN HYPER-GRIP', sub: '4MM PRO LATEX FOAM • PRECISION PALM DAMPENING' },
        { border: '#818cf8', tag: 'AERODYNAMICS', main: '🔥 APEX KINETICS', sub: 'MAGNUS SPIN COMPUTATION • 480 RPM CURL PRECISION' }
    ];

    const pW = 2048 / panels.length;
    panels.forEach((p, idx) => {
        const px = idx * pW;
        const grad = ctx.createLinearGradient(px, 0, px + pW, 0);
        grad.addColorStop(0, '#0a101f'); grad.addColorStop(0.3, '#101c36'); grad.addColorStop(0.7, '#101c36'); grad.addColorStop(1, '#0a101f');
        ctx.fillStyle = grad;
        ctx.fillRect(px + 4, 6, pW - 8, 116);

        ctx.strokeStyle = p.border;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(px + 6, 8, pW - 12, 112);

        ctx.fillStyle = p.border;
        ctx.fillRect(px + 22, 14, 150, 18);
        ctx.fillStyle = '#050811';
        ctx.font = '900 11px sans-serif';
        ctx.fillText(p.tag, px + 28, 27);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 32px sans-serif';
        ctx.shadowColor = p.border; ctx.shadowBlur = 10;
        ctx.fillText(p.main, px + 22, 70);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#94a3b8';
        ctx.font = '700 14px sans-serif';
        ctx.fillText(p.sub, px + 22, 100);

        ctx.strokeStyle = p.border; ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(px + pW - 32, 38); ctx.lineTo(px + pW - 18, 64); ctx.lineTo(px + pW - 32, 90);
        ctx.stroke();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(3, 1);
    return tex;
}

const adTex = generateAdHoardingTexture();
const adMat = new THREE.MeshStandardMaterial({
    map: adTex,
    emissiveMap: adTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.20
});
const adCasingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });

// North Goal-Line Digital LED Hoarding
const northAdGroup = new THREE.Group();
const northAd = new THREE.Mesh(new THREE.BoxGeometry(72, 1.0, 0.25), adMat);
northAd.position.set(0, 0.52, 0);
northAdGroup.add(northAd);
const northCasing = new THREE.Mesh(new THREE.BoxGeometry(72.4, 1.08, 0.35), adCasingMat);
northCasing.position.set(0, 0.50, -0.05);
northAdGroup.add(northCasing);
northAdGroup.position.set(0, 0, -26.5);
stadium.add(northAdGroup);

// Left & Right Touchline Digital LED Hoardings
[-34, 34].forEach(sideX => {
    const sideAdGroup = new THREE.Group();
    const sideAd = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.0, 84), adMat);
    sideAd.position.set(0, 0.52, 0);
    sideAdGroup.add(sideAd);
    const sideCasing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.08, 84.4), adCasingMat);
    sideCasing.position.set(sideX < 0 ? -0.05 : 0.05, 0.50, 0);
    sideAdGroup.add(sideCasing);
    sideAdGroup.position.set(sideX, 0, -8);
    stadium.add(sideAdGroup);
});

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

// Tubular aluminum goal posts with realistic metallic specularity
const postMat = new THREE.MeshStandardMaterial({
    color: 0xfdfdfd,
    roughness: 0.12,
    metalness: 0.62
});
const stanchionMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.28,
    metalness: 0.82
});
const jointWeldMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.55
});
const groundSocketMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.85
});
const groundAnchorBoltMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.20,
    metalness: 0.90
});
const rubberTurfMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.92,
    metalness: 0.05
});

const postRadius = 0.06, postHeight = 2.44, goalWidth = 7.32, goalDepth = 2.0, ballRadius = 0.22;

// Upright Tubular Aluminum Posts
const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 32), postMat);
leftPost.position.set(-goalWidth / 2, postHeight / 2, 0);
leftPost.castShadow = true;
goalGroup.add(leftPost);

const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 32), postMat);
rightPost.position.set(goalWidth / 2, postHeight / 2, 0);
rightPost.castShadow = true;
goalGroup.add(rightPost);

// Crossbar spanning horizontally
const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius * 2, 32), postMat);
crossbar.rotation.z = Math.PI / 2;
crossbar.position.set(0, postHeight, 0);
crossbar.castShadow = true;
goalGroup.add(crossbar);

// Crossbar Corner Depth Bevels & Elbow Castings:
// Left Corner Elbow Joint
const leftElbow = new THREE.Mesh(new THREE.TorusGeometry(postRadius, postRadius * 0.98, 16, 24, Math.PI / 2), postMat);
leftElbow.rotation.z = Math.PI;
leftElbow.position.set(-goalWidth / 2 + postRadius, postHeight - postRadius, 0);
goalGroup.add(leftElbow);

// Left Corner Weld Sleeves & Depth End Cap
const leftWeldV = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.04, postRadius * 1.04, 0.02, 32), jointWeldMat);
leftWeldV.position.set(-goalWidth / 2, postHeight - postRadius * 1.8, 0);
goalGroup.add(leftWeldV);
const leftWeldH = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.04, postRadius * 1.04, 0.02, 32), jointWeldMat);
leftWeldH.rotation.z = Math.PI / 2;
leftWeldH.position.set(-goalWidth / 2 + postRadius * 1.8, postHeight, 0);
goalGroup.add(leftWeldH);
const leftCornerCap = new THREE.Mesh(new THREE.SphereGeometry(postRadius, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), postMat);
leftCornerCap.position.set(-goalWidth / 2, postHeight, 0);
goalGroup.add(leftCornerCap);

// Right Corner Elbow Joint
const rightElbow = new THREE.Mesh(new THREE.TorusGeometry(postRadius, postRadius * 0.98, 16, 24, Math.PI / 2), postMat);
rightElbow.rotation.z = -Math.PI / 2;
rightElbow.position.set(goalWidth / 2 - postRadius, postHeight - postRadius, 0);
goalGroup.add(rightElbow);

// Right Corner Weld Sleeves & Depth End Cap
const rightWeldV = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.04, postRadius * 1.04, 0.02, 32), jointWeldMat);
rightWeldV.position.set(goalWidth / 2, postHeight - postRadius * 1.8, 0);
goalGroup.add(rightWeldV);
const rightWeldH = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.04, postRadius * 1.04, 0.02, 32), jointWeldMat);
rightWeldH.rotation.z = Math.PI / 2;
rightWeldH.position.set(goalWidth / 2 - postRadius * 1.8, postHeight, 0);
goalGroup.add(rightWeldH);
const rightCornerCap = new THREE.Mesh(new THREE.SphereGeometry(postRadius, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), postMat);
rightCornerCap.position.set(goalWidth / 2, postHeight, 0);
goalGroup.add(rightCornerCap);

// Ground Anchor Pins & Foundation Sockets:
[-goalWidth / 2, goalWidth / 2].forEach(px => {
    // Heavy galvanized ground socket collar embedded into pitch
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.07, 24), groundSocketMat);
    socket.position.set(px, 0.035, 0);
    goalGroup.add(socket);

    // Turf protector rubber gasket flush with grass
    const rubberRim = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.02, 24), rubberTurfMat);
    rubberRim.position.set(px, 0.01, 0);
    goalGroup.add(rubberRim);

    // 4 High-Tensile Steel Ground Anchor Hex Bolts/Pins
    for (let b = 0; b < 4; b++) {
        const ang = (b * Math.PI) / 2 + Math.PI / 4;
        const bx = px + Math.cos(ang) * 0.082;
        const bz = Math.sin(ang) * 0.082;
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.045, 6), groundAnchorBoltMat);
        bolt.position.set(bx, 0.05, bz);
        goalGroup.add(bolt);
    }

    // Ground locking wedge latch pin clamping the upright into socket
    const lockPin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12), groundAnchorBoltMat);
    lockPin.rotation.x = Math.PI / 2;
    lockPin.position.set(px, 0.06, 0);
    goalGroup.add(lockPin);
});

// Turf Net Ground Anchor Peg Pins (Holding bottom net taut into the pitch)
for (let p = -3.2; p <= 3.25; p += 0.8) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 8), groundAnchorBoltMat);
    peg.position.set(p, 0.03, -goalDepth);
    goalGroup.add(peg);
    const pegCap = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), groundAnchorBoltMat);
    pegCap.position.set(p, 0.07, -goalDepth);
    goalGroup.add(pegCap);
}
// Side turf anchor pegs
[-goalWidth / 2, goalWidth / 2].forEach(sx => {
    [-0.5, -1.0, -1.5].forEach(sz => {
        const sidePeg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), groundAnchorBoltMat);
        sidePeg.position.set(sx, 0.03, sz);
        goalGroup.add(sidePeg);
    });
});

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

// FIFA-Grade 3D Hexagonal Spring-Mass Net Cloth Engine
let netClothPhysics = null;
if (window.NetClothPhysics) {
    netClothPhysics = new window.NetClothPhysics({
        scene,
        goalGroup,
        goalWidth,
        postHeight,
        goalDepth,
        ballRadius: 0.22,
        goalZ: -20.0,
        replaceMeshes: [backNet, leftSideNet, rightSideNet, roofNet]
    });
    window.netClothPhysics = netClothPhysics;
}

// Net Spring Vertex State (Fallback)
const netVertexCount = backNetGeo.attributes.position.count;
const netDisplacements = new Float32Array(netVertexCount);
const netVelocities = new Float32Array(netVertexCount);
const netOrigPositions = backNetGeo.attributes.position.array.slice();

function triggerNetBillow(worldHitX, worldHitY) {
    if (netClothPhysics) {
        const vz = (typeof ballBody !== 'undefined' && ballBody) ? ballBody.velocity.z : -20;
        const vx = (typeof ballBody !== 'undefined' && ballBody) ? ballBody.velocity.x : 0;
        const vy = (typeof ballBody !== 'undefined' && ballBody) ? ballBody.velocity.y : 0;
        const hitZ = (typeof ballBody !== 'undefined' && ballBody) ? ballBody.position.z : -21.8;
        netClothPhysics.triggerImpact(worldHitX, worldHitY, hitZ, vx, vy, vz);
        return;
    }
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
    if (netClothPhysics) {
        netClothPhysics.update(dt, (typeof ballBody !== 'undefined' ? ballBody : null), (typeof ballMesh !== 'undefined' ? ballMesh : null));
        return;
    }
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
let shotSafetyTimer = null;

const addCylinderCollider = (x, y, z, r, h, rotZ) => {
    const b = new CANNON.Body({ mass: 0, material: postPhysMat });
    b.addShape(new CANNON.Cylinder(r, r, h, 16));
    b.position.set(x, y, z);
    if (rotZ) b.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), rotZ);
    b.addEventListener('collide', () => {
        if (ballInFlight && !ballBody.scored && !ballBody.saved && !ballBody.blocked) {
            sfx.playPost();
            sfx.playGasp();
            setTimeout(() => {
                if (ballInFlight && !ballBody.scored && !ballBody.saved && !ballBody.blocked) {
                    finishShot('miss', 'WOODWORK', '', '#ef4444');
                }
            }, 600);
        }
    });
    world.addBody(b);
};
addCylinderCollider(-goalWidth / 2, postHeight / 2, -20, postRadius, postHeight);
addCylinderCollider(goalWidth / 2, postHeight / 2, -20, postRadius, postHeight);
addCylinderCollider(0, postHeight, -20, postRadius, goalWidth, Math.PI / 2);

// ============================================================================
// 6. HIGH-POLY 3D MATCH BALL (PBR REGULATION MATCH BALL)
// ============================================================================
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);

const ballNormalTex = pbrTextureLoader.load('assets/ball_normal_pbr.png');
const ballDiffuseTex = pbrTextureLoader.load('assets/ball_texture_pbr.png');

const ballMat = new THREE.MeshStandardMaterial({
    map: ballDiffuseTex,
    normalMap: ballNormalTex,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.28,
    metalness: 0.08
});

const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true;
scene.add(ballMesh);

const ballBody = new CANNON.Body({
    mass: 0.38,
    shape: new CANNON.Sphere(ballRadius),
    material: ballPhysMat,
    linearDamping: 0.008,
    angularDamping: 0.04
});
world.addBody(ballBody);
window.ballBody = ballBody;
window.ballMesh = ballMesh;
window.ballRadius = ballRadius;

// ============================================================================
// 7. HIGH-FIDELITY ATHLETIC 3D GOALKEEPER & DEFENSIVE WALL RIG
// ============================================================================


// ============================================================================
// 8. FIFA-GRADE BIOMECHANICAL 3D SKELETAL ATHLETIC RIGS (12-BONE HIERARCHICAL ARMATURES)
// ============================================================================
const charGltfLoader = new THREE.GLTFLoader();

function createSoftShadowTex() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.85)');
    grad.addColorStop(0.35, 'rgba(2, 6, 23, 0.55)');
    grad.addColorStop(0.70, 'rgba(2, 6, 23, 0.20)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
}
const softShadowTex = createSoftShadowTex();

// Instantiation: Goalkeeper Rig (High-Fidelity 3D Polygonal Mesh)
const gkGroup = new THREE.Group();
const gkSpine = new THREE.Group();
gkGroup.add(gkSpine);

const gkMesh = new THREE.Group();
gkSpine.add(gkMesh);

const glovesNormalTex = pbrTextureLoader.load('assets/gloves_normal_pbr.png');
glovesNormalTex.wrapS = THREE.RepeatWrapping;
glovesNormalTex.wrapT = THREE.RepeatWrapping;
glovesNormalTex.repeat.set(4, 4);

const jerseyNormalTex = pbrTextureLoader.load('assets/jersey_normal_pbr.png');
jerseyNormalTex.wrapS = THREE.RepeatWrapping;
jerseyNormalTex.wrapT = THREE.RepeatWrapping;
jerseyNormalTex.repeat.set(10, 10);

const gkPoseModels = {
    idle: null,
    dive_right: null,
    dive_left: null,
    parry: null,
    low_sweep_right: null,
    low_sweep_left: null,
    recovery_roll: null
};

function setupGkPoseModel(gltf, poseKey) {
    const model = gltf.scene;
    model.scale.set(1.30, 1.30, 1.30);
    model.traverse(node => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
                node.material.normalMap = glovesNormalTex;
                node.material.normalScale = new THREE.Vector2(0.65, 0.65);
                node.material.roughness = 0.32; // German Contact Latex foam palm & grip
                node.material.metalness = 0.04;
                node.material.emissive = new THREE.Color(0x333333);
                node.material.emissiveIntensity = 0.35;
                node.material.needsUpdate = true;
            }
        }
    });
    model.visible = (poseKey === 'idle');
    gkMesh.add(model);
    gkPoseModels[poseKey] = model;
}

charGltfLoader.load('assets/goalkeeper_pro_3d.glb', (gltf) => setupGkPoseModel(gltf, 'idle'));
charGltfLoader.load('assets/goalkeeper_dive_right.glb', (gltf) => setupGkPoseModel(gltf, 'dive_right'));
charGltfLoader.load('assets/goalkeeper_dive_left.glb', (gltf) => setupGkPoseModel(gltf, 'dive_left'));
charGltfLoader.load('assets/goalkeeper_parry.glb', (gltf) => setupGkPoseModel(gltf, 'parry'));
charGltfLoader.load('assets/goalkeeper_low_sweep_right.glb', (gltf) => setupGkPoseModel(gltf, 'low_sweep_right'));
charGltfLoader.load('assets/goalkeeper_low_sweep_left.glb', (gltf) => setupGkPoseModel(gltf, 'low_sweep_left'));
charGltfLoader.load('assets/goalkeeper_recovery_roll.glb', (gltf) => setupGkPoseModel(gltf, 'recovery_roll'));

function setGkPose(poseKey) {
    for (const k in gkPoseModels) {
        if (gkPoseModels[k]) {
            gkPoseModels[k].visible = (k === poseKey);
        }
    }
    if (window.PlayerKinematics) {
        PlayerKinematics.setGkPose(poseKey);
    }
}
window.setGkPose = setGkPose;
window.gkPoseModels = gkPoseModels;

// Ground Contact Shadow under Goalkeeper (Decoupled to Ground Plane)
const gkShadowGeo = new THREE.PlaneGeometry(1.85, 1.10);
gkShadowGeo.rotateX(-Math.PI / 2);
const gkShadowMat = new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.75, depthWrite: false });
const gkShadow = new THREE.Mesh(gkShadowGeo, gkShadowMat);
gkShadow.position.set(0, 0.015, -19.6);
scene.add(gkShadow);

gkGroup.position.set(0, 0, -19.6);
scene.add(gkGroup);

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

// Instantiation: Defensive Wall (Decoupled Individual Jumper Mechanics)
const wallGroup = new THREE.Group();
wallGroup.position.set(0, 0, -13.5);
const wallDefenders = [];
const wallShadows = [];

const wallDefenderConfigs = [
    { id: 0, xOffset: -0.85, scale: 1.22, delay: 0.055, maxH: 0.50, duration: 0.65, lean: -0.14, inwardYaw: 0.09 },
    { id: 1, xOffset: 0.00,  scale: 1.26, delay: 0.000, maxH: 0.64, duration: 0.72, lean: -0.18, inwardYaw: 0.00 },
    { id: 2, xOffset: 0.85,  scale: 1.24, delay: 0.080, maxH: 0.54, duration: 0.68, lean: -0.15, inwardYaw: -0.09 }
];

charGltfLoader.load('assets/wall_defender_pro_3d.glb', (gltf) => {
    const baseModel = gltf.scene;

    wallDefenderConfigs.forEach((cfg) => {
        const defender = baseModel.clone(true);
        defender.scale.set(cfg.scale, cfg.scale, cfg.scale);
        defender.position.set(cfg.xOffset, 0, 0);
        defender.rotation.y = cfg.inwardYaw * 0.2;
        defender.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    node.material = node.material.clone();
                    node.material.normalMap = jerseyNormalTex;
                    node.material.normalScale = new THREE.Vector2(0.75, 0.75);
                    node.material.roughness = 0.44; // Micro-knit polyester weave
                    node.material.metalness = 0.02;
                    node.material.emissive = new THREE.Color(0x222222);
                    node.material.emissiveIntensity = 0.22;
                    node.material.needsUpdate = true;
                }
            }
        });
        wallGroup.add(defender);
        wallDefenders.push(defender);
    });
});

// Ground Contact Shadows for each individual defender
const defShadowGeo = new THREE.PlaneGeometry(1.05, 0.78);
defShadowGeo.rotateX(-Math.PI / 2);

wallDefenderConfigs.forEach((cfg) => {
    const shadowMat = new THREE.MeshBasicMaterial({
        map: softShadowTex,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
    });
    const defShadow = new THREE.Mesh(defShadowGeo, shadowMat);
    defShadow.position.set(cfg.xOffset, 0.015, 0);
    wallGroup.add(defShadow);
    wallShadows.push(defShadow);
});

const wallBodies = [];
for (let i = 0; i < 3; i++) {
    const cfg = wallDefenderConfigs[i];
    const dummyBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(0.38, 0.95, 0.24)),
        position: new CANNON.Vec3(cfg.xOffset, 0.95, -13.5),
        material: postPhysMat
    });
    dummyBody.addEventListener('collide', () => {
        const isPenalty = (currentGameMode === 'duel' && currentRound === 1) || 
                          (currentGameMode === 'practice' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
        const isWallActive = (currentGameMode === 'duel' && !isPenalty) || 
                             (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
        if (!isWallActive) return;

        if (ballInFlight && !ballBody.scored && !ballBody.saved && !ballBody.blocked) {
            ballBody.blocked = true;
            streak = 0;
            updateHUD();
            sfx.playPost();
            sfx.playGasp();
            finishShot('miss', 'BLOCKED', '', '#ef4444');
        }
    });
    world.addBody(dummyBody);
    wallBodies.push(dummyBody);
}
scene.add(wallGroup);

// Window telemetry & test accessors
window.wallGroup = wallGroup;
window.wallDefenders = wallDefenders;
window.wallShadows = wallShadows;
window.wallBodies = wallBodies;
window.wallDefenderConfigs = wallDefenderConfigs;
window.gkGroup = gkGroup;
window.gkShadow = gkShadow;
window.gkSpine = gkSpine;
window.gkMesh = gkMesh;
window.gkBodyCollider = gkBodyCollider;

// ============================================================================
// 8B. HIGH-FIDELITY ATHLETIC 3D STRIKER RIG & KINEMATICS INITIALIZATION
// ============================================================================
const strikerGroup = new THREE.Group();
const strikerShadowGeo = new THREE.PlaneGeometry(1.20, 0.90);
strikerShadowGeo.rotateX(-Math.PI / 2);
const strikerShadowMat = new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.75, depthWrite: false });
const strikerShadow = new THREE.Mesh(strikerShadowGeo, strikerShadowMat);
strikerShadow.position.set(0, 0.015, -7.0);
scene.add(strikerShadow);
strikerGroup.position.set(0, 0, -7.0);
scene.add(strikerGroup);

const strikerPoseModels = {
    idle: null,
    run: null,
    plant: null,
    strike_instep: null,
    strike_laces: null,
    follow_through: null,
    celebrate: null,
    disbelief: null
};

function setupStrikerPoseModel(gltf, poseKey) {
    const model = gltf.scene;
    model.scale.set(1.24, 1.24, 1.24);
    model.traverse(node => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
                node.material.roughness = 0.35;
                node.material.metalness = 0.04;
                node.material.emissive = new THREE.Color(0x222222);
                node.material.emissiveIntensity = 0.25;
            }
        }
    });
    model.visible = (poseKey === 'idle');
    strikerGroup.add(model);
    strikerPoseModels[poseKey] = model;
}

charGltfLoader.load('assets/striker_idle.glb', (gltf) => setupStrikerPoseModel(gltf, 'idle'));
charGltfLoader.load('assets/striker_run.glb', (gltf) => setupStrikerPoseModel(gltf, 'run'));
charGltfLoader.load('assets/striker_plant.glb', (gltf) => setupStrikerPoseModel(gltf, 'plant'));
charGltfLoader.load('assets/striker_strike_instep.glb', (gltf) => setupStrikerPoseModel(gltf, 'strike_instep'));
charGltfLoader.load('assets/striker_strike_laces.glb', (gltf) => setupStrikerPoseModel(gltf, 'strike_laces'));
charGltfLoader.load('assets/striker_follow_through.glb', (gltf) => setupStrikerPoseModel(gltf, 'follow_through'));
charGltfLoader.load('assets/striker_celebrate.glb', (gltf) => setupStrikerPoseModel(gltf, 'celebrate'));
charGltfLoader.load('assets/striker_disbelief.glb', (gltf) => setupStrikerPoseModel(gltf, 'disbelief'));

window.strikerGroup = strikerGroup;
window.strikerShadow = strikerShadow;
window.strikerPoseModels = strikerPoseModels;
window.kickerGroup = strikerGroup; // Backwards-compatible for test suites

if (window.PlayerKinematics) {
    PlayerKinematics.initStriker(strikerGroup, strikerShadow, strikerPoseModels);
    PlayerKinematics.initGoalkeeper(gkGroup, gkSpine, gkMesh, gkShadow, gkBodyCollider, gkPoseModels);
    PlayerKinematics.initWall(wallGroup, wallDefenders, wallShadows, wallBodies, wallDefenderConfigs);
}
// ============================================================================
// ============================================================================
// 9. TARGET RACE TARGETS & SHATTER EFFECTS (Vibrant Red & White Bullseyes)
// ============================================================================
const targetSlotConfigs = [
    { x: -2.85, y: 1.95, z: -19.9, isMoving: false, radius: 0.44 }, // Top Left Corner
    { x: 2.85, y: 1.95, z: -19.9, isMoving: false, radius: 0.44 },  // Top Right Corner
    { x: 0, y: 2.10, z: -19.9, isMoving: true, radius: 0.46 },     // Center Sweeper (Elevated clear of Keeper)
    { x: -2.65, y: 0.50, z: -19.9, isMoving: false, radius: 0.44 }, // Bottom Left Corner
    { x: 2.65, y: 0.50, z: -19.9, isMoving: false, radius: 0.44 }   // Bottom Right Corner
];

function createRedWhiteBullseyeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const cx = 256;
    const cy = 256;
    const maxR = 244;

    // Dark Gunmetal Metallic Outer Rim
    ctx.beginPath();
    ctx.arc(cx, cy, 254, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#475569';
    ctx.stroke();

    // Concentric Red and White Circles
    // Ring 1 (Outermost): Bold Crimson Red (#dc2626)
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();

    // Ring 2: Pure Crisp White (#ffffff)
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Ring 3: Crimson Red (#dc2626)
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();

    // Ring 4: Pure Crisp White (#ffffff)
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Center Bullseye: Vibrant Scarlet Red (#ef4444)
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#facc15';
    ctx.stroke();

    // Clear Point Values printed on rings
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('25', cx, cy - maxR * 0.85);
    ctx.fillText('25', cx, cy + maxR * 0.85);

    ctx.fillStyle = '#dc2626';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('50', cx, cy - maxR * 0.58);
    ctx.fillText('50', cx, cy + maxR * 0.58);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText('100', cx, cy);

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

const redWhiteTargetTex = createRedWhiteBullseyeTexture();

function createTargetMeshAndBody(c) {
    const group = new THREE.Group();

    // Single crisp textured disc target (Zero Z-fighting)
    const discGeo = new THREE.CylinderGeometry(c.radius, c.radius, 0.04, 32);
    const faceMat = new THREE.MeshStandardMaterial({
        map: redWhiteTargetTex,
        roughness: 0.25,
        metalness: 0.05
    });
    const rimMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.40,
        metalness: 0.60
    });
    const disc = new THREE.Mesh(discGeo, [rimMat, faceMat, faceMat]);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    disc.receiveShadow = true;
    group.add(disc);

    // Crossbar Mounting Cables (Suspended firmly from the crossbar)
    const goalCrossbarY = 2.44;
    const hangLen = Math.max(0.12, goalCrossbarY - c.y);
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    const cableGeo = new THREE.CylinderGeometry(0.006, 0.006, hangLen, 8);
    
    const cableL = new THREE.Mesh(cableGeo, cableMat);
    cableL.position.set(-c.radius * 0.55, hangLen * 0.5, 0);
    group.add(cableL);

    const cableR = new THREE.Mesh(cableGeo, cableMat);
    cableR.position.set(c.radius * 0.55, hangLen * 0.5, 0);
    group.add(cableR);

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

// Particle Glass FX (Dynamic Red and White Shards)
function createShatterFX(x, y, z) {
    const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const matRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.2 });
    const matWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    for (let i = 0; i < 40; i++) {
        const mat = (i % 2 === 0) ? matRed : matWhite;
        const p = new THREE.Mesh(geo, mat);
        p.position.set(x, y, z);
        scene.add(p);
        particles.push({
            mesh: p,
            vx: (Math.random() - 0.5) * 14,
            vy: Math.random() * 10 + 2,
            vz: (Math.random() - 0.5) * 14,
            life: 0.95
        });
    }
}

// ============================================================================
// 10. DIFFICULTY SETTINGS, PRACTICE ARENA & GAMEPLAY FLOW
// ============================================================================
let currentDifficulty = 'semipro';
const difficultySettings = {
    amateur: {
        name: 'Amateur',
        gkReactionTime: 0.16,
        gkSkillBase: 0.58,
        gkDiveDurationMult: 1.20,
        wallJumpMaxH: 0.28,
        targetRaceSeconds: 60,
        targetSpeedMult: 1.0
    },
    semipro: {
        name: 'Semi-Pro',
        gkReactionTime: 0.09,
        gkSkillBase: 0.78,
        gkDiveDurationMult: 1.0,
        wallJumpMaxH: 0.48,
        targetRaceSeconds: 45,
        targetSpeedMult: 1.5
    },
    worldclass: {
        name: 'World Class',
        gkReactionTime: 0.04,
        gkSkillBase: 0.94,
        gkDiveDurationMult: 0.85,
        wallJumpMaxH: 0.62,
        targetRaceSeconds: 35,
        targetSpeedMult: 2.2
    }
};

window.setDifficulty = function(diffKey) {
    if (!difficultySettings[diffKey]) return;
    currentDifficulty = diffKey;
    const selectEl = document.getElementById('difficulty-select');
    if (selectEl && selectEl.value !== diffKey) selectEl.value = diffKey;

    const diff = difficultySettings[currentDifficulty];
    wallDefenderConfigs.forEach(cfg => {
        cfg.maxH = diff.wallJumpMaxH * (cfg.id === 1 ? 1.05 : 0.95);
    });
};

let shotOutcomeTimer = null;

const practiceSpots = [
    { name: 'Penalty Spot (11m)', x: 0, z: -9.0, isPenalty: true },
    { name: 'Center Free Kick (19m)', x: 0, z: -0.5, isPenalty: false },
    { name: 'Left Angle (21m)', x: -4.5, z: 1.0, isPenalty: false },
    { name: 'Right Angle (21m)', x: 4.5, z: 1.0, isPenalty: false },
    { name: 'Long Range (26m)', x: 0, z: 6.0, isPenalty: false }
];

let practiceSettings = {
    targets: true,
    wall: true,
    keeper: true,
    spotIndex: 0
};

window.togglePracticeMenu = function() {
    const panel = document.getElementById('practice-menu-panel');
    const arrow = document.getElementById('practice-menu-arrow');
    if (!panel) return;
    const isShown = panel.style.display !== 'none';
    panel.style.display = isShown ? 'none' : 'flex';
    if (arrow) arrow.innerText = isShown ? '▾' : '▴';
};

window.togglePracticeOption = function(type) {
    if (practiceSettings[type] === undefined) return;
    practiceSettings[type] = !practiceSettings[type];
    
    const btn = document.getElementById(`toggle-${type}-btn`);
    if (btn) {
        btn.innerText = practiceSettings[type] ? 'ON' : 'OFF';
        btn.classList.toggle('active', practiceSettings[type]);
    }

    if (type === 'targets') {
        if (practiceSettings.targets) {
            spawnTargets();
        } else {
            activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
            activeTargets = [];
        }
    } else if (type === 'wall') {
        const isPenalty = practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty;
        const allowWall = practiceSettings.wall && !isPenalty;
        wallGroup.visible = allowWall;
        if (allowWall) {
            wallBodies.forEach((b, idx) => {
                const cfg = wallDefenderConfigs[idx];
                b.position.set(wallGroup.position.x + cfg.xOffset, 0.95, wallGroup.position.z);
                b.collisionResponse = 1;
            });
        } else {
            wallBodies.forEach(b => {
                b.position.set(0, -999, 0);
                b.collisionResponse = 0;
            });
        }
    } else if (type === 'keeper') {
        gkGroup.visible = practiceSettings.keeper;
        if (gkShadow) gkShadow.visible = practiceSettings.keeper;
        if (practiceSettings.keeper) {
            gkBodyCollider.position.copy(gkGroup.position);
            gkBodyCollider.position.y += 1.15;
            if (gkShadow) gkShadow.position.set(gkGroup.position.x, 0.015, gkGroup.position.z);
        } else {
            gkBodyCollider.position.set(0, -999, 0);
            if (gkShadow) gkShadow.position.set(0, -999, 0);
        }
    }
};

window.cyclePracticeSpot = function() {
    practiceSettings.spotIndex = (practiceSettings.spotIndex + 1) % practiceSpots.length;
    const spot = practiceSpots[practiceSettings.spotIndex];
    const btn = document.getElementById('practice-spot-btn');
    if (btn) {
        btn.innerText = spot.name.split(' ')[0];
    }
    resetBall();
};

function finishShot(outcome, bannerMain, bannerSub, bannerColor) {
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    if (shotComplete) return;
    shotComplete = true;
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);

    if (bannerMain) {
        showBanner(bannerMain, bannerSub, bannerColor);
    }

    if (outcome === 'goal') {
        bloomPass.strength = 1.0;
        setTimeout(() => { bloomPass.strength = 0.30; }, 800);
    }

    if (window.PlayerKinematics) {
        PlayerKinematics.setStrikerOutcome(outcome === 'goal' ? 'goal' : 'miss');
    }

    if (currentGameMode === 'duel') {
        duelResults[currentRound - 1] = outcome;
        updateDuelPills();
        updateHUD();
    }

    if (currentGameMode === 'practice') {
        shotOutcomeTimer = setTimeout(() => {
            if (shotComplete && isPlaying && currentGameMode === 'practice') {
                resetBall();
            }
        }, 2200);
        return;
    }

    // Display Next Shot Button in Unified Top-Right Unit
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn && currentGameMode === 'duel') {
        if (currentRound >= maxDuelShots) {
            topNextBtn.innerHTML = `<span>RESULTS</span><span style="font-size: 14px;">➔</span>`;
        } else {
            topNextBtn.innerHTML = `<span>NEXT SHOT</span><span style="font-size: 14px;">➔</span>`;
        }
        topNextBtn.style.display = 'inline-flex';
    }

    // Ample time for user to review shot and press NEXT SHOT
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
    if (currentGameMode === 'duel') {
        const goalsCount = duelResults.filter(r => r === 'goal').length;
        document.getElementById('modal-final-score').innerText = `${goalsCount} / ${maxDuelShots} GOALS`;
        document.getElementById('stat-modal-accuracy').innerText = `${Math.round((goalsCount / maxDuelShots) * 100)}%`;
        const streakEl = document.getElementById('stat-modal-streak');
        if (streakEl) streakEl.innerText = `${goalsCount} Scored`;
    } else {
        document.getElementById('modal-final-score').innerText = `${targetsShattered} TARGETS HIT`;
        document.getElementById('stat-modal-accuracy').innerText = `${targetsShattered} Hits`;
        const streakEl = document.getElementById('stat-modal-streak');
        if (streakEl) streakEl.innerText = 'Completed';
    }
    
    document.getElementById('stat-modal-speed').innerText = `${maxSpeedRecord || 85} KM/H`;
    document.getElementById('stat-modal-spin').innerText = `${maxSpinRecord || 0} RPM`;
    
    document.getElementById('results-modal').style.display = 'flex';
};

window.restartCurrentMode = function() {
    document.getElementById('results-modal').style.display = 'none';
    selectMode(currentGameMode);
};

// Dynamic Goalkeeper & Wall Motion State
let gkDiving = false;
let gkDiveTimer = 0;
let gkDiveType = 'mid_parry';
let gkTargetX = 0;
let gkTargetY = 1.15;
let gkTargetRotZ = 0;
let gkStartX = 0;
let gkStartY = 0;
let gkDiveDuration = 0.52;
let gkReactionTime = 0.08;
let wallJumping = false;
let wallJumpTimer = 0;

Object.defineProperty(window, 'gkDiving', { get: () => gkDiving, set: (v) => { gkDiving = v; } });
Object.defineProperty(window, 'gkDiveType', { get: () => gkDiveType, set: (v) => { gkDiveType = v; } });
Object.defineProperty(window, 'wallJumping', { get: () => wallJumping, set: (v) => { wallJumping = v; } });
Object.defineProperty(window, 'wallJumpTimer', { get: () => wallJumpTimer, set: (v) => { wallJumpTimer = v; } });
Object.defineProperty(window, 'currentRound', { get: () => currentRound, set: (v) => { currentRound = v; } });
Object.defineProperty(window, 'ballBody', { get: () => ballBody });
Object.defineProperty(window, 'shotComplete', { get: () => shotComplete });

// Magnus Aerodynamic Spin & Ball Physics
let spinVector = new THREE.Vector3();
let currentShotMagnusAx = 0;
let swipeSamples = [];
let ballInFlight = false;
let slowMo = false;

window.resetBall = function() {
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);
    swipeSamples = [];
    spotX = 0;
    spotZ = -9.0;
    let isPenalty = false;

    if (currentGameMode === 'duel') {
        const spotIdx = (currentRound - 1) % freeKickSpots.length;
        const spot = freeKickSpots[spotIdx];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
    } else if (currentGameMode === 'practice') {
        const spot = practiceSpots[practiceSettings.spotIndex];
        spotX = spot.x;
        spotZ = spot.z;
        isPenalty = !!spot.isPenalty;
    }

    ballBody.position.set(spotX, ballRadius, spotZ);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);

    spinVector.set(0, 0, 0);
    currentShotMagnusAx = 0;
    ballInFlight = false;
    slowMo = false;
    ballBody.scored = false;
    ballBody.saved = false;
    ballBody.blocked = false;
    ballBody.inNet = false;
    shotComplete = false;
    if (netClothPhysics) {
        netClothPhysics.reset();
    }

    // Reset Goalkeeper & Wall Postures
    gkDiving = false;
    gkDiveTimer = 0;
    gkDiveType = 'mid_parry';
    gkStartX = 0;
    gkStartY = 0;
    gkGroup.position.set(0, 0, -19.6);
    gkSpine.position.set(0, 0, 0);
    gkSpine.rotation.set(0, 0, 0);
    gkMesh.rotation.set(0, 0, 0);
    setGkPose('idle');

    wallJumping = false;
    wallJumpTimer = 0;
    wallGroup.position.y = 0;

    wallDefenders.forEach((def, idx) => {
        const cfg = wallDefenderConfigs[idx];
        def.position.set(cfg.xOffset, 0, 0);
        def.rotation.set(0, cfg.inwardYaw * 0.2, 0);
    });
    wallShadows.forEach(s => {
        s.scale.set(1, 1, 1);
        s.material.opacity = 0.75;
    });


    const allowWall = (currentGameMode === 'duel' && !isPenalty) || 
                      (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
    const allowGk = (currentGameMode === 'duel') || 
                    (currentGameMode === 'practice' && practiceSettings.keeper);

    wallGroup.visible = allowWall;
    if (allowWall) {
        const dxToGoal = -spotX;
        const wallSide = dxToGoal >= 0 ? 1 : -1;
        const wallX = spotX * 0.45 + (wallSide * 0.75);
        const wallZ = Math.min(-11.0, spotZ - 9.15);
        wallGroup.position.set(wallX, 0, wallZ);
        wallBodies.forEach((b, idx) => {
            const cfg = wallDefenderConfigs[idx];
            b.position.set(wallX + cfg.xOffset, 0.95, wallZ);
            b.collisionResponse = 1;
        });
    } else {
        wallGroup.position.set(0, -999, 0);
        wallBodies.forEach(b => {
            b.position.set(0, -999, 0);
            b.collisionResponse = 0;
        });
    }

    gkGroup.visible = allowGk;
    if (gkShadow) gkShadow.visible = allowGk;
    if (allowGk) {
        const wallSide = (-spotX >= 0) ? 1 : -1;
        const gkStartX = allowWall ? (-wallSide * 0.95) : 0;
        gkGroup.position.set(gkStartX, 0, -19.6);
        gkGroup.rotation.set(0, 0, 0);
        gkSpine.rotation.set(0, 0, 0);
        gkMesh.rotation.set(0, 0, 0);
        gkBodyCollider.position.set(gkStartX, 1.15, -19.6);
        if (gkShadow) {
            gkShadow.position.set(gkStartX, 0.015, -19.6);
            gkShadow.scale.set(1, 1, 1);
            gkShadow.material.opacity = 0.75;
        }
    } else {
        gkGroup.position.set(0, -999, 0);
        gkBodyCollider.position.set(0, -999, 0);
        if (gkShadow) gkShadow.position.set(0, -999, 0);
    }

    if (window.PlayerKinematics) {
        PlayerKinematics.resetStriker(spotX, spotZ, isPenalty, currentGameMode);
        PlayerKinematics.resetGoalkeeper(spotX, allowGk, allowWall);
        PlayerKinematics.resetWall(spotX, spotZ, allowWall);
    }

    // Dynamic Camera Framing (Hero Sports Broadcast Angle - Elevated TV broadcast perspective)
    camera.position.set(spotX * 0.65, 1.18, spotZ + 2.95);
    camera.lookAt(0, 1.25, -20.0);

    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn) topNextBtn.style.display = 'none';

    const banner = document.getElementById('banner');
    if (banner) {
        banner.classList.remove('show');
    }

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
    goalsScored = 0;
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
    const scoreLbl = document.getElementById('score-label');
    const scoreDisp = document.getElementById('score-display');
    const streakBadge = document.getElementById('streak-badge');
    if (streakBadge) streakBadge.style.display = 'none';

    if (currentGameMode === 'duel') {
        const goalsCount = duelResults.filter(r => r === 'goal').length;
        if (scoreLbl) scoreLbl.innerText = 'GOALS';
        if (scoreDisp) scoreDisp.innerText = `${goalsCount}`;
    } else if (currentGameMode === 'practice') {
        if (scoreLbl) scoreLbl.innerText = 'GOALS';
        if (scoreDisp) scoreDisp.innerText = `${goalsScored}`;
    } else {
        if (scoreLbl) scoreLbl.innerText = 'TARGETS';
        if (scoreDisp) scoreDisp.innerText = `${targetsShattered}`;
    }
}

function showBanner(main, sub = '', color = '#22c55e') {
    const banner = document.getElementById('banner');
    const mainEl = document.getElementById('banner-main');
    const subEl = document.getElementById('banner-sub');
    if (!banner || !mainEl) return;

    mainEl.innerText = main;
    mainEl.style.color = color;
    
    if (subEl) {
        if (sub && sub.trim().length > 0 && !sub.includes('PTS')) {
            subEl.innerText = sub;
            subEl.style.display = 'block';
        } else {
            subEl.innerText = '';
            subEl.style.display = 'none';
        }
    }

    // Position dynamically directly above the goal crossbar
    const goalTopVec = new THREE.Vector3(0, 3.25, -20.0).project(camera);
    const screenX = (goalTopVec.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-goalTopVec.y * 0.5 + 0.5) * window.innerHeight;

    banner.style.left = `${screenX}px`;
    banner.style.top = `${Math.max(65, Math.min(window.innerHeight * 0.38, screenY))}px`;
    banner.classList.add('show');
}

// ============================================================================
// ============================================================================
// 11. INTUITIVE DIRECTIONAL SHOOTING ENGINE & SCREEN BOUNDS PROJECTION
// ============================================================================
window.getGoalScreenProjected = function getGoalScreenProjected() {
    const pCenter = new THREE.Vector3(0, 1.22, -20.0).project(camera);
    const pTopLeft = new THREE.Vector3(-3.66, 2.44, -20.0).project(camera);
    const pTopRight = new THREE.Vector3(3.66, 2.44, -20.0).project(camera);
    const pBottomLeft = new THREE.Vector3(-3.66, 0.0, -20.0).project(camera);
    const pBottomRight = new THREE.Vector3(3.66, 0.0, -20.0).project(camera);

    const toScreen = (v) => ({
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight
    });

    const sCenter = toScreen(pCenter);
    const sTopL = toScreen(pTopLeft);
    const sTopR = toScreen(pTopRight);
    const sBotL = toScreen(pBottomLeft);
    const sBotR = toScreen(pBottomRight);

    return {
        centerX: sCenter.x,
        centerY: sCenter.y,
        crossbarY: (sTopL.y + sTopR.y) * 0.5,
        groundY: (sBotL.y + sBotR.y) * 0.5,
        leftX: sTopL.x,
        rightX: sTopR.x,
        goalWidthPx: Math.abs(sTopR.x - sTopL.x),
        goalHeightPx: Math.abs((sBotL.y + sBotR.y) * 0.5 - (sTopL.y + sTopR.y) * 0.5)
    };
}

window.executeShot = function(targetScreenX, targetScreenY, speedKmh = 95, spinRPM = 0, powerNorm = 0.7, curlBendMeters = 0) {
    if (!isPlaying || !isAiming) return;
    isAiming = false;
    ballInFlight = true;

    const bounds = getGoalScreenProjected();
    const goalPlaneZ = -20.0;

    // Convert screen coordinates to world coordinates on the goal plane
    const normX = (targetScreenX - bounds.centerX) / (bounds.goalWidthPx * 0.5);
    const normY = (bounds.groundY - targetScreenY) / bounds.goalHeightPx;

    const targetWorldX = normX * 3.66;
    const targetWorldY = Math.max(0.25, normY * 2.44);

    // Forward velocity: -24 to -36 m/s (~88 to 130 km/h)
    const vz = -Math.max(24, speedKmh / 3.6);
    const distZ = Math.abs(goalPlaneZ - ballBody.position.z);
    const flightTime = distZ / Math.abs(vz);

    // If curlBendMeters was not passed directly, infer from spinRPM
    if (curlBendMeters === 0 && Math.abs(spinRPM) > 30) {
        curlBendMeters = (spinRPM / 380);
    }

    // Scale curl bend with distance to goal: ~1.2m at penalty spot, up to ~2.6m at 25m free kicks
    const maxCurlForDist = Math.max(1.2, Math.min(2.8, distZ * 0.11));
    if (Math.abs(curlBendMeters) > maxCurlForDist) {
        curlBendMeters = Math.sign(curlBendMeters) * maxCurlForDist;
    }

    // Dynamic lateral Magnus acceleration required to achieve organic aerodynamic curl:
    const ax = flightTime > 0.05 ? (1.5 * curlBendMeters) / (flightTime * flightTime) : 0;
    currentShotMagnusAx = ax;

    // Natural launch velocity with balanced lateral offset: ball leaves boot smoothly and curves visibly into target
    const vx = (targetWorldX - ballBody.position.x - 0.5 * curlBendMeters) / flightTime;

    // Exact gravity compensation for realistic buoyant lift (no drooping)
    const gravityComp = 0.5 * 9.81 * flightTime * flightTime;
    const vy = (targetWorldY - ballBody.position.y + gravityComp) / flightTime;

    ballBody.velocity.set(vx, vy, vz);

    // Curvature Deflection (Magnus Spin)
    const omegaY = (spinRPM * Math.PI * 2) / 60;
    spinVector.set(0, omegaY, 0);

    // Knuckleball & Trajectory Classification
    const isKnuckle = Math.abs(spinRPM) < 80 && Math.abs(vz) > 28;
    let style = 'Direct Strike';
    if (isKnuckle) style = 'Laser Knuckleball';
    else if (spinRPM > 120) style = 'Curling Inswing';
    else if (spinRPM < -120) style = 'Curling Outswing';

    // Telemetry Update
    const actualSpeedKmh = Math.round(Math.abs(vz) * 3.6);
    maxSpeedRecord = Math.max(maxSpeedRecord, actualSpeedKmh);
    maxSpinRecord = Math.max(maxSpinRecord, Math.round(Math.abs(spinRPM)));

    document.getElementById('stat-speed').innerText = actualSpeedKmh + ' KM/H';
    document.getElementById('stat-spin').innerText = Math.round(Math.abs(spinRPM)) + ' RPM';
    document.getElementById('stat-style').innerText = style;
    document.getElementById('telemetry').classList.add('visible');

    sfx.playKick(powerNorm);

    // Camera screen shake on powerful shots (FIFA-style impact)
    if (powerNorm > 0.75) {
        const shakeIntensity = (powerNorm - 0.75) * 0.08;
        const origX = camera.position.x;
        const origY = camera.position.y;
        let shakeTime = 0;
        const shakeInterval = setInterval(() => {
            shakeTime += 16;
            if (shakeTime > 200) {
                camera.position.x = origX;
                camera.position.y = origY;
                clearInterval(shakeInterval);
                return;
            }
            camera.position.x = origX + (Math.random() - 0.5) * shakeIntensity;
            camera.position.y = origY + (Math.random() - 0.5) * shakeIntensity;
        }, 16);
    }

    // Trigger Striker Run-Up, AI Goalkeeper Dive & Wall Jump via PlayerKinematics
    const isPenalty = (currentGameMode === 'duel' && currentRound === 1) || 
                      (currentGameMode === 'practice' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
    const allowWall = (currentGameMode === 'duel' && !isPenalty) || 
                      (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
    const allowGk = (currentGameMode === 'duel') || 
                    (currentGameMode === 'practice' && practiceSettings.keeper);

    const diff = (typeof difficultySettings !== 'undefined' && difficultySettings[currentDifficulty]) 
        ? difficultySettings[currentDifficulty] 
        : { gkReactionTime: 0.09, gkSkillBase: 0.78, gkDiveDurationMult: 1.0 };

    if (window.PlayerKinematics) {
        PlayerKinematics.startStrikerRunUp(actualSpeedKmh, spinRPM, powerNorm, curlBendMeters);
        if (allowGk) {
            PlayerKinematics.startGoalkeeperDive(targetWorldX, targetWorldY, actualSpeedKmh, flightTime, diff);
            gkDiving = true;
            gkDiveTimer = 0;
            gkStartX = gkGroup.position.x;
            gkStartY = gkGroup.position.y;
            gkDiveDuration = PlayerKinematics.gkState.diveDuration;
            gkReactionTime = PlayerKinematics.gkState.reactionTime;
            gkTargetX = PlayerKinematics.gkState.targetX;
            gkTargetY = PlayerKinematics.gkState.targetY;
            gkTargetRotZ = PlayerKinematics.gkState.targetRotZ;
            gkDiveType = PlayerKinematics.gkState.diveType;
        }
        if (allowWall) {
            PlayerKinematics.startWallJump();
            wallJumping = true;
            wallJumpTimer = 0;
        }
    } else {
        if (allowWall) {
            wallJumping = true;
            wallJumpTimer = 0;
        }
        if (allowGk) {
            gkDiving = true;
            gkDiveTimer = 0;
            gkStartX = gkGroup.position.x;
            gkStartY = gkGroup.position.y;
            gkDiveDuration = Math.min(0.68, Math.max(0.42, flightTime * 0.90)) * (diff.gkDiveDurationMult || 1.0);
            gkReactionTime = diff.gkReactionTime || 0.09;
            const speedRatio = Math.min(1.0, actualSpeedKmh / 115);
            const keeperSkill = Math.max(0.40, (diff.gkSkillBase || 0.78) - speedRatio * 0.18);
            gkTargetX = Math.max(-3.3, Math.min(3.3, targetWorldX * keeperSkill));
            const diveDir = (gkTargetX >= gkGroup.position.x) ? 1 : -1;

            if (targetWorldY < 0.95 && Math.abs(gkTargetX) > 1.2) {
                gkDiveType = 'low_sweep';
                gkTargetY = 0.28;
                gkTargetRotZ = diveDir > 0 ? -1.42 : 1.42;
                setGkPose(diveDir > 0 ? 'low_sweep_right' : 'low_sweep_left');
            } else if (targetWorldY > 1.65 && Math.abs(gkTargetX) > 1.1) {
                gkDiveType = 'top_corner_flight';
                gkTargetY = Math.min(2.35, targetWorldY * 0.96);
                gkTargetRotZ = diveDir > 0 ? -0.92 : 0.92;
                setGkPose(diveDir > 0 ? 'dive_right' : 'dive_left');
            } else {
                gkDiveType = 'mid_parry';
                gkTargetY = Math.max(0.85, Math.min(1.85, targetWorldY * 0.90));
                gkTargetRotZ = diveDir > 0 ? -0.65 : 0.65;
                if (Math.abs(gkTargetX) > 0.8) {
                    setGkPose(diveDir > 0 ? 'dive_right' : 'dive_left');
                } else {
                    setGkPose('parry');
                }
            }
        }
    }

    // Safety timeout for round resolution
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    shotSafetyTimer = setTimeout(() => {
        if (ballInFlight && !shotComplete && isPlaying) {
            if (currentGameMode === 'duel' || currentGameMode === 'practice') {
                finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
            } else {
                finishShot('complete');
                setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 600);
            }
        }
    }, 8000);
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

        // Snappy, buoyant power response (lighter ball feel)
        const powerNorm = Math.min(1.0, Math.max(0.48, strokeSpeed / 950));
        const speedKmh = Math.round(88 + powerNorm * 40); // 88 to 128 km/h

        // Natural Aerodynamic Curl Calculation:
        // Bowing right (positive deflection) curves right (+X bend, Inswing)
        // Bowing left (negative deflection) curves left (-X bend, Outswing)
        let curlBendMeters = 0;
        let spinRPM = 0;
        const clampedDefl = Math.max(-120, Math.min(120, maxDeflection));

        if (Math.abs(clampedDefl) > 10) {
            const sign = clampedDefl > 0 ? 1 : -1;
            const normDefl = (Math.abs(clampedDefl) - 10) / 65.0;
            const bendMag = Math.min(2.8, normDefl * 1.85 + Math.pow(normDefl, 1.35) * 0.55);
            // Sign directly matches swipe arc direction: positive curves right (+X), negative curves left (-X)
            curlBendMeters = sign * bendMag;
            spinRPM = Math.round(curlBendMeters * 420); // -1100 to +1100 RPM
        }

        const bounds = getGoalScreenProjected();
        let targetScreenX, targetScreenY;

        if (last.y <= bounds.groundY + 30) {
            // Full swipe directly onto or above the goal
            targetScreenX = last.x;
            targetScreenY = last.y;
        } else {
            // Quick upward flick: project ray to goal height with buoyant lift
            const elevationNorm = Math.min(1.18, Math.max(0.26, strokeSpeed / 900));
            targetScreenY = bounds.groundY - elevationNorm * bounds.goalHeightPx;
            const t = (targetScreenY - first.y) / totalDy;
            targetScreenX = first.x + t * totalDx;
        }

        window.executeShot(targetScreenX, targetScreenY, speedKmh, spinRPM, powerNorm, curlBendMeters);
    }
    swipeSamples = [];
});

// Direct Event Binding for Prominent Next Shot Buttons
const bindNextShotButtons = () => {
    let lastHandledTime = 0;
    const handleNext = (e) => {
        const now = performance.now();
        if (now - lastHandledTime < 500) return;
        lastHandledTime = now;
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        triggerNextShot();
    };
    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn) {
        nextRoundBtn.onclick = handleNext;
    }
    const topNextBtn = document.getElementById('next-shot-btn');
    if (topNextBtn) {
        topNextBtn.onclick = handleNext;
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

    // Subtle animated perimeter sponsor LED hoardings
    if (adTex) {
        adTex.offset.x = (adTex.offset.x + dt * 0.035) % 1.0;
    }

    // FIFA-Grade Player Kinematics (Striker Curved Approach, Wall Defending & Goalkeeper Parabolic Leap)
    if (window.PlayerKinematics) {
        PlayerKinematics.updateStriker(dt, time);
    }

    if (currentGameMode === 'duel' || currentGameMode === 'practice') {
        const isPenalty = (currentGameMode === 'duel' && currentRound === 1) || 
                          (currentGameMode === 'practice' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
        const allowWall = (currentGameMode === 'duel' && !isPenalty) || 
                          (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
        const allowGk = (currentGameMode === 'duel') || 
                        (currentGameMode === 'practice' && practiceSettings.keeper);

        if (window.PlayerKinematics) {
            if (allowWall) {
                PlayerKinematics.updateWall(dt, time, allowWall);
            }
            if (allowGk) {
                PlayerKinematics.updateGoalkeeper(dt, time, ballMesh, ballInFlight);
            }
        }

            // Check Goalkeeper Save Block
            if (ballInFlight && !ballBody.scored && !ballBody.saved) {
                const distGk = ballMesh.position.distanceTo(gkBodyCollider.position);
                if (distGk < 1.25 && Math.abs(ballMesh.position.z - (-19.6)) < 0.85) {
                    ballBody.saved = true;
                    streak = 0;
                    updateHUD();
                    sfx.playKeeperSave();
                    sfx.playGasp();

                    const diveDir = (gkTargetX >= gkGroup.position.x) ? 1 : -1;
                    ballBody.velocity.x = diveDir * (Math.abs(ballBody.velocity.x) + 4.2);
                    ballBody.velocity.y = Math.max(3.2, ballBody.velocity.y * -0.4 + 2.8);
                    ballBody.velocity.z = Math.abs(ballBody.velocity.z) * 0.18;
                    ballBody.angularVelocity.set(diveDir * 10, 5, 2);

                    finishShot('miss', 'SAVED', '', '#f59e0b');
                }
            }
        }

    // Moving Sweeper Bullseye Oscillation (Target Race Mode)
    if (currentGameMode === 'targets') {
        const diff = (typeof difficultySettings !== 'undefined' && difficultySettings[currentDifficulty]) 
            ? difficultySettings[currentDifficulty] 
            : { targetSpeedMult: 1.0 };
        const sweepSpeed = 2.2 * diff.targetSpeedMult;
        activeTargets.forEach(t => {
            if (t.isMoving && t.active) {
                const moveX = t.originX + Math.sin(time * sweepSpeed) * 1.6;
                t.mesh.position.x = moveX;
                t.body.position.x = moveX;
            }
        });
    }

    // Dynamic Net Deform & Spring Relaxation
    updateNetDeformation(dt);

    // Continuous 3D Magnus Aerodynamic Forces & Visual Vortex Trail
    if (ballInFlight && ballBody.position.z > -20.0 && !ballBody.inNet && !ballBody.saved) {
        ballBody.velocity.x += currentShotMagnusAx * dt;
        
        // High-speed visual aerodynamic ball spin (pentagons & hexagons whirl with spin)
        ballMesh.rotation.y += spinVector.y * dt;
        ballMesh.rotation.x += (ballBody.velocity.z / ballRadius) * dt * 0.45;

        // Subtle curved aerodynamic vapor trail particles highlighting the swerve
        if (Math.abs(currentShotMagnusAx) > 3.0 && Math.random() < 0.45) {
            const pGeo = new THREE.SphereGeometry(0.04, 6, 6);
            const pMat = new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.55 });
            const pMesh = new THREE.Mesh(pGeo, pMat);
            pMesh.position.copy(ballMesh.position);
            scene.add(pMesh);
            particles.push({
                mesh: pMesh,
                life: 0.28,
                vx: -Math.sign(currentShotMagnusAx) * 0.5 + (Math.random() - 0.5) * 0.2,
                vy: (Math.random() - 0.5) * 0.2,
                vz: 0.3
            });
        }
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
                const ringAccuracy = dist / (t.config.radius + ballRadius);
                let bannerTxt = 'OUTER RING! +25';
                let pts = 25;
                let bannerCol = '#ffffff';
                if (ringAccuracy < 0.35) {
                    bannerTxt = 'BULLSEYE! +100';
                    pts = 100;
                    bannerCol = '#dc2626';
                } else if (ringAccuracy < 0.68) {
                    bannerTxt = 'INNER RING! +50';
                    pts = 50;
                    bannerCol = '#fbbf24';
                }

                targetsShattered++;
                score += pts;
                updateHUD();

                sfx.playShatter();
                sfx.playCheer();
                createShatterFX(t.mesh.position.x, t.mesh.position.y, t.mesh.position.z);
                showBanner(bannerTxt, pts === 100 ? 'PINPOINT STRIKE' : '', bannerCol);

                scene.remove(t.mesh);
                world.removeBody(t.body);
                activeTargets.splice(i, 1);
                spawnRandomTarget();

                ballBody.velocity.z *= 0.2;
                ballBody.velocity.x *= 0.5;
                if (currentGameMode === 'targets') {
                    setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 750);
                } else if (currentGameMode === 'practice') {
                    ballBody.scored = true;
                    finishShot('goal', bannerTxt, '', '#38bdf8');
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
            goalsScored++;
            updateHUD();
            sfx.playNet();
            sfx.playCheer();
            slowMo = true;
            setTimeout(() => { slowMo = false; }, 600);
            triggerNetBillow(ballBody.position.x, ballBody.position.y);
            finishShot('goal', 'GOAL', '', '#22c55e');
        }

        if (netClothPhysics) {
            netClothPhysics.handleEntrapment(dt, ballBody);
            if (netClothPhysics.restingOnTurf || ballBody.position.y <= ballRadius + 0.02) {
                if (Math.hypot(ballBody.velocity.x, ballBody.velocity.z) < 0.05) {
                    ballInFlight = false;
                }
            }
        } else {
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
    }

    // Duel & Practice: Check Off-Target Miss (passed goal plane without scoring or save)
    if ((currentGameMode === 'duel' || currentGameMode === 'practice') && ballInFlight && !ballBody.inNet && !ballBody.saved && !ballBody.scored) {
        if (ballBody.position.z < -20.05 || (ballBody.position.z < -13.0 && ballBody.velocity.length() < 0.25 && ballBody.position.y <= ballRadius + 0.05)) {
            streak = 0;
            updateHUD();
            sfx.playGasp();
            finishShot('miss', 'OFF TARGET', '', '#ef4444');
        }
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
                    finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
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

    // Subtle broadcast camera track: pan gently toward ball during flight
    if (ballInFlight && !slowMo) {
        const camLerpRate = dt * 1.2;
        const targetLookY = 1.10 + (ballMesh.position.y - 1.10) * 0.25;
        const targetLookX = ballMesh.position.x * 0.15;
        camera.lookAt(
            camera.position.x * 0.05 + targetLookX * (1 - 0.05),
            targetLookY,
            -20.0
        );
    }

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
    composer.render();
}
animate();

window.stepSimulation = function(seconds) {
    const steps = Math.ceil(seconds / 0.016);
    const dt = seconds / steps;
    for (let i = 0; i < steps; i++) {
        updateSimulation(dt);
    }
    composer.render();
};

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    const pr = composer._pixelRatio || Math.min(window.devicePixelRatio, 2);
    fxaaPass.uniforms['resolution'].value.set(1.0 / (window.innerWidth * pr), 1.0 / (window.innerHeight * pr));
});
