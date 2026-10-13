// ============================================================================
// 4. BROADCAST STADIUM ARENA, PANORAMIC BOWL,WAVING FLAGS & LED HOARDINGS
// ============================================================================
const stadium = new THREE.Group();
const wavingFlags = [];

function generateCrowdTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Deep atmospheric stadium terrace shadow gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 160);
    bgGrad.addColorStop(0, '#050914');
    bgGrad.addColorStop(0.5, '#091122');
    bgGrad.addColorStop(1, '#040812');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 2048, 160);

    const fanColors = [
        '#1e3a8a', '#1d4ed8', '#1e40af', '#0369a1',
        '#991b1b', '#b91c1c', '#cbd5e1', '#e2e8f0',
        '#0f172a', '#1e293b', '#334155', '#d97706',
        '#065f46', '#111827', '#1e1b4b'
    ];
    const skinTones = ['#d9a17c', '#c68863', '#8d5534', '#e5b899', '#6b3e26'];

    const rows = 2;
    const rowH = 160 / rows;
    for (let r = 0; r < rows; r++) {
        const rowY = r * rowH;

        // Concrete terrace step & handrail
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, rowY, 2048, 12);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.18)';
        ctx.fillRect(0, rowY + 10, 2048, 2);

        for (let x = 8; x < 2040; x += 22 + Math.floor(Math.random() * 8)) {
            if ((x > 380 && x < 445) || (x > 990 && x < 1058) || (x > 1590 && x < 1655)) {
                ctx.fillStyle = '#131c31';
                ctx.fillRect(x, rowY + 12, 24, rowH - 12);
                ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
                ctx.fillRect(x + 2, rowY + 14, 20, 3);
                continue;
            }

            const kit = fanColors[Math.floor(Math.random() * fanColors.length)];
            const skin = skinTones[Math.floor(Math.random() * skinTones.length)];
            const yJitter = (Math.random() - 0.5) * 6;
            const headR = 8.5 + Math.random() * 2.0;

            // Torso / Shoulders
            ctx.fillStyle = kit;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x - 10, rowY + 28 + yJitter, 22 + Math.random() * 4, rowH - 26, [8, 8, 0, 0]);
            } else {
                ctx.rect(x - 10, rowY + 28 + yJitter, 24, rowH - 26);
            }
            ctx.fill();

            // Head
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.arc(x + 2, rowY + 20 + yJitter, headR, 0, Math.PI * 2);
            ctx.fill();

            // Hair / Cap
            ctx.fillStyle = Math.random() > 0.25 ? '#0f172a' : kit;
            ctx.beginPath();
            ctx.arc(x + 2, rowY + 18 + yJitter, headR, Math.PI, Math.PI * 2);
            ctx.fill();
        }

        // Subtle atmospheric depth vignette per tier
        ctx.fillStyle = 'rgba(2, 6, 23, 0.36)';
        ctx.fillRect(0, rowY, 2048, rowH);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(5, 1);
    return tex;
}

const crowdTex = generateCrowdTexture();
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.88 });
const seatMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.55 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.35, metalness: 0.75 });
const suiteMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

// Photographic 360° Stadium Bowl Panorama Upper Backdrop (Uses assets/stadium.jpg)
const stadiumPanoTex = pbrTextureLoader.load('assets/stadium.jpg');
stadiumPanoTex.wrapS = THREE.RepeatWrapping;
stadiumPanoTex.repeat.set(2, 1);
const panoBowlGeo = new THREE.CylinderGeometry(68, 56, 36, 64, 1, true);
const panoBowlMat = new THREE.MeshBasicMaterial({
    map: stadiumPanoTex,
    side: THREE.BackSide,
    toneMapped: true
});
panoBowlMat.color.setRGB(0.68, 0.74, 0.86);
const panoBowlMesh = new THREE.Mesh(panoBowlGeo, panoBowlMat);
panoBowlMesh.position.set(0, 15.5, -10);
stadium.add(panoBowlMesh);

// Pitch-Perimeter Concrete Moat Wall behind LED hoardings
const moatWallMat = new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.85, metalness: 0.15 });
const moatWall = new THREE.Mesh(new THREE.BoxGeometry(82, 1.25, 0.6), moatWallMat);
moatWall.position.set(0, 0.62, -25.2);
stadium.add(moatWall);

// Center Vomitory Player Tunnel Behind Goal (Authentic Stadium Focal Depth)
const tunnelOpening = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 3.6, 4.5),
    new THREE.MeshBasicMaterial({ color: 0x02040a })
);
tunnelOpening.position.set(0, 1.8, -28.8);
stadium.add(tunnelOpening);

