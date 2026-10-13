// ============================================================================
// 4. BROADCAST STADIUM ARENA, PANORAMIC BOWL, WAVING FLAGS & STATIC HOARDINGS
// ============================================================================
const stadium = new THREE.Group();
const stadiumGroup = stadium;
window.stadium = stadium;
window.stadiumGroup = stadiumGroup;
const wavingFlags = [];

function generateCrowdTexture(seedOffset = 0) {
    const canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 160;
    const ctx = canvas.getContext('2d');

    // Deep atmospheric stadium terrace shadow gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 160);
    bgGrad.addColorStop(0, '#040812');
    bgGrad.addColorStop(0.5, '#070e1c');
    bgGrad.addColorStop(1, '#03060e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 2048, 160);

    const fanColors = [
        '#172554', '#1e3a8a', '#1d4ed8', '#0f172a',
        '#7f1d1d', '#991b1b', '#94a3b8', '#cbd5e1',
        '#090d16', '#1e293b', '#334155', '#b45309',
        '#064e3b', '#111827', '#1e1b4b', '#27272a'
    ];
    const skinTones = ['#d9a17c', '#c68863', '#8d5534', '#e5b899', '#6b3e26'];

    const rows = 2;
    const rowH = 160 / rows;
    for (let r = 0; r < rows; r++) {
        const rowY = r * rowH;

        // Concrete terrace step & safety handrail
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, rowY, 2048, 12);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
        ctx.fillRect(0, rowY + 10, 2048, 2);

        for (let x = 6; x < 2042; x += 18 + Math.floor(Math.random() * 11)) {
            // Recessed radial concrete steps with amber safety nosing painted flush into the terrace
            if ((x > 392 && x < 432) || (x > 1004 && x < 1044) || (x > 1604 && x < 1644)) {
                ctx.fillStyle = '#090f1d';
                ctx.fillRect(x, rowY + 12, 18, rowH - 12);
                ctx.fillStyle = 'rgba(217, 119, 6, 0.32)';
                ctx.fillRect(x + 2, rowY + 14, 14, 2);
                continue;
            }

            const kit = fanColors[(Math.floor(Math.random() * fanColors.length) + seedOffset) % fanColors.length];
            const skin = skinTones[Math.floor(Math.random() * skinTones.length)];
            const yJitter = (Math.random() - 0.5) * 10;
            const xJitter = (Math.random() - 0.5) * 5;
            const headR = 7.2 + Math.random() * 2.5;
            const shoulderW = 20 + Math.random() * 7;

            // Torso / Jacket / Scarf silhouette
            ctx.fillStyle = kit;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x - shoulderW * 0.45 + xJitter, rowY + 26 + yJitter, shoulderW, rowH - 24, [9, 9, 0, 0]);
            } else {
                ctx.rect(x - 10 + xJitter, rowY + 26 + yJitter, shoulderW, rowH - 24);
            }
            ctx.fill();

            // Subtle shoulder shadow & jacket collar
            ctx.fillStyle = 'rgba(2, 6, 23, 0.28)';
            ctx.fillRect(x - shoulderW * 0.45 + xJitter, rowY + 42 + yJitter, shoulderW, rowH - 40);

            // Head
            ctx.fillStyle = skin;
            ctx.beginPath();
            ctx.arc(x + 1 + xJitter, rowY + 19 + yJitter, headR, 0, Math.PI * 2);
            ctx.fill();

            // Hair / Beanie / Cap
            ctx.fillStyle = Math.random() > 0.3 ? '#0f172a' : kit;
            ctx.beginPath();
            ctx.arc(x + 1 + xJitter, rowY + 17 + yJitter, headR, Math.PI * 0.95, Math.PI * 2.05);
            ctx.fill();
        }

        // Atmospheric shadow gradient across each row
        const rowShadow = ctx.createLinearGradient(0, rowY, 0, rowY + rowH);
        rowShadow.addColorStop(0, 'rgba(2, 6, 23, 0.48)');
        rowShadow.addColorStop(0.5, 'rgba(2, 6, 23, 0.25)');
        rowShadow.addColorStop(1, 'rgba(2, 6, 23, 0.62)');
        ctx.fillStyle = rowShadow;
        ctx.fillRect(0, rowY, 2048, rowH);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(5, 1);
    return tex;
}

