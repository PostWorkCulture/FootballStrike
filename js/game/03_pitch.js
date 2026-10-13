// ============================================================================
// 3. PITCH, CHALK MARKINGS & TACTICAL SPOT RING
// ============================================================================
function generateTurf() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 2048;
    const ctx = canvas.getContext('2d');

    // Rich UEFA/FIFA stadium hybrid grass base
    const base = ctx.createLinearGradient(0, 0, 0, 2048);
    base.addColorStop(0, '#195c27');
    base.addColorStop(0.5, '#155122');
    base.addColorStop(1, '#11431b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 2048, 2048);

    // Wide horizontal mower bands (creates crisp 5.5m stadium bands)
    const hBands = 16;
    const bandH = 2048 / hBands;
    for (let i = 0; i < hBands; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(52, 168, 74, 0.22)' : 'rgba(8, 38, 14, 0.20)';
        ctx.fillRect(0, i * bandH, 2048, bandH);
    }

    // Subtle longitudinal mower lanes leading the eye toward the goalmouth
    const vBands = 12;
    const bandW = 2048 / vBands;
    for (let j = 0; j < vBands; j++) {
        ctx.fillStyle = j % 2 === 0 ? 'rgba(64, 185, 86, 0.08)' : 'rgba(6, 32, 12, 0.08)';
        ctx.fillRect(j * bandW, 0, bandW, 2048);
    }

    // Fine organic grass blade micro-grain
    const idata = ctx.getImageData(0, 0, 2048, 2048);
    const d = idata.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 14;
        d[i] = Math.min(255, Math.max(0, d[i] + n * 0.8));
        d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n * 1.25));
        d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n * 0.7));
    }
    ctx.putImageData(idata, 0, 0);

    // Directional grass blades catching floodlights
    ctx.lineWidth = 1.4;
    for (let b = 0; b < 14000; b++) {
        const bx = Math.random() * 2048, by = Math.random() * 2048;
        const len = 3 + Math.random() * 6;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.65;
        ctx.strokeStyle = Math.random() > 0.6 ? 'rgba(86, 204, 102, 0.22)' : 'rgba(14, 54, 21, 0.26)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
        ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 5);
    tex.anisotropy = 8;
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
        ctx.save();
        ctx.lineCap = 'square';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.lineWidth = width * 2.1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.lineWidth = width * 1.25;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
    }

    const regLineWidth = 12 * 0.0512 * 12.5;
    // Goal line
    drawChalk(0, goalLineY, 2048, goalLineY, regLineWidth);

    // 6-yard Goal Area
    const hG = 9.16 * pxPerMeter, dG = 5.5 * pxPerMeter;
    drawChalk(centerX - hG, goalLineY, centerX - hG, goalLineY + dG, regLineWidth);
    drawChalk(centerX + hG, goalLineY, centerX + hG, goalLineY + dG, regLineWidth);
    drawChalk(centerX - hG, goalLineY + dG, centerX + hG, goalLineY + dG, regLineWidth);

    // 18-yard Penalty Area
    const hP = 20.16 * pxPerMeter, dP = 16.5 * pxPerMeter;
    drawChalk(centerX - hP, goalLineY, centerX - hP, goalLineY + dP, regLineWidth);
    drawChalk(centerX + hP, goalLineY, centerX + hP, goalLineY + dP, regLineWidth);
    drawChalk(centerX - hP, goalLineY + dP, centerX + hP, goalLineY + dP, regLineWidth);

    // 11m Penalty Spot
    const spotY = goalLineY + 11 * pxPerMeter;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.beginPath();
    ctx.arc(centerX, spotY, 0.14 * pxPerMeter * 1.9, 0, Math.PI * 2);
    ctx.fill();

    // Penalty D-Arc
    const dRad = 9.15 * pxPerMeter;
    const dy = (goalLineY + dP) - spotY;
    const sAng = Math.acos(dy / dRad);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
    ctx.lineWidth = regLineWidth * 2.1;
    ctx.beginPath(); ctx.arc(centerX, spotY, dRad, sAng, Math.PI - sAng, false); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
    ctx.lineWidth = regLineWidth * 1.25;
    ctx.beginPath(); ctx.arc(centerX, spotY, dRad, sAng, Math.PI - sAng, false); ctx.stroke();
    ctx.restore();

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 8;
    return tex;
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
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: turfRoughnessTex,
    roughness: 0.72,
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
    opacity: 0.96,
    depthWrite: false
});
const chalkMesh = new THREE.Mesh(chalkGeo, chalkMat);
chalkMesh.rotation.x = -Math.PI / 2;
chalkMesh.position.set(0, 0.02, -10);
scene.add(chalkMesh);
