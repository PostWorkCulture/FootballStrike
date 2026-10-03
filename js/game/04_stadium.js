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