const crowdTexVariants = [
    generateCrowdTexture(0),
    generateCrowdTexture(3),
    generateCrowdTexture(7),
    generateCrowdTexture(11)
];
const crowdTex = crowdTexVariants[0];
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.88 });
const seatMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.55 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.35, metalness: 0.75 });
const suiteMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x0f172a, roughness: 0.25, metalness: 0.8 });

// Photographic 360° Stadium Bowl Panorama Upper Backdrop (Uses assets/stadium.jpg, grounded at y = 0)
const stadiumPanoTex = pbrTextureLoader.load('assets/stadium.jpg');
stadiumPanoTex.wrapS = THREE.RepeatWrapping;
stadiumPanoTex.repeat.set(2, 1);
const panoBowlGeo = new THREE.CylinderGeometry(78, 66, 38, 64, 1, true);
const panoBowlMat = new THREE.MeshBasicMaterial({
    map: stadiumPanoTex,
    side: THREE.BackSide,
    toneMapped: true
});
panoBowlMat.color.setRGB(0.22, 0.28, 0.42);
const panoBowlMesh = new THREE.Mesh(panoBowlGeo, panoBowlMat);
panoBowlMesh.position.set(0, 19.0, -10);
stadium.add(panoBowlMesh);

// Pitch-Perimeter Concrete Moat Wall behind hoardings (flush on y = 0)
const moatWallMat = new THREE.MeshStandardMaterial({ color: 0x0b1120, roughness: 0.85, metalness: 0.15 });
const moatWall = new THREE.Mesh(new THREE.BoxGeometry(116, 1.25, 0.6), moatWallMat);
moatWall.position.set(0, 0.625, -25.2);
stadium.add(moatWall);

// Center Vomitory Player Tunnel Recessed Below Goal Crossbar (Never pokes above crossbar as a black box)
const tunnelOpening = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 1.85, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x0b1324, roughness: 0.9 })
);
tunnelOpening.position.set(0, 0.925, -26.2);
stadium.add(tunnelOpening);

const tunnelArch = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.28, 1.4),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.45, metalness: 0.55 })
);
tunnelArch.position.set(0, 1.92, -25.4);
stadium.add(tunnelArch);

const sharedCrowdMat = new THREE.MeshStandardMaterial({
    map: crowdTex,
    roughness: 0.88,
    metalness: 0.0
});

// North Stand Foundation Plinth & 14 Wide Stepped 3D Tiers grounded on y = 0 (eliminates NE/NW corner skybox gap)
const northPlinth = new THREE.Mesh(new THREE.BoxGeometry(116, 1.15, 2.5), concreteMat);
northPlinth.position.set(0, 0.575, -25.6);
stadium.add(northPlinth);

for (let t = 0; t < 14; t++) {
    const w = 116 + t * 3.6;
    const tierDepth = 2.5;
    const tierH = 1.42;
    const tierZ = -25.6 - t * 2.25;
    const tierY = 1.15 + t * 1.38;

    const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, tierDepth), concreteMat);
    step.position.set(0, tierY, tierZ);
    stadium.add(step);

    // Per-tier phase shift & atmospheric upper-bowl falloff so tiers never align vertically like uniform toy pegs
    const tierTex = crowdTexVariants[t % crowdTexVariants.length].clone();
    tierTex.needsUpdate = true;
    tierTex.wrapS = THREE.RepeatWrapping;
    tierTex.repeat.set(5 + (t % 2) * 0.35, 1);
    tierTex.offset.x = (t * 0.29) % 1.0;
    const falloff = Math.max(0.32, 0.92 - t * 0.042);
    const tierCrowdMat = new THREE.MeshStandardMaterial({
        map: tierTex,
        color: new THREE.Color(falloff, falloff, falloff * 1.04),
        roughness: 0.88,
        metalness: 0.0
    });

    const riser = new THREE.Mesh(new THREE.PlaneGeometry(w, tierH * 1.12), tierCrowdMat);
    riser.position.set(0, tierY + tierH * 0.52, tierZ + tierDepth * 0.48);
    riser.rotation.x = 0.14;
    stadium.add(riser);

    const seatRow = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.18, 0.38), seatMat);
    seatRow.position.set(0, tierY + 0.22, tierZ - 0.35);
    stadium.add(seatRow);
}