const tunnelArch = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.45, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.6 })
);
tunnelArch.position.set(0, 3.7, -27.2);
stadium.add(tunnelArch);

const sharedCrowdMat = new THREE.MeshStandardMaterial({
    map: crowdTex,
    roughness: 0.82
});

// North Stand Behind Goal (12 Stepped 3D Tiers with Organic Crowd Textures)
for (let t = 0; t < 12; t++) {
    const w = 74 + t * 2.8;
    const tierDepth = 2.5;
    const tierH = 1.42;
    const tierZ = -25.6 - t * 2.25;
    const tierY = 1.15 + t * 1.38;

    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, tierDepth), concreteMat);
    step.position.set(0, tierY, tierZ);
    stadium.add(step);

    const riser = new THREE.Mesh(new THREE.PlaneGeometry(w, tierH * 1.12), sharedCrowdMat);
    riser.position.set(0, tierY + tierH * 0.52, tierZ + tierDepth * 0.48);
    riser.rotation.x = 0.14;
    stadium.add(riser);

    const seatRow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.18, 0.38), seatMat);
    seatRow.position.set(0, tierY + 0.22, tierZ - 0.35);
    stadium.add(seatRow);
}

// Waving 3D Supporter Flags in the North Stand (Authentic National Flags)
function createNationalFlagTexture(code) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (code === 'FRA') {
        ctx.fillStyle = '#002395'; ctx.fillRect(0, 0, 85, 160);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(85, 0, 86, 160);
        ctx.fillStyle = '#ed2939'; ctx.fillRect(171, 0, 85, 160);
    } else if (code === 'BRA') {
        ctx.fillStyle = '#009c3b'; ctx.fillRect(0, 0, 256, 160);
        ctx.fillStyle = '#ffdf00';
        ctx.beginPath();
        ctx.moveTo(128, 18); ctx.lineTo(232, 80); ctx.lineTo(128, 142); ctx.lineTo(24, 80);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#002776';
        ctx.beginPath(); ctx.arc(128, 80, 34, 0, Math.PI * 2); ctx.fill();
    } else if (code === 'ENG') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 256, 160);
        ctx.fillStyle = '#ce1124';
        ctx.fillRect(108, 0, 40, 160);
        ctx.fillRect(0, 62, 256, 36);
    } else if (code === 'ARG') {
        ctx.fillStyle = '#74acdf'; ctx.fillRect(0, 0, 256, 53);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 53, 256, 54);
        ctx.fillStyle = '#74acdf'; ctx.fillRect(0, 107, 256, 53);
        ctx.fillStyle = '#f6b40e';
        ctx.beginPath(); ctx.arc(128, 80, 16, 0, Math.PI * 2); ctx.fill();
    } else if (code === 'ESP') {
        ctx.fillStyle = '#aa151b'; ctx.fillRect(0, 0, 256, 40);
        ctx.fillStyle = '#f1bf00'; ctx.fillRect(0, 40, 256, 80);
        ctx.fillStyle = '#aa151b'; ctx.fillRect(0, 120, 256, 40);
    } else {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 256, 53);
        ctx.fillStyle = '#dd0000'; ctx.fillRect(0, 53, 256, 54);
        ctx.fillStyle = '#ffce00'; ctx.fillRect(0, 107, 256, 53);
    }
    return new THREE.CanvasTexture(canvas);
}

const flagConfigs = [
    { x: -16.5, y: 4.8, z: -28.5, code: 'FRA', phase: 0.0 },
    { x: -8.2,  y: 6.2, z: -30.8, code: 'BRA', phase: 1.4 },
    { x: 8.8,   y: 5.5, z: -29.8, code: 'ENG', phase: 2.7 },
    { x: 17.2,  y: 6.8, z: -31.8, code: 'ARG', phase: 4.1 },
    { x: -24.0, y: 7.5, z: -33.0, code: 'ESP', phase: 5.2 },
    { x: 24.5,  y: 7.2, z: -32.5, code: 'GER', phase: 0.8 }
];
const poleMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.3 });
flagConfigs.forEach(fc => {
    const flagGroup = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.2, 8), poleMat);
    pole.position.set(-1.1, 0, 0);
    pole.rotation.z = -0.25;
    flagGroup.add(pole);

    const fGeo = new THREE.PlaneGeometry(2.2, 1.35, 10, 4);
    const fTex = createNationalFlagTexture(fc.code);
    const fMat = new THREE.MeshStandardMaterial({
        map: fTex,
        side: THREE.DoubleSide,
        roughness: 0.50
    });
    const fMesh = new THREE.Mesh(fGeo, fMat);
    fMesh.position.set(0, 0.85, 0);
    flagGroup.add(fMesh);
    flagGroup.position.set(fc.x, fc.y, fc.z);
    stadium.add(flagGroup);
    wavingFlags.push({ mesh: fMesh, orig: fGeo.attributes.position.array.slice(), phase: fc.phase });
});
window.wavingFlags = wavingFlags;

