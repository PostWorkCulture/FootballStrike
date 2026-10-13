// ============================================================================
// 6. HIGH-POLY 3D MATCH BALL, TACTICAL SPOT RING & AERODYNAMIC RIBBON TRAIL
// ============================================================================
const BALL_RADIUS = (typeof ballRadius !== 'undefined') ? ballRadius : 0.22;
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);

const ballNormalTex = pbrTextureLoader.load('assets/ball_normal_pbr.png');
const ballDiffuseRaw = pbrTextureLoader.load('assets/ball_texture_pbr.png');

function createDimpleBumpMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 512, 256);

    // Micro-textured aerodynamic golf-dimple / grip pattern across match ball panels
    const step = 8;
    for (let y = 4; y < 256; y += step) {
        const rowShift = ((y / step) % 2) * (step * 0.5);
        for (let x = 4; x < 512; x += step) {
            const cx = (x + rowShift) % 512;
            const grad = ctx.createRadialGradient(cx, y, 0.5, cx, y, 2.8);
            grad.addColorStop(0, '#383838');
            grad.addColorStop(0.7, '#686868');
            grad.addColorStop(1, '#808080');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, y, 2.8, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    const bumpTex = new THREE.CanvasTexture(canvas);
    bumpTex.wrapS = THREE.RepeatWrapping;
    bumpTex.wrapT = THREE.RepeatWrapping;
    bumpTex.repeat.set(3, 3);
    return bumpTex;
}

function createProMatchBallTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Crisp pearl white leather base (slightly off-white to avoid bloom washout)
    ctx.fillStyle = '#e8edf5';
    ctx.fillRect(0, 0, 1024, 512);

    // Classic high-contrast pentagon / star championship panels so spin is visibly readable
    const centers = [
        [128, 128], [384, 128], [640, 128], [896, 128],
        [256, 256], [512, 256], [768, 256], [0, 256], [1024, 256],
        [128, 384], [384, 384], [640, 384], [896, 384]
    ];

    // Interconnecting aerodynamic seam lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 5;
    for (let i = 0; i < centers.length; i++) {
        for (let j = i + 1; j < centers.length; j++) {
            const dx = centers[i][0] - centers[j][0];
            const dy = centers[i][1] - centers[j][1];
            const d = Math.hypot(dx, dy);
            if (d < 290) {
                ctx.beginPath();
                ctx.moveTo(centers[i][0], centers[i][1]);
                ctx.lineTo(centers[j][0], centers[j][1]);
                ctx.stroke();
            }
        }
    }

    // Gold & Cyan speed-swoosh accents around seams
    centers.forEach(([cx, cy], idx) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate((idx * 0.65));

        // Outer metallic gold/cyan trim ring
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
            const a = (k * Math.PI * 2) / 5 - Math.PI / 2;
            const r = 56;
            if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = idx % 2 === 0 ? '#0284c7' : '#d97706';
        ctx.fill();

        // Inner dark anthracite pentagon
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
            const a = (k * Math.PI * 2) / 5 - Math.PI / 2;
            const r = 44;
            if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fillStyle = '#0f172a';
        ctx.fill();
        ctx.restore();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    return tex;
}

const ballBumpTex = createDimpleBumpMap();
const ballMat = new THREE.MeshStandardMaterial({
    map: createProMatchBallTexture(),
    normalMap: ballNormalTex,
    normalScale: new THREE.Vector2(0.95, 0.95),
    bumpMap: ballBumpTex,
    bumpScale: 0.008,
    roughness: 0.30,
    metalness: 0.08
});
window.ballMat = ballMat;

// Load Nano Banana 2K match ball texture onto ballMat while keeping procedural canvas as instant fallback
pbrTextureLoader.load('assets/textures/match_ball_2k.jpg', (loadedTex) => {
    loadedTex.anisotropy = 8;
    if (THREE.SRGBColorSpace) {
        loadedTex.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
        loadedTex.encoding = THREE.sRGBEncoding;
    }
    loadedTex.needsUpdate = true;
    ballMat.map = loadedTex;
    ballMat.needsUpdate = true;
});

const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.position.set(0, BALL_RADIUS, -9.0);
ballMesh.castShadow = true;
const ball = ballMesh;
window.ball = ball;
scene.add(ballMesh);

// Ground Contact Shadow & Tactical Aim Ring beneath Ball
const ballShadowGeo = new THREE.PlaneGeometry(0.68, 0.68);
ballShadowGeo.rotateX(-Math.PI / 2);
function createBallShadowTex() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 6, 64, 64, 60);
    r.addColorStop(0, 'rgba(2, 6, 23, 0.88)');
    r.addColorStop(0.55, 'rgba(2, 6, 23, 0.38)');
    r.addColorStop(1, 'rgba(2, 6, 23, 0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
}
const ballGroundShadow = new THREE.Mesh(
    ballShadowGeo,
    new THREE.MeshBasicMaterial({ map: createBallShadowTex(), transparent: true, opacity: 0.85, depthWrite: false })
);
ballGroundShadow.position.set(0, 0.005, -9.0);
scene.add(ballGroundShadow);