// Subtle Recessed Safety Handrails along Radial Aisles (no bulky protruding grey boxes!)
const stairRailMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.45, metalness: 0.55 });
[-30, -15, 15, 30].forEach(aisleX => {
    for (let t = 1; t < 13; t += 2) {
        const tierZ = -25.6 - t * 2.25 + 1.18;
        const tierY = 1.15 + t * 1.38 + 0.55;
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.95, 0.12), stairRailMat);
        rail.position.set(aisleX, tierY, tierZ);
        rail.rotation.x = 0.14;
        stadium.add(rail);
    }
});

// Waving 3D Supporter Flags in the North Stand (Rich non-clipping colors anchored into terrace steps)
function createNationalFlagTexture(code) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (code === 'FRA') {
        ctx.fillStyle = '#002395'; ctx.fillRect(0, 0, 85, 160);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(85, 0, 86, 160);
        ctx.fillStyle = '#dc2626'; ctx.fillRect(171, 0, 85, 160);
    } else if (code === 'BRA') {
        ctx.fillStyle = '#00843d'; ctx.fillRect(0, 0, 256, 160);
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.moveTo(128, 18); ctx.lineTo(232, 80); ctx.lineTo(128, 142); ctx.lineTo(24, 80);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1e3a8a';
        ctx.beginPath(); ctx.arc(128, 80, 34, 0, Math.PI * 2); ctx.fill();
    } else if (code === 'ENG') {
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, 0, 256, 160);
        ctx.fillStyle = '#b91c1c';
        ctx.fillRect(104, 0, 48, 160);
        ctx.fillRect(0, 58, 256, 44);
    } else if (code === 'ARG') {
        ctx.fillStyle = '#0284c7'; ctx.fillRect(0, 0, 256, 53);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, 53, 256, 54);
        ctx.fillStyle = '#0284c7'; ctx.fillRect(0, 107, 256, 53);
        ctx.fillStyle = '#d97706';
        ctx.beginPath(); ctx.arc(128, 80, 18, 0, Math.PI * 2); ctx.fill();
    } else if (code === 'ESP') {
        ctx.fillStyle = '#991b1b'; ctx.fillRect(0, 0, 256, 40);
        ctx.fillStyle = '#d97706'; ctx.fillRect(0, 40, 256, 80);
        ctx.fillStyle = '#991b1b'; ctx.fillRect(0, 120, 256, 40);
    } else {
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, 256, 53);
        ctx.fillStyle = '#b91c1c'; ctx.fillRect(0, 53, 256, 54);
        ctx.fillStyle = '#eab308'; ctx.fillRect(0, 107, 256, 53);
    }
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 156);
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
const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 });
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
        roughness: 0.88,
        metalness: 0.0
    });
    const fMesh = new THREE.Mesh(fGeo, fMat);
    fMesh.position.set(0, 0.85, 0);
    flagGroup.add(fMesh);
    flagGroup.position.set(fc.x, fc.y, fc.z);
    stadium.add(flagGroup);
    wavingFlags.push({ mesh: fMesh, orig: fGeo.attributes.position.array.slice(), phase: fc.phase });
});
window.wavingFlags = wavingFlags;

// Upper Executive VIP Hospitality Fascia & Grounded Roof Support Columns (160m wide so corners never clip)
const suiteBox = new THREE.Mesh(new THREE.BoxGeometry(164, 4.2, 5.0), concreteMat);
suiteBox.position.set(0, 22.2, -58.5);
stadium.add(suiteBox);
for (let s = 0; s < 24; s++) {
    const windowMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.9), suiteMat);
    windowMesh.position.set(-59.8 + s * 5.2, 22.2, -55.9);
    stadium.add(windowMesh);
}

const northRoof = new THREE.Mesh(new THREE.BoxGeometry(172, 1.4, 42), roofMat);
northRoof.position.set(0, 27.5, -46);
stadium.add(northRoof);

// Rear Steel Support Columns grounding the North Roof & VIP Box cleanly to y = 0
const roofSupportColMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.70 });
[-52, -26, 0, 26, 52].forEach(colX => {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 27.5, 12), roofSupportColMat);
    col.position.set(colX, 13.75, -59.0);
    stadium.add(col);
});