// Upper Executive VIP Hospitality Boxes & Stadium Canopy
const suiteBox = new THREE.Mesh(new THREE.BoxGeometry(110, 3.5, 4.0), concreteMat);
suiteBox.position.set(0, 21.5, -57.5);
stadium.add(suiteBox);
for (let s = 0; s < 18; s++) {
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.9), suiteMat);
    windowMesh.position.set(-44 + s * 5.2, 21.5, -55.4);
    stadium.add(windowMesh);
}

const northRoof = new THREE.Mesh(new THREE.BoxGeometry(122, 1.2, 38), roofMat);
northRoof.position.set(0, 27.5, -46);
stadium.add(northRoof);

// South Stand & Flanking East/West Grandstands
for (let t = 0; t < 8; t++) {
    const w = 72 + t * 2.8;
    const tierDepth = 2.4;
    const tierH = 1.35;
    const tierZ = 20 + t * 2.2;
    const tierY = 1.1 + t * 1.35;

    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, tierDepth), concreteMat);
    step.position.set(0, tierY, tierZ);
    stadium.add(step);

    const sCrowdMat = new THREE.MeshStandardMaterial({ map: crowdTex.clone(), roughness: 0.8 });
    sCrowdMat.map.repeat.set(Math.max(2, Math.round(w / 14.0)), 1);
    sCrowdMat.map.needsUpdate = true;

    const riser = new THREE.Mesh(new THREE.PlaneGeometry(w, tierH), sCrowdMat);
    riser.rotation.y = Math.PI;
    riser.position.set(0, tierY + tierH * 0.5, tierZ - tierDepth * 0.5);
    stadium.add(riser);
}

for (let t = 0; t < 10; t++) {
    const len = 96 + t * 2.2;
    const tierW = 2.4;
    const tierH = 1.35;
    const tierY = 1.1 + t * 1.35;
    const lx = -36 - t * 2.2;
    const rx = 36 + t * 2.2;

    const lStep = new THREE.Mesh(new THREE.BoxGeometry(tierW, 0.35, len), concreteMat);
    lStep.position.set(lx, tierY, -8);
    stadium.add(lStep);

    const lCrowdMat = new THREE.MeshStandardMaterial({ map: crowdTex.clone(), roughness: 0.8 });
    lCrowdMat.map.repeat.set(Math.max(2, Math.round(len / 14.0)), 1);
    lCrowdMat.map.needsUpdate = true;
    const lRiser = new THREE.Mesh(new THREE.PlaneGeometry(len, tierH), lCrowdMat);
    lRiser.rotation.y = Math.PI / 2;
    lRiser.position.set(lx + tierW * 0.5, tierY + tierH * 0.5, -8);
    stadium.add(lRiser);

    const rStep = new THREE.Mesh(new THREE.BoxGeometry(tierW, 0.35, len), concreteMat);
    rStep.position.set(rx, tierY, -8);
    stadium.add(rStep);

    const rCrowdMat = new THREE.MeshStandardMaterial({ map: crowdTex.clone(), roughness: 0.8 });
    rCrowdMat.map.repeat.set(Math.max(2, Math.round(len / 14.0)), 1);
    rCrowdMat.map.needsUpdate = true;
    const rRiser = new THREE.Mesh(new THREE.PlaneGeometry(len, tierH), rCrowdMat);
    rRiser.rotation.y = -Math.PI / 2;
    rRiser.position.set(rx - tierW * 0.5, tierY + tierH * 0.5, -8);
    stadium.add(rRiser);
}

// Sideline Team Dugouts
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

