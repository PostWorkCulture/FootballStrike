// ============================================================================
// 9. TARGET RACE TARGETS & SHATTER EFFECTS (Red/White & Golden Lucky Bullseyes)
// ============================================================================
const targetSlotConfigs = [
    { x: -2.85, y: 1.95, z: -19.9, isMoving: false, radius: 0.44, isGolden: false }, // Top Left Corner
    { x: 2.85, y: 1.95, z: -19.9, isMoving: false, radius: 0.44, isGolden: false },  // Top Right Corner
    { x: 0, y: 2.02, z: -19.9, isMoving: true, radius: 0.46, isGolden: true },       // Center Golden Lucky Sweeper
    { x: -2.65, y: 0.55, z: -19.9, isMoving: false, radius: 0.44, isGolden: false }, // Bottom Left Corner
    { x: 2.65, y: 0.55, z: -19.9, isMoving: false, radius: 0.44, isGolden: true }    // Bottom Right Golden Target
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
    ctx.strokeStyle = '#38bdf8';
    ctx.stroke();

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
    ctx.arc(cx, cy, maxR * 0.13, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#facc15';
    ctx.stroke();

    // Clear Point Values printed on rings
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('25', cx, cy - maxR * 0.85);
    ctx.fillText('25', cx, cy + maxR * 0.85);

    ctx.fillStyle = '#dc2626';
    ctx.font = '900 26px system-ui, sans-serif';
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

function createGoldenLuckyBullseyeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const cx = 256;
    const cy = 256;
    const maxR = 244;

    // Royal Gold Outer Rim
    ctx.beginPath();
    ctx.arc(cx, cy, 254, 0, Math.PI * 2);
    ctx.fillStyle = '#422006';
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#facc15';
    ctx.stroke();

    // Ring 1: Rich Amber Gold
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.fillStyle = '#d97706';
    ctx.fill();

    // Ring 2: Deep Midnight Blue
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();

    // Ring 3: Bright Championship Gold
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.46, 0, Math.PI * 2);
    ctx.fillStyle = '#facc15';
    ctx.fill();

    // Ring 4: Crisp White
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Center Bullseye: Emerald / Gold Star Core
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.14, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#fef08a';
    ctx.stroke();

    ctx.fillStyle = '#fef08a';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ 75 ★', cx, cy - maxR * 0.85);
    ctx.fillText('LUCKY', cx, cy + maxR * 0.85);

    ctx.fillStyle = '#facc15';
    ctx.font = '900 24px system-ui, sans-serif';
    ctx.fillText('150', cx, cy - maxR * 0.58);
    ctx.fillText('150', cx, cy + maxR * 0.58);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 22px system-ui, sans-serif';
    ctx.fillText('250', cx, cy);

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
}

const redWhiteTargetTex = createRedWhiteBullseyeTexture();
const goldenLuckyTargetTex = createGoldenLuckyBullseyeTexture();

function createTargetMeshAndBody(c) {
    const group = new THREE.Group();
    const isGolden = !!c.isGolden;

    // Single crisp textured disc target (Zero Z-fighting)
    const discGeo = new THREE.CylinderGeometry(c.radius, c.radius, 0.045, 32);
    const faceMat = new THREE.MeshStandardMaterial({
        map: isGolden ? goldenLuckyTargetTex : redWhiteTargetTex,
        roughness: isGolden ? 0.18 : 0.25,
        metalness: isGolden ? 0.35 : 0.05
    });
    const rimMat = new THREE.MeshStandardMaterial({
        color: isGolden ? 0xfacc15 : 0x334155,
        roughness: 0.30,
        metalness: 0.75
    });
    const disc = new THREE.Mesh(discGeo, [rimMat, faceMat, faceMat]);
    disc.rotation.x = Math.PI / 2;
    disc.castShadow = true;
    disc.receiveShadow = true;
    group.add(disc);

    // Crossbar Mounting Cables (Suspended firmly from the crossbar)
    const goalCrossbarY = 2.44;
    const hangLen = Math.max(0.12, goalCrossbarY - c.y);
    const cableMat = new THREE.MeshStandardMaterial({
        color: isGolden ? 0xfacc15 : 0x64748b,
        metalness: 0.8,
        roughness: 0.3
    });
    const cableGeo = new THREE.CylinderGeometry(0.007, 0.007, hangLen, 8);

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

    return {
        mesh: group,
        body,
        config: c,
        cables: [cableL, cableR],
        active: true,
        isMoving: c.isMoving,
        isGolden: isGolden,
        originX: c.x,
        originY: c.y
    };
}