// North Stand Roof Fascia Suspended Broadcast LED Floodlight Banks (Matches 2K Target Render 1 & 2)
(function buildNorthRoofFloodlightBanks() {
    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const gCtx = glowCanvas.getContext('2d');
    const rad = gCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
    rad.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
    rad.addColorStop(0.28, 'rgba(224, 242, 254, 0.55)');
    rad.addColorStop(0.65, 'rgba(147, 197, 253, 0.16)');
    rad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');
    gCtx.fillStyle = rad;
    gCtx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(glowCanvas);

    const roofGlowMat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const bankHousingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.75 });
    const ledCellMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ledCellGeo = new THREE.PlaneGeometry(0.85, 0.48);

    const bankXs = [-42, -30, -18, -6, 6, 18, 30, 42];
    bankXs.forEach(bx => {
        const bankGroup = new THREE.Group();
        const housing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.35, 0.55), bankHousingMat);
        bankGroup.add(housing);

        for (let r = -1; r <= 1; r++) {
            for (let c = -1.5; c <= 1.5; c += 1.0) {
                const cell = new THREE.Mesh(ledCellGeo, ledCellMat);
                cell.position.set(c * 0.96, r * 0.38, 0.29);
                bankGroup.add(cell);
            }
        }

        const halo = new THREE.Sprite(roofGlowMat);
        halo.scale.set(11.0, 5.8, 1.0);
        halo.position.set(0, -0.1, 0.85);
        bankGroup.add(halo);

        bankGroup.position.set(bx, 17.8, -47.0);
        bankGroup.rotation.x = 0.34;
        stadium.add(bankGroup);
    });
})();

// South Stand & Flanking East/West Grandstands grounded at y = 0
const southPlinth = new THREE.Mesh(new THREE.BoxGeometry(72, 1.1, 2.4), concreteMat);
southPlinth.position.set(0, 0.55, 20);
stadium.add(southPlinth);

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

[-36, 36].forEach(px => {
    const sidePlinth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.1, 96), concreteMat);
    sidePlinth.position.set(px, 0.55, -8);
    stadium.add(sidePlinth);
});

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

// Sideline Team Dugouts grounded at y = 0
const dugoutCanopyMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.40, roughness: 0.2 });
[-34.8, 34.8].forEach((dx, dIdx) => {
    const dugout = new THREE.Group();
    const basePad = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 9.2), concreteMat);
    basePad.position.set(0, 0.04, 0);
    dugout.add(basePad);

    const shelter = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 9.0, 16, 1, false, 0, Math.PI), dugoutCanopyMat);
    shelter.rotation.z = Math.PI / 2;
    shelter.rotation.y = dIdx === 0 ? Math.PI / 2 : -Math.PI / 2;
    shelter.position.set(0, 1.4, 0);
    dugout.add(shelter);

    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 8.2), seatMat);
    bench.position.set(dIdx === 0 ? -0.4 : 0.4, 0.225, 0);
    dugout.add(bench);

    dugout.position.set(dx, 0, -8);
    stadium.add(dugout);
});

// 4 High-Intensity Steel Lattice Floodlight Mast Arrays grounded at y = 0
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
    // Concrete footing pad at y = 0
    const footing = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.5, 4.4), concreteMat);
    footing.position.set(pos.x, 0.25, pos.z);
    stadium.add(footing);

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

// ============================================================================
// STATIC MATTE INTERNATIONAL PERIMETER HOARDING (ZERO SCROLLING / ZERO GLOW)
// ============================================================================
window.updateAdBoard = function () {};

