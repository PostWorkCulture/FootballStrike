// ============================================================================
// 3. PITCH, CHALK MARKINGS & TACTICAL SPOT RING
// ============================================================================
let turfPhotoImage = null;
let turfCanvas = null;
let turfTexture = null;
window.turfStripeContrast = 1.0;

function renderTurfCanvas(stripeContrast) {
    if (!turfCanvas) {
        turfCanvas = document.createElement('canvas');
        turfCanvas.width = 2048;
        turfCanvas.height = 2048;
    }
    const ctx = turfCanvas.getContext('2d');
    const cFactor = typeof stripeContrast === 'number' ? stripeContrast : (window.turfStripeContrast ?? 1.0);

    // Rich UEFA/FIFA stadium hybrid grass base (deep emerald & forest green, zero white blowout)
    const base = ctx.createLinearGradient(0, 0, 0, 2048);
    base.addColorStop(0, '#123e1a');
    base.addColorStop(0.5, '#0f3516');
    base.addColorStop(1, '#0b2911');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 2048, 2048);

    // Tile Nano Banana 2K grass photo texture in a 4x4 high-frequency grid so macro close-ups never look smeared
    if (turfPhotoImage && turfPhotoImage.complete && turfPhotoImage.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        const tiles = 4;
        const tw = 2048 / tiles;
        for (let ty = 0; ty < tiles; ty++) {
            for (let tx = 0; tx < tiles; tx++) {
                ctx.drawImage(turfPhotoImage, tx * tw, ty * tw, tw, tw);
            }
        }
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = '#194a22';
        ctx.fillRect(0, 0, 2048, 2048);
        ctx.restore();
    }
    // Fine organic micro-blade pixel grain across all 2048x2048 texels
    const idata = ctx.getImageData(0, 0, 2048, 2048);
    const d = idata.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 18;
        d[i] = Math.min(255, Math.max(0, d[i] + n * 0.6));
        d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n * 1.15));
        d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n * 0.5));
    }
    ctx.putImageData(idata, 0, 0);

    // Wide horizontal mower bands (creates crisp 5.5m stadium bands)
    const hBands = 16;
    const bandH = 2048 / hBands;
    const hLightAlpha = Math.min(0.45, 0.16 * cFactor);
    const hDarkAlpha = Math.min(0.55, 0.24 * cFactor);
    for (let i = 0; i < hBands; i++) {
        ctx.fillStyle = i % 2 === 0 ? `rgba(38, 128, 54, ${hLightAlpha})` : `rgba(5, 24, 9, ${hDarkAlpha})`;
        ctx.fillRect(0, i * bandH, 2048, bandH);
    }

    // Subtle longitudinal mower lanes leading the eye toward the goalmouth
    const vBands = 12;
    const bandW = 2048 / vBands;
    const vAlpha = Math.min(0.28, 0.07 * cFactor);
    for (let j = 0; j < vBands; j++) {
        ctx.fillStyle = j % 2 === 0 ? `rgba(42, 138, 58, ${vAlpha})` : `rgba(4, 20, 8, ${vAlpha})`;
        ctx.fillRect(j * bandW, 0, bandW, 2048);
    }

    // High-density crisp individual grass blades catching floodlights
    ctx.lineWidth = 1.1;
    for (let b = 0; b < 32000; b++) {
        const bx = Math.random() * 2048, by = Math.random() * 2048;
        const len = 2.5 + Math.random() * 4.5;
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 0.55;
        ctx.strokeStyle = Math.random() > 0.55 ? 'rgba(64, 168, 82, 0.22)' : 'rgba(6, 28, 11, 0.28)';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len);
        ctx.stroke();
    }

    if (turfTexture) {
        turfTexture.needsUpdate = true;
    }
}