// Glowing Spot Halo Ring (Football Strike / FIFA style)
const spotRingGeo = new THREE.RingGeometry(0.27, 0.36, 32);
spotRingGeo.rotateX(-Math.PI / 2);
const spotRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false
});
const ballSpotRing = new THREE.Mesh(spotRingGeo, spotRingMat);
ballSpotRing.position.set(0, 0.018, -9.0);
scene.add(ballSpotRing);

// Zero-Allocation 3D Aerodynamic Flight Ribbon Trail (20 history samples = 40 vertices)
const TRAIL_SAMPLES = 20;
const trailPositions = new Float32Array(TRAIL_SAMPLES * 2 * 3);
const trailAlphas = new Float32Array(TRAIL_SAMPLES * 2);
const trailIndices = [];
for (let i = 0; i < TRAIL_SAMPLES - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    trailIndices.push(a, b, c, b, d, c);
}
const trailGeo = new THREE.BufferGeometry();
trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
trailGeo.setIndex(trailIndices);
const trailMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
window.ballRibbonMat = trailMat;
const ballRibbonMesh = new THREE.Mesh(trailGeo, trailMat);
ballRibbonMesh.frustumCulled = false;
ballRibbonMesh.visible = false;
scene.add(ballRibbonMesh);

const trailHistoryX = new Float32Array(TRAIL_SAMPLES);
const trailHistoryY = new Float32Array(TRAIL_SAMPLES);
const trailHistoryZ = new Float32Array(TRAIL_SAMPLES);
let trailCount = 0;

window.resetBallRibbon = function(x, y, z, colorHex) {
    const bx = (typeof x === 'number') ? x : (ballMesh ? ballMesh.position.x : 0);
    const by = (typeof y === 'number') ? y : (ballMesh ? ballMesh.position.y : 0.22);
    const bz = (typeof z === 'number') ? z : (ballMesh ? ballMesh.position.z : -9.0);
    trailCount = 0;
    for (let i = 0; i < TRAIL_SAMPLES; i++) {
        trailHistoryX[i] = bx;
        trailHistoryY[i] = by;
        trailHistoryZ[i] = bz;
    }
    if (colorHex !== undefined) trailMat.color.setHex(colorHex);
    ballRibbonMesh.visible = false;
};

window.updateBallRibbon = function(posOrX, activeOrY, zArg, activeArg) {
    let x, y, z, active;
    if (posOrX && typeof posOrX === 'object') {
        x = posOrX.x;
        y = posOrX.y;
        z = posOrX.z;
        active = (activeOrY !== undefined) ? activeOrY : true;
    } else {
        x = posOrX;
        y = activeOrY;
        z = zArg;
        active = activeArg;
    }
    if (!active || isNaN(x) || isNaN(y) || isNaN(z)) {
        ballRibbonMesh.visible = false;
        return;
    }
    if (trailCount === 0) {
        for (let i = 0; i < TRAIL_SAMPLES; i++) {
            trailHistoryX[i] = x;
            trailHistoryY[i] = y;
            trailHistoryZ[i] = z;
        }
    }
    ballRibbonMesh.visible = true;
    for (let i = TRAIL_SAMPLES - 1; i > 0; i--) {
        trailHistoryX[i] = trailHistoryX[i - 1];
        trailHistoryY[i] = trailHistoryY[i - 1];
        trailHistoryZ[i] = trailHistoryZ[i - 1];
    }
    trailHistoryX[0] = x;
    trailHistoryY[0] = y;
    trailHistoryZ[0] = z;
    if (trailCount < TRAIL_SAMPLES) trailCount++;

    for (let i = 0; i < TRAIL_SAMPLES; i++) {
        const taper = Math.pow(1 - i / (TRAIL_SAMPLES - 1), 1.3) * 0.16;
        const idx = i * 6;
        trailPositions[idx] = trailHistoryX[i] - taper;
        trailPositions[idx + 1] = trailHistoryY[i];
        trailPositions[idx + 2] = trailHistoryZ[i];
        trailPositions[idx + 3] = trailHistoryX[i] + taper;
        trailPositions[idx + 4] = trailHistoryY[i];
        trailPositions[idx + 5] = trailHistoryZ[i];
    }
    trailGeo.attributes.position.needsUpdate = true;
};

const ballBody = new CANNON.Body({
    mass: 0.38,
    shape: new CANNON.Sphere(BALL_RADIUS),
    position: new CANNON.Vec3(0, BALL_RADIUS, -9.0),
    material: ballPhysMat,
    linearDamping: 0.008,
    angularDamping: 0.04
});
world.addBody(ballBody);
// Deterministic aerodynamic curl: constant lateral Magnus acceleration applied every fixed substep
// until the ball crosses the goal line. Must match ShotSolver's sandbox exactly.
ballBody.preStep = function (h) {
    if (ballInFlight && this.position.z > -20.0 && !this.inNet && !this.saved) this.velocity.x += currentShotMagnusAx * h;
};
window.ballBody = ballBody;
window.ballMesh = ballMesh;
window.ballRadius = BALL_RADIUS;
window.BALL_RADIUS = BALL_RADIUS;
window.ballGroundShadow = ballGroundShadow;
window.ballSpotRing = ballSpotRing;