function renderStaticHoardingCanvas(canvas, bgImg) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Deep non-distracting architectural navy/slate matte background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0b1324');
    bgGrad.addColorStop(0.5, '#111c33');
    bgGrad.addColorStop(1, '#070c18');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Tile Nano Banana 2K static hoarding background texture across 4 proportional panels (avoiding horizontal stretch)
    if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.28;
        const tiles = 4;
        const tileW = W / tiles;
        for (let t = 0; t < tiles; t++) {
            ctx.drawImage(bgImg, t * tileW, 0, tileW, H);
        }
        ctx.restore();
    }

    // Draw 3 crisp, un-stretched sponsor/training modules per 2048x256 ribbon (repeated 4x over 72m = 18m per ribbon, 6m per module)
    const panels = [
        { badge: 'FIFA PRO', title: 'INTERNATIONAL TRAINING', accent: '#facc15' },
        { badge: 'ARENA 01', title: 'PRECISION STRIKE DRILL', accent: '#38bdf8' },
        { badge: 'OFFICIAL', title: 'CHAMPIONS MATCH BALL', accent: '#22c55e' }
    ];
    const panelW = W / panels.length;

    // Scale X by 0.42 to pre-compensate for 18m:1.05m world aspect vs 8:1 canvas aspect so letters appear 1:1 square in 3D!
    for (let i = 0; i < panels.length; i++) {
        const p = panels[i];
        const px = i * panelW;

        // Module frame & gold/cyan accent bar
        ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
        ctx.fillRect(px + 12, 18, panelW - 24, H - 36);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
        ctx.lineWidth = 4;
        ctx.strokeRect(px + 12, 18, panelW - 24, H - 36);

        ctx.fillStyle = p.accent;
        ctx.fillRect(px + 16, 22, 14, H - 44);
        ctx.fillRect(px + panelW - 30, 22, 14, H - 44);

        ctx.save();
        ctx.translate(px + panelW * 0.5, H * 0.5);
        ctx.scale(0.46, 1.0);
        ctx.fillStyle = p.accent;
        ctx.font = '800 34px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.badge, 0, -48);

        ctx.fillStyle = '#f8fafc';
        ctx.font = '900 54px system-ui, -apple-system, sans-serif';
        ctx.fillText(p.title, 0, 22);
        ctx.restore();
    }

    // Top & bottom architectural trim lines
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, W, 8);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, H - 10, W, 10);
}

function generateStaticHoardingFallbackCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 256;
    renderStaticHoardingCanvas(canvas, null);
    return canvas;
}

const hoardingFallbackCanvas = generateStaticHoardingFallbackCanvas();
const hoardingStaticTex = new THREE.CanvasTexture(hoardingFallbackCanvas);
hoardingStaticTex.wrapS = THREE.RepeatWrapping;
hoardingStaticTex.wrapT = THREE.ClampToEdgeWrapping;
hoardingStaticTex.repeat.set(4, 1);
hoardingStaticTex.anisotropy = 8;

// Freeze offset.x at 0 so any legacy loop reference cannot scroll the hoarding
const frozenOffset = new THREE.Vector2(0, 0);
Object.defineProperty(frozenOffset, 'x', {
    get: function () { return 0; },
    set: function () { /* no-op: static hoarding never scrolls */ }
});
hoardingStaticTex.offset = frozenOffset;

// Load Nano Banana 2K static hoarding texture onto the canvas texture while keeping aspect ratio & offset locked
const hoardingImg = new Image();
hoardingImg.crossOrigin = 'anonymous';
hoardingImg.onload = function () {
    renderStaticHoardingCanvas(hoardingFallbackCanvas, hoardingImg);
    hoardingStaticTex.needsUpdate = true;
};
hoardingImg.src = 'assets/textures/hoarding_static_2k.jpg';

// Keep `adTex` alias pointing to static texture with locked offset so nothing breaks or scrolls
const adTex = hoardingStaticTex;
window.adTex = adTex;

const adMat = new THREE.MeshStandardMaterial({
    map: hoardingStaticTex,
    roughness: 0.78,
    metalness: 0.06
});
window.adMat = adMat;

const adCasingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.78,
    metalness: 0.18
});
const adTopRailMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.35,
    metalness: 0.55
});
const aFrameStrutMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.48,
    metalness: 0.72
});

const hoardingGroup = new THREE.Group();
window.hoardingGroup = hoardingGroup;

// North Goal-Line Static Matte Perimeter Hoarding at z = -23.1
// Board height = 1.05m, center y = 0.525 -> bottom edge sits flush at y = 0.0
const northAdGroup = new THREE.Group();
const northAd = new THREE.Mesh(new THREE.BoxGeometry(72, 1.05, 0.16), [
    adCasingMat, adCasingMat, adTopRailMat, adCasingMat, adMat, adCasingMat
]);
northAd.position.set(0, 0.525, 0);
northAd.castShadow = true;
northAd.receiveShadow = true;
northAdGroup.add(northAd);