// 4 High-Intensity Steel Lattice Floodlight Mast Arrays
const floodlightLampGeo = new THREE.BoxGeometry(0.72, 0.72, 0.42);
const floodlightLampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
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
    for (let leg = 0; leg < 4; leg++) {
        const lx0 = (leg % 2 === 0 ? -1 : 1) * 1.6;
        const lz0 = (leg < 2 ? -1 : 1) * 1.6;
        const lx1 = (leg % 2 === 0 ? -1 : 1) * 1.0;
        const lz1 = (leg < 2 ? -1 : 1) * 1.0;

        const pylonLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 33, 8), pylonMat);
        pylonLeg.position.set(pos.x + (lx0 + lx1) * 0.5, 16.5, pos.z + (lz0 + lz1) * 0.5);
        stadium.add(pylonLeg);
    }

    for (let b = 1; b <= 4; b++) {
        const bY = b * 7.5;
        const braceW = 3.2 - b * 0.35;
        const braceX = new THREE.Mesh(new THREE.BoxGeometry(braceW, 0.12, 0.12), pylonBraceMat);
        braceX.position.set(pos.x, bY, pos.z);
        stadium.add(braceX);
    }

    const gantry = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 5.2), concreteMat);
    gantry.position.set(pos.x, 33, pos.z);
    stadium.add(gantry);

    const headFrame = new THREE.Group();
    headFrame.position.set(pos.x, 34.2, pos.z);
    headFrame.rotation.y = pos.rotY;
    headFrame.rotation.x = 0.60;

    for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
            const lamp = new THREE.Mesh(floodlightLampGeo, floodlightLampMat);
            lamp.position.set(-2.0 + c * 1.0, r * 0.95, 0.25);
            headFrame.add(lamp);
        }
    }

    const coronaMesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), mastCoronaMat);
    coronaMesh.position.set(0, 1.5, 0.6);
    headFrame.add(coronaMesh);

    stadium.add(headFrame);
});

// Perimeter Animated Digital LED Hoardings (High-Contrast Broadcast Sponsor Boards)
function generateAdHoardingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, 2048, 128);

    const panels = [
        { bg: '#0c1938', border: '#38bdf8', accent: '#0284c7', main: 'FOOTBALL STRIKE PRO', sub: 'CHAMPIONS SHOOTOUT' },
        { bg: '#1e1136', border: '#facc15', accent: '#eab308', main: 'HYPERVORTEX 3D', sub: 'TRUE MAGNUS FLIGHT' },
        { bg: '#072a24', border: '#34d399', accent: '#10b981', main: 'WORLD TOUR CUP', sub: 'STRIKER VS KEEPER' },
        { bg: '#31101d', border: '#f87171', accent: '#ef4444', main: 'APEX PRECISION', sub: 'TOP BIN CHALLENGE' }
    ];

    const pW = 2048 / panels.length;
    panels.forEach((p, idx) => {
        const px = idx * pW;
        ctx.fillStyle = p.bg;
        ctx.fillRect(px + 4, 6, pW - 8, 116);

        ctx.strokeStyle = p.border;
        ctx.lineWidth = 4;
        ctx.strokeRect(px + 6, 8, pW - 12, 112);

        ctx.fillStyle = p.accent;
        ctx.fillRect(px + 16, 18, 14, 92);

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 36px system-ui, sans-serif';
        ctx.fillText(p.main, px + 44, 64);

        ctx.fillStyle = p.border;
        ctx.font = '800 18px system-ui, sans-serif';
        ctx.fillText(p.sub, px + 44, 98);
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
    emissiveIntensity: 0.78,
    roughness: 0.25,
    metalness: 0.20
});
const adCasingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });

// North Goal-Line Digital LED Hoarding (Positioned at z = -23.1 for zero Z-fighting & crisp TV broadcast framing)
const northAdGroup = new THREE.Group();
const northAd = new THREE.Mesh(new THREE.BoxGeometry(72, 1.15, 0.25), adMat);
northAd.position.set(0, 0.58, 0);
northAdGroup.add(northAd);
const northCasing = new THREE.Mesh(new THREE.BoxGeometry(72.4, 1.24, 0.35), adCasingMat);
northCasing.position.set(0, 0.56, -0.06);
northAdGroup.add(northCasing);
northAdGroup.position.set(0, 0, -23.1);
stadium.add(northAdGroup);

// Left & Right Touchline Digital LED Hoardings
[-34, 34].forEach(sideX => {
    const sideAdGroup = new THREE.Group();
    const sideAd = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.15, 84), adMat);
    sideAd.position.set(0, 0.58, 0);
    sideAdGroup.add(sideAd);
    const sideCasing = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.24, 84.4), adCasingMat);
    sideCasing.position.set(sideX < 0 ? -0.05 : 0.05, 0.56, 0);
    sideAdGroup.add(sideCasing);
    sideAdGroup.position.set(sideX, 0, -8);
    stadium.add(sideAdGroup);
});

// 16 Stadium Camera Flashbulbs
const flashGeo = new THREE.SphereGeometry(0.35, 8, 8);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
for (let i = 0; i < 16; i++) {
    const flash = new THREE.Mesh(flashGeo, flashMat.clone());
    flash.position.set((Math.random() - 0.5) * 62, 3.5 + Math.random() * 14, -27 - Math.random() * 16);
    stadium.add(flash);
    cameraFlashes.push({ mesh: flash, timer: Math.random() * 2.5 });
}

scene.add(stadium);