function generateTurf() {
    renderTurfCanvas(window.turfStripeContrast);
    turfTexture = new THREE.CanvasTexture(turfCanvas);
    turfTexture.wrapS = THREE.RepeatWrapping;
    turfTexture.wrapT = THREE.RepeatWrapping;
    turfTexture.repeat.set(4, 5);
    turfTexture.anisotropy = 16;

    // Load Nano Banana 2K grass texture and blend with procedural mower stripes
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () {
        turfPhotoImage = img;
        renderTurfCanvas(window.turfStripeContrast);
    };
    img.src = 'assets/textures/turf_grass_2k.jpg';

    return turfTexture;
}

window.updateTurfStripeContrast = function (contrastVal) {
    window.turfStripeContrast = contrastVal;
    renderTurfCanvas(contrastVal);
};

function generateBump() {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 24000; i++) {
        const v = Math.floor(Math.random() * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = width * 1.9;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.92)';
        ctx.lineWidth = width * 1.15;
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
    ctx.fillStyle = 'rgba(241, 245, 249, 0.92)';
    ctx.beginPath();
    ctx.arc(centerX, spotY, 0.14 * pxPerMeter * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Penalty D-Arc
    const dRad = 9.15 * pxPerMeter;
    const dy = (goalLineY + dP) - spotY;
    const sAng = Math.acos(dy / dRad);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = regLineWidth * 1.9;
    ctx.beginPath(); ctx.arc(centerX, spotY, dRad, sAng, Math.PI - sAng, false); ctx.stroke();
    ctx.strokeStyle = 'rgba(241, 245, 249, 0.92)';
    ctx.lineWidth = regLineWidth * 1.15;
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
turfNormalTex.repeat.set(22, 30);

const turfBumpTex = generateBump();

// Subdivided 80x110 3D pitch grid (1m x 1m quads) for clean vertex shading, shadow reception, and wireframe inspection
const pitchGeo = new THREE.PlaneGeometry(80, 110, 80, 110);
const pitchMat = new THREE.MeshStandardMaterial({
    map: generateTurf(),
    normalMap: turfNormalTex,
    normalScale: new THREE.Vector2(0.55, 0.55),
    bumpMap: turfBumpTex,
    bumpScale: 0.030,
    roughness: 0.92,
    metalness: 0.0
});
const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
pitchMesh.rotation.x = -Math.PI / 2;
pitchMesh.position.set(0, 0, 0);
pitchMesh.receiveShadow = true;
scene.add(pitchMesh);
window.pitchMat = pitchMat;
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
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
});
const chalkMesh = new THREE.Mesh(chalkGeo, chalkMat);
chalkMesh.rotation.x = -Math.PI / 2;
chalkMesh.position.set(0, 0.004, -10);
scene.add(chalkMesh);
window.chalkMesh = chalkMesh;

// Crisp 11m Regulation Penalty Spot Disc flush on turf at y = 0.005
const penaltySpotGeo = new THREE.CircleGeometry(0.11, 24);
const penaltySpotMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
});
const penaltySpotMesh = new THREE.Mesh(penaltySpotGeo, penaltySpotMat);
penaltySpotMesh.rotation.x = -Math.PI / 2;
penaltySpotMesh.position.set(0, 0.005, -9.0);
scene.add(penaltySpotMesh);
window.penaltySpotMesh = penaltySpotMesh;