// Crisp 3D Top Coping Rail & Grounded Base Plinth so the vertical board silhouette reads unmistakably
const northTopCap = new THREE.Mesh(new THREE.BoxGeometry(72.2, 0.06, 0.24), adTopRailMat);
northTopCap.position.set(0, 1.06, -0.02);
northTopCap.castShadow = true;
northAdGroup.add(northTopCap);

const northBasePlinth = new THREE.Mesh(new THREE.BoxGeometry(72.2, 0.06, 0.26), adCasingMat);
northBasePlinth.position.set(0, 0.03, -0.02);
northBasePlinth.receiveShadow = true;
northAdGroup.add(northBasePlinth);

// Matte rubberized rear backing frame flush at y = 0.0
const northCasing = new THREE.Mesh(new THREE.BoxGeometry(72.2, 1.02, 0.10), adCasingMat);
northCasing.position.set(0, 0.51, -0.12);
northAdGroup.add(northCasing);

// Rear A-Frame Steel Support Struts grounded cleanly at y = 0.0
for (let sx = -34; sx <= 34; sx += 4.0) {
    const strutGroup = new THREE.Group();

    const baseRail = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.04, 0.68), aFrameStrutMat);
    baseRail.position.set(0, 0.02, -0.38);
    strutGroup.add(baseRail);

    const vertPost = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.96, 0.06), aFrameStrutMat);
    vertPost.position.set(0, 0.48, -0.18);
    strutGroup.add(vertPost);

    const diagStrut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.04, 0.06), aFrameStrutMat);
    diagStrut.position.set(0, 0.48, -0.44);
    diagStrut.rotation.x = 0.54;
    strutGroup.add(diagStrut);

    strutGroup.position.set(sx, 0, 0);
    northAdGroup.add(strutGroup);
}

northAdGroup.position.set(0, 0, -23.1);
hoardingGroup.add(northAdGroup);

// Left & Right Touchline Static Matte Perimeter Hoardings (height 1.05m, center y = 0.525, flush at y = 0.0)
[-34, 34].forEach(sideX => {
    const sideAdGroup = new THREE.Group();
    const sideSign = sideX < 0 ? -1 : 1;

    const sideAd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.05, 84), [
        adMat, adMat, adTopRailMat, adCasingMat, adCasingMat, adCasingMat
    ]);
    sideAd.position.set(0, 0.525, 0);
    sideAd.castShadow = true;
    sideAd.receiveShadow = true;
    sideAdGroup.add(sideAd);

    const sideTopCap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 84.2), adTopRailMat);
    sideTopCap.position.set(sideSign * 0.02, 1.06, 0);
    sideAdGroup.add(sideTopCap);

    const sideCasing = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.02, 84.2), adCasingMat);
    sideCasing.position.set(sideSign * 0.12, 0.51, 0);
    sideAdGroup.add(sideCasing);

    for (let sz = -40; sz <= 40; sz += 6.0) {
        const sStrut = new THREE.Group();
        const baseRail = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.10), aFrameStrutMat);
        baseRail.position.set(sideSign * 0.38, 0.02, 0);
        sStrut.add(baseRail);

        const diagStrut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.04, 0.06), aFrameStrutMat);
        diagStrut.position.set(sideSign * 0.44, 0.48, 0);
        diagStrut.rotation.z = sideSign * 0.54;
        sStrut.add(diagStrut);

        sStrut.position.set(0, 0, sz);
        sideAdGroup.add(sStrut);
    }

    sideAdGroup.position.set(sideX, 0, -8);
    hoardingGroup.add(sideAdGroup);
});

stadium.add(hoardingGroup);

// 16 Stadium Camera Flashbulbs
const flashGeo = new THREE.SphereGeometry(0.35, 8, 8);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
for (let i = 0; i < 16; i++) {
    const flash = new THREE.Mesh(flashGeo, flashMat.clone());
    flash.position.set((Math.random() - 0.5) * 62, 3.5 + Math.random() * 14, -27 - Math.random() * 16);
    stadium.add(flash);
    cameraFlashes.push({ mesh: flash, timer: Math.random() * 2.5 });
}

stadium.position.set(0, 0, 0);
scene.add(stadium);
