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