// ============================================================================
// 3D FOREGROUND INSTANCED GRASS BLADE TUFTS (MATCHING 2K NANO BANANA TARGETS)
// ============================================================================
(function buildInstancedGrassBlades() {
    // 5-blade organic micro-tuft geometry (height ~1.7cm, fine blade width ~2.2mm) so low-angle macro views look like real stadium turf
    const bladeGeo = new THREE.BufferGeometry();
    const h = 0.017;
    const w = 0.0021;
    const positions = new Float32Array([
        // Blade 1 (center upright, slightly curved forward)
        -w, 0.0, 0.0,
         w, 0.0, 0.0,
         0.0012, h, 0.0020,
        // Blade 2 (angled left-forward)
        -w * 0.8 + 0.003, 0.0, -w * 0.6 + 0.002,
         w * 0.8 + 0.003, 0.0,  w * 0.6 + 0.002,
         0.0055, h * 0.92, 0.0045,
        // Blade 3 (angled right-back)
        -w * 0.7 - 0.003, 0.0,  w * 0.7 - 0.002,
         w * 0.7 - 0.003, 0.0, -w * 0.7 - 0.002,
        -0.0055, h * 0.88, -0.0040,
        // Blade 4 (splayed left)
        -0.004, 0.0, -w,
        -0.004, 0.0,  w,
        -0.0075, h * 0.82, 0.0025,
        // Blade 5 (splayed right)
         0.004, 0.0, -w,
         0.004, 0.0,  w,
         0.0075, h * 0.85, -0.0025
    ]);
    // Subtle natural turf colors blending seamlessly from the ground plane (root matches turf #0f3516, tip catches floodlight #2c6e38)
    const colors = new Float32Array([
        0.05, 0.19, 0.08,   0.05, 0.19, 0.08,   0.20, 0.50, 0.24,
        0.05, 0.18, 0.07,   0.05, 0.18, 0.07,   0.22, 0.54, 0.26,
        0.04, 0.17, 0.07,   0.04, 0.17, 0.07,   0.18, 0.46, 0.22,
        0.05, 0.18, 0.08,   0.05, 0.18, 0.08,   0.21, 0.52, 0.25,
        0.04, 0.17, 0.07,   0.04, 0.17, 0.07,   0.19, 0.48, 0.23
    ]);
    bladeGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    bladeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    bladeGeo.computeVertexNormals();

    const bladeMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.78,
        metalness: 0.02,
        side: THREE.DoubleSide
    });

    const tuftCount = 22000;
    const grassInstanced = new THREE.InstancedMesh(bladeGeo, bladeMat, tuftCount);
    grassInstanced.receiveShadow = true;
    grassInstanced.castShadow = false;

    const dummy = new THREE.Object3D();
    const instanceColor = new THREE.Color();
    let seed = 1337;
    function rand() {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
    }

    for (let i = 0; i < tuftCount; i++) {
        let gx, gz;
        if (i < 13000) {
            // Ultra-dense foreground carpet right around the ball, spot ring, and striker boots (x in [-3.2, 3.2], z in [-12.0, -6.2])
            gx = (rand() - 0.5) * 6.4;
            gz = -6.2 - rand() * 5.8;
        } else {
            // Mid-ground penalty area & 3-man wall zone (x in [-9.5, 9.5], z in [-19.5, -5.0])
            gx = (rand() - 0.5) * 19.0;
            gz = -5.0 - rand() * 14.5;
        }
        dummy.position.set(gx, 0.0, gz);
        dummy.rotation.set(
            (rand() - 0.5) * 0.28,
            rand() * Math.PI * 2,
            (rand() - 0.5) * 0.28
        );
        const sXZ = 0.80 + rand() * 0.55;
        const sY = 0.70 + rand() * 0.65;
        dummy.scale.set(sXZ, sY, sXZ);
        dummy.updateMatrix();
        grassInstanced.setMatrixAt(i, dummy.matrix);

        // Modulate instance tint slightly with mower stripe Z-band so 3D blades harmonize with the mowed pitch bands
        const bandShade = 0.88 + 0.24 * Math.floor(((gz + 55.0) / 4.4) % 2);
        const jitter = 0.92 + rand() * 0.16;
        instanceColor.setRGB(bandShade * jitter, bandShade * jitter, bandShade * jitter);
        grassInstanced.setColorAt(i, instanceColor);
    }
    grassInstanced.instanceMatrix.needsUpdate = true;
    if (grassInstanced.instanceColor) grassInstanced.instanceColor.needsUpdate = true;
    scene.add(grassInstanced);
    window.grassInstanced = grassInstanced;
})();