function spawnSingleTarget(slotId) {
    const config = targetSlotConfigs[slotId];
    if (!config) return null;
    const targetObj = createTargetMeshAndBody(config);
    targetObj.slotId = slotId;
    activeTargets.push(targetObj);
    return targetObj;
}

function spawnRandomTarget() {
    const activeSlots = activeTargets.map(t => t.slotId);
    const availableSlots = [0, 1, 2, 3, 4].filter(s => !activeSlots.includes(s));
    if (availableSlots.length > 0) {
        const nextSlot = availableSlots[Math.floor(Math.random() * availableSlots.length)];
        spawnSingleTarget(nextSlot);
    }
}

function spawnTrainingDrillTargets() {
    activeTargets.forEach(t => { scene.remove(t.mesh); world.removeBody(t.body); });
    activeTargets = [];
    // Spawn all 4 Corner Bullseye Targets (TL, TR, BL, BR) + 1 Center Golden Bullseye
    [0, 1, 2, 3, 4].forEach(slotId => spawnSingleTarget(slotId));
}
window.spawnTrainingDrillTargets = spawnTrainingDrillTargets;
window.spawnTargetsWave = spawnTrainingDrillTargets;
window.targets = activeTargets;

// Pooled Particle FX (zero allocation during gameplay)
const FX_POOL_SIZE = 128;
const fxShardGeo = new THREE.BoxGeometry(0.085, 0.085, 0.085);
const fxVaporGeo = new THREE.SphereGeometry(0.042, 6, 6);
const fxMatRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.2 });
const fxMatWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
const fxMatGold = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.15, metalness: 0.6 });
const fxMatVapor = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.60 });
const fxMatFire = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.78 });
const fxPool = [];
for (let i = 0; i < FX_POOL_SIZE; i++) {
    const m = new THREE.Mesh(fxShardGeo, fxMatWhite);
    m.visible = false;
    m.frustumCulled = false;
    scene.add(m);
    fxPool.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0, gravity: 16 });
}
let fxCursor = 0;

function spawnParticle(geo, mat, x, y, z, vx, vy, vz, life, gravity) {
    const p = fxPool[fxCursor];
    fxCursor = (fxCursor + 1) % FX_POOL_SIZE; // ring buffer: oldest particle recycled
    p.mesh.geometry = geo;
    p.mesh.material = mat;
    p.mesh.position.set(x, y, z);
    p.mesh.visible = true;
    p.vx = vx; p.vy = vy; p.vz = vz; p.life = life; p.gravity = gravity;
    return p;
}

function updateParticles(dt) {
    for (let i = 0; i < FX_POOL_SIZE; i++) {
        const p = fxPool[i];
        if (p.life <= 0) continue;
        p.life -= dt * 1.5;
        if (p.life <= 0) { p.mesh.visible = false; continue; }
        p.mesh.position.x += p.vx * dt;
        p.mesh.position.y += p.vy * dt;
        p.mesh.position.z += p.vz * dt;
        p.vy -= p.gravity * dt;
    }
}

function activeParticleCount() {
    let n = 0;
    for (let i = 0; i < FX_POOL_SIZE; i++) if (fxPool[i].life > 0) n++;
    return n;
}
window.activeParticleCount = activeParticleCount;

// Particle Glass FX (Dynamic Red/White or Gold/White Shards)
function createShatterFX(x, y, z, isGolden) {
    const primaryMat = isGolden ? fxMatGold : fxMatRed;
    for (let i = 0; i < 40; i++) {
        spawnParticle(fxShardGeo, (i % 2 === 0) ? primaryMat : fxMatWhite, x, y, z,
            (Math.random() - 0.5) * 14, Math.random() * 10 + 2, (Math.random() - 0.5) * 14, 0.95, 16);
    }
}

// 3D-to-2D Floating Score Popup on HUD (for Target Hits & Top-Corner Goals)
const _popupProjVec = new THREE.Vector3();
window.spawnFloatingScorePopup = function(worldX, worldY, worldZ, text, color = '#facc15') {
    const hud = document.getElementById('hud');
    if (!hud || typeof camera === 'undefined') return;
    _popupProjVec.set(worldX, worldY, worldZ).project(camera);
    const sx = (_popupProjVec.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-_popupProjVec.y * 0.5 + 0.5) * window.innerHeight;

    const el = document.createElement('div');
    el.className = 'floating-score-popup';
    el.innerText = text;
    el.style.left = `${sx}px`;
    el.style.top = `${sy}px`;
    el.style.color = color;
    hud.appendChild(el);
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, 1050);
};
