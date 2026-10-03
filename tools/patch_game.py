import re
import os

game_path = os.path.join(os.path.dirname(__file__), "..", "js", "game3d.js")
with open(game_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update Post Colliders with Woodwork sound and miss trigger
post_pattern = r"const addCylinderCollider = \(x, y, z, r, h, rotZ\) => \{.*?\};\s*addCylinderCollider\(-goalWidth / 2.*?\naddCylinderCollider\(0, postHeight.*?\n"
new_post = '''let shotSafetyTimer = null;

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
                    finishShot('miss', 'OFF THE POST!', 'DENIED BY WOODWORK', '#ef4444');
                }
            }, 600);
        }
    });
    world.addBody(b);
};
addCylinderCollider(-goalWidth / 2, postHeight / 2, -20, postRadius, postHeight);
addCylinderCollider(goalWidth / 2, postHeight / 2, -20, postRadius, postHeight);
addCylinderCollider(0, postHeight, -20, postRadius, goalWidth, Math.PI / 2);
'''
content = re.sub(post_pattern, new_post, content, flags=re.DOTALL)
print("SUCCESS: Post colliders updated with woodwork listener!")

# 2. Update Goalkeeper & Wall models with refined anatomical proportions
sec7_pattern = r"(// =+\s*// 7\. HIGH-FIDELITY ATHLETIC 3D GOALKEEPER & DEFENSIVE WALL RIG.*?)(// =+\s*// 9\. TARGET RACE TARGETS)"

new_sec7_8 = '''// ============================================================================
// 7. HIGH-FIDELITY ATHLETIC 3D GOALKEEPER & DEFENSIVE WALL RIG
// ============================================================================

// Procedural Pro Jersey Texture (Volt Emerald with Squad #1 & Crest)
function createKeeperJerseyTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base Volt Emerald Neon Gradient
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0, '#10b981'); grad.addColorStop(1, '#059669');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 1024, 1024);

    // Micro-mesh texture
    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    for (let y = 0; y < 1024; y += 12) {
        for (let x = 0; x < 1024; x += 12) {
            if ((x + y) % 24 === 0) ctx.fillRect(x, y, 6, 6);
        }
    }

    // Subtle dark athletic side panels
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, 200, 90, 824);
    ctx.fillRect(934, 200, 90, 824);

    // Dynamic thin diagonal accent stripes
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 14;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(120 + i * 40, 240);
        ctx.lineTo(240 + i * 40, 480);
        ctx.stroke();
    }

    // Gold & White Tournament Crest Shield on left chest
    ctx.save();
    ctx.translate(330, 260);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(0, -45); ctx.lineTo(38, -18); ctx.lineTo(34, 35); ctx.lineTo(0, 55); ctx.lineTo(-34, 35); ctx.lineTo(-38, -18);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('GK', 0, 8);
    ctx.restore();

    // Sponsor Logo "STRIKE AERO" across chest
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STRIKE AERO', 512, 440);

    // Front Squad Number "1"
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 100px sans-serif';
    ctx.fillText('1', 512, 340);

    // Back Squad Number "1" & Name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('STRIKE', 512, 680);
    ctx.font = '900 240px sans-serif';
    ctx.fillText('1', 512, 910);

    return new THREE.CanvasTexture(canvas);
}

// Procedural Crimson Away Kit Jersey Texture for Defensive Wall
function createWallJerseyTexture(numberStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Rich saturated Crimson red fabric
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 0, 512, 512);

    // Dark Navy Athletic Diagonal Sash
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(0, 60); ctx.lineTo(512, 340); ctx.lineTo(512, 430); ctx.lineTo(0, 150);
    ctx.closePath(); ctx.fill();

    // White trim collar
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 24);
    ctx.fillRect(170, 24, 172, 16);

    // Squad Number on Back
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 140px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(numberStr, 256, 380);

    return new THREE.CanvasTexture(canvas);
}

// Articulated Pro Latex Gloves Function (Negative-Cut with 5 articulated fingers)
function createProGloveGroup() {
    const glove = new THREE.Group();

    // 1. Neoprene Wrist Strap & Embossed Fastener
    const strapMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 });
    const strap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.09, 16), strapMat);
    glove.add(strap);

    const pullTab = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.045, 0.015), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 }));
    pullTab.position.set(0, -0.035, 0.08);
    glove.add(pullTab);

    // 2. Thick 4mm German Contact Latex Palm
    const palmMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.25, metalness: 0.15 });
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.065), palmMat);
    palm.position.set(0, 0.11, 0);
    glove.add(palm);

    // 3. Backhand Punch-Zone (3D Embossed Silicone Grip Ribs)
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.3 });
    for (let r = 0; r < 3; r++) {
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.025), ribMat);
        rib.position.set(0, 0.07 + r * 0.045, -0.04);
        glove.add(rib);
    }

    // 4. 5 Individually Sculpted Negative-Cut Fingers + Thumb
    const fingerMat = palmMat;
    const fingerHeights = [0.08, 0.098, 0.105, 0.088]; // Index, Middle, Ring, Pinky
    for (let f = 0; f < 4; f++) {
        const h = fingerHeights[f];
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, h, 10), fingerMat);
        finger.position.set(-0.052 + f * 0.035, 0.20 + h * 0.5, 0);
        glove.add(finger);
    }

    // Wrap-around thumb
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.016, 0.078, 10), fingerMat);
    thumb.position.set(-0.08, 0.11, 0.02);
    thumb.rotation.z = 0.55;
    glove.add(thumb);

    return glove;
}

// Master High-Poly Anatomical Player Mesh Sculptor
function createSculptedProPlayer(options) {
    const {
        isGoalkeeper = false,
        jerseyTexture,
        shortsColor = 0x0f172a,
        sockColor = 0x10b981,
        skinTone = 0xdf9d76,
        hairColor = 0x1c1917,
        wallPose = false
    } = options;

    const playerGroup = new THREE.Group();
    const spine = new THREE.Group();
    playerGroup.add(spine);

    // Materials
    const skinMat = new THREE.MeshStandardMaterial({ color: skinTone, roughness: 0.55, metalness: 0.05 });
    const jerseyMat = new THREE.MeshStandardMaterial({ map: jerseyTexture, roughness: 0.45, metalness: 0.1 });
    const shortsMat = new THREE.MeshStandardMaterial({ color: shortsColor, roughness: 0.65 });
    const compressionMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.5 });
    const sockMat = new THREE.MeshStandardMaterial({ color: sockColor, roughness: 0.5 });
    const bootUpperMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.2 });
    const bootVoltMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
    const chromePlateMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.15 });
    const studMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });

    // --- 1. TORSO & JERSEY (Contoured Athletic V-Taper) ---
    const torsoGeo = new THREE.CylinderGeometry(0.31, 0.24, 0.64, 24);
    const torsoMesh = new THREE.Mesh(torsoGeo, jerseyMat);
    torsoMesh.scale.set(1.18, 1.0, 0.65);
    torsoMesh.position.y = 1.36;
    torsoMesh.castShadow = true;
    spine.add(torsoMesh);

    // Deltoids (Athletic Shoulder Caps)
    const deltoidGeo = new THREE.SphereGeometry(0.115, 18, 18);
    const lDeltoid = new THREE.Mesh(deltoidGeo, jerseyMat);
    lDeltoid.position.set(-0.34, 1.58, 0);
    lDeltoid.castShadow = true;
    spine.add(lDeltoid);

    const rDeltoid = new THREE.Mesh(deltoidGeo, jerseyMat);
    rDeltoid.position.set(0.34, 1.58, 0);
    rDeltoid.castShadow = true;
    spine.add(rDeltoid);

    // --- 2. NECK & HEAD SCULPTING (Natural Pro Facial Structure) ---
    const neckGeo = new THREE.CylinderGeometry(0.085, 0.105, 0.18, 18);
    const neck = new THREE.Mesh(neckGeo, skinMat);
    neck.position.set(0, 1.74, 0.02);
    neck.rotation.x = 0.06;
    neck.castShadow = true;
    spine.add(neck);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 1.90, 0.04);
    spine.add(headGroup);

    // Cranium
    const craniumGeo = new THREE.SphereGeometry(0.165, 24, 24);
    const cranium = new THREE.Mesh(craniumGeo, skinMat);
    cranium.scale.set(0.95, 1.12, 1.02);
    cranium.castShadow = true;
    headGroup.add(cranium);

    // Chiseled Jawline & Chin Wedge
    const jawGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.13, 16);
    const jaw = new THREE.Mesh(jawGeo, skinMat);
    jaw.scale.set(1.0, 1.0, 0.72);
    jaw.position.set(0, -0.09, 0.05);
    jaw.rotation.x = 0.22;
    headGroup.add(jaw);

    // 3D Eyebrows (Dark Athletic Cut)
    const browMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
    const lBrow = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.016, 0.025), browMat);
    lBrow.position.set(-0.052, 0.04, 0.16);
    lBrow.rotation.z = -0.08;
    headGroup.add(lBrow);

    const rBrow = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.016, 0.025), browMat);
    rBrow.position.set(0.052, 0.04, 0.16);
    rBrow.rotation.z = 0.08;
    headGroup.add(rBrow);

    // 3D Eyes (Sclera + Hazel Iris + Black Pupil + Specular Glint)
    const scleraMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    const irisMat = new THREE.MeshBasicMaterial({ color: 0x451a03 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    [-1, 1].forEach(side => {
        const eyeGroup = new THREE.Group();
        eyeGroup.position.set(side * 0.052, 0.005, 0.145);

        const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.022, 14, 14), scleraMat);
        eyeGroup.add(sclera);

        const iris = new THREE.Mesh(new THREE.CircleGeometry(0.012, 14), irisMat);
        iris.position.z = 0.021;
        eyeGroup.add(iris);

        const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), pupilMat);
        pupil.position.z = 0.022;
        eyeGroup.add(pupil);

        const glint = new THREE.Mesh(new THREE.CircleGeometry(0.003, 8), glintMat);
        glint.position.set(0.004, 0.004, 0.023);
        eyeGroup.add(glint);

        headGroup.add(eyeGroup);
    });

    // 3D Sculpted Nose
    const noseBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.024, 0.07, 10), skinMat);
    noseBridge.position.set(0, -0.01, 0.155);
    noseBridge.rotation.x = -0.15;
    headGroup.add(noseBridge);

    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), skinMat);
    noseTip.position.set(0, -0.045, 0.17);
    headGroup.add(noseTip);

    // 3D Mouth & Lips
    const lipMat = new THREE.MeshStandardMaterial({ color: 0xb56958, roughness: 0.65 });
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.016, 0.022), lipMat);
    mouth.position.set(0, -0.092, 0.145);
    headGroup.add(mouth);

    // 3D Ears
    [-1, 1].forEach(side => {
        const ear = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.011, 8, 16, Math.PI * 1.2), skinMat);
        ear.position.set(side * 0.155, 0.01, 0.01);
        ear.rotation.y = side * Math.PI / 2;
        ear.rotation.x = -0.15;
        headGroup.add(ear);
    });

    // Modern High Skin Fade & Textured Top Haircut
    const hairBaseMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.95 });
    const fadeUndersphere = new THREE.Mesh(new THREE.SphereGeometry(0.168, 20, 20), hairBaseMat);
    fadeUndersphere.scale.set(0.96, 1.13, 0.98);
    fadeUndersphere.position.set(0, 0.02, -0.01);
    headGroup.add(fadeUndersphere);

    const hairTopMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.85, metalness: 0.15 });
    const topHair = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 16), hairTopMat);
    topHair.scale.set(1.05, 0.65, 1.18);
    topHair.position.set(0, 0.11, 0.02);
    headGroup.add(topHair);

    // --- 3. SHORTS, PELVIS & COMPRESSION BASE ---
    const pelvisGeo = new THREE.CylinderGeometry(0.26, 0.24, 0.24, 24);
    const pelvis = new THREE.Mesh(pelvisGeo, shortsMat);
    pelvis.scale.set(1.18, 1.0, 0.70);
    pelvis.position.y = 0.92;
    pelvis.castShadow = true;
    playerGroup.add(pelvis);

    // Left & Right Shorts Leg Cuffs
    const shortsLegGeo = new THREE.CylinderGeometry(0.15, 0.165, 0.28, 16);
    const lShortsLeg = new THREE.Mesh(shortsLegGeo, shortsMat);
    lShortsLeg.position.set(-0.18, 0.80, 0);
    lShortsLeg.castShadow = true;
    playerGroup.add(lShortsLeg);

    const rShortsLeg = new THREE.Mesh(shortsLegGeo, shortsMat);
    rShortsLeg.position.set(0.18, 0.80, 0);
    rShortsLeg.castShadow = true;
    playerGroup.add(rShortsLeg);

    // Visible Pro Compression Base Layer
    const compLegGeo = new THREE.CylinderGeometry(0.135, 0.125, 0.10, 16);
    const lComp = new THREE.Mesh(compLegGeo, compressionMat);
    lComp.position.set(-0.18, 0.65, 0);
    playerGroup.add(lComp);

    const rComp = new THREE.Mesh(compLegGeo, compressionMat);
    rComp.position.set(0.18, 0.65, 0);
    playerGroup.add(rComp);

    // --- 4. MUSCULAR LEGS, PRO SOCKS & SPEED CLEATS ---
    const thighGeo = new THREE.CylinderGeometry(0.12, 0.098, 0.34, 16);
    const lThigh = new THREE.Mesh(thighGeo, skinMat);
    lThigh.position.set(-0.18, 0.52, 0);
    lThigh.castShadow = true;
    playerGroup.add(lThigh);

    const rThigh = new THREE.Mesh(thighGeo, skinMat);
    rThigh.position.set(0.18, 0.52, 0);
    rThigh.castShadow = true;
    playerGroup.add(rThigh);

    // Knee Patella
    const patellaGeo = new THREE.SphereGeometry(0.075, 14, 14);
    const lKnee = new THREE.Mesh(patellaGeo, skinMat);
    lKnee.position.set(-0.18, 0.35, 0.02);
    playerGroup.add(lKnee);

    const rKnee = new THREE.Mesh(patellaGeo, skinMat);
    rKnee.position.set(0.18, 0.35, 0.02);
    playerGroup.add(rKnee);

    // Pro Match Socks
    const sockGeo = new THREE.CylinderGeometry(0.09, 0.07, 0.35, 16);
    const lSock = new THREE.Mesh(sockGeo, sockMat);
    lSock.position.set(-0.18, 0.18, 0);
    lSock.castShadow = true;
    playerGroup.add(lSock);

    const rSock = new THREE.Mesh(sockGeo, sockMat);
    rSock.position.set(0.18, 0.18, 0);
    rSock.castShadow = true;
    playerGroup.add(rSock);

    // Pro Speed Cleats (Streamlined boots with chrome heel cup & 6 studs)
    function createProCleat() {
        const boot = new THREE.Group();
        const bootUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.26, 14), bootUpperMat);
        bootUpper.rotation.x = Math.PI / 2;
        bootUpper.scale.set(0.95, 0.65, 1.15);
        bootUpper.position.set(0, 0.045, 0.04);
        bootUpper.castShadow = true;
        boot.add(bootUpper);

        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.15), bootVoltMat);
        stripe.position.set(0, 0.05, 0.04);
        boot.add(stripe);

        const heel = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), chromePlateMat);
        heel.position.set(0, 0.045, -0.06);
        heel.scale.set(0.9, 0.8, 0.9);
        boot.add(heel);

        for (let s = 0; s < 6; s++) {
            const sx = (s % 2 === 0 ? -1 : 1) * 0.04;
            const sz = -0.07 + Math.floor(s / 2) * 0.09;
            const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.022, 8), studMat);
            stud.position.set(sx, 0.01, sz);
            boot.add(stud);
        }
        return boot;
    }

    const lBoot = createProCleat();
    lBoot.position.set(-0.18, 0, 0);
    playerGroup.add(lBoot);

    const rBoot = createProCleat();
    rBoot.position.set(0.18, 0, 0);
    playerGroup.add(rBoot);

    // --- 5. ARMS, GLOVES & STANCE ---
    const armGeo = new THREE.CylinderGeometry(0.075, 0.065, 0.34, 14);
    const foreArmGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.30, 14);

    const lArmGroup = new THREE.Group();
    lArmGroup.position.set(-0.34, 1.58, 0);
    spine.add(lArmGroup);

    const rArmGroup = new THREE.Group();
    rArmGroup.position.set(0.34, 1.58, 0);
    spine.add(rArmGroup);

    if (isGoalkeeper) {
        // Goalkeeper Ready Stance: Hands forward, elbows bent, open palms facing shooter
        const lUpper = new THREE.Mesh(armGeo, jerseyMat);
        lUpper.position.set(-0.05, -0.15, 0.04);
        lUpper.rotation.set(-0.35, 0, 0.30);
        lArmGroup.add(lUpper);

        const lFore = new THREE.Mesh(foreArmGeo, skinMat);
        lFore.position.set(-0.12, -0.38, 0.16);
        lFore.rotation.set(-0.72, 0, 0.15);
        lArmGroup.add(lFore);

        const lGlove = createProGloveGroup();
        lGlove.position.set(-0.14, -0.52, 0.28);
        lGlove.rotation.set(-0.55, 0.2, 0.1);
        lArmGroup.add(lGlove);

        const rUpper = new THREE.Mesh(armGeo, jerseyMat);
        rUpper.position.set(0.05, -0.15, 0.04);
        rUpper.rotation.set(-0.35, 0, -0.30);
        rArmGroup.add(rUpper);

        const rFore = new THREE.Mesh(foreArmGeo, skinMat);
        rFore.position.set(0.12, -0.38, 0.16);
        rFore.rotation.set(-0.72, 0, -0.15);
        rArmGroup.add(rFore);

        const rGlove = createProGloveGroup();
        rGlove.position.set(0.14, -0.52, 0.28);
        rGlove.rotation.set(-0.55, -0.2, -0.1);
        rArmGroup.add(rGlove);
    } else {
        // Wall Defender Stance: Arms crossed tight over torso / groin protecting body
        const lUpper = new THREE.Mesh(armGeo, jerseyMat);
        lUpper.position.set(-0.04, -0.15, 0.06);
        lUpper.rotation.set(0.35, 0.2, -0.45);
        lArmGroup.add(lUpper);

        const lFore = new THREE.Mesh(foreArmGeo, skinMat);
        lFore.position.set(0.09, -0.35, 0.14);
        lFore.rotation.set(0.15, 0.3, -1.25);
        lArmGroup.add(lFore);

        const rUpper = new THREE.Mesh(armGeo, jerseyMat);
        rUpper.position.set(0.04, -0.15, 0.06);
        rUpper.rotation.set(0.35, -0.2, 0.45);
        rArmGroup.add(rUpper);

        const rFore = new THREE.Mesh(foreArmGeo, skinMat);
        rFore.position.set(-0.09, -0.35, 0.14);
        rFore.rotation.set(0.15, -0.3, 1.25);
        rArmGroup.add(rFore);

        const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), skinMat);
        lHand.position.set(0.22, -0.40, 0.16);
        lArmGroup.add(lHand);

        const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 10), skinMat);
        rHand.position.set(-0.22, -0.40, 0.16);
        rArmGroup.add(rHand);
    }

    return {
        root: playerGroup,
        spine: spine,
        head: headGroup,
        leftArm: lArmGroup,
        rightArm: rArmGroup
    };
}

// Instantiation: Goalkeeper Rig
const gkJerseyTex = createKeeperJerseyTexture();
const gkRig = createSculptedProPlayer({
    isGoalkeeper: true,
    squadNumber: '1',
    jerseyTexture: gkJerseyTex,
    shortsColor: 0x0f172a,
    sockColor: 0x10b981,
    skinTone: 0xdf9d76,
    hairColor: 0x18181b,
    wallPose: false
});
const gkGroup = gkRig.root;
const gkSpine = gkRig.spine;
const gkLeftArmGroup = gkRig.leftArm;
const gkRightArmGroup = gkRig.rightArm;
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

// Instantiation: Defensive Wall (3 Athletic Crimson Away Kit Defenders #4, #5, #6)
const wallGroup = new THREE.Group();
wallGroup.position.set(0, 0, -13.5);
const wallBodies = [];
const wallSquadNumbers = ['4', '5', '6'];

for (let i = 0; i < 3; i++) {
    const w = i - 1; // -1, 0, 1
    const xOffset = w * 0.85;
    const wallJerseyTex = createWallJerseyTexture(wallSquadNumbers[i]);
    const defenderRig = createSculptedProPlayer({
        isGoalkeeper: false,
        squadNumber: wallSquadNumbers[i],
        jerseyTexture: wallJerseyTex,
        shortsColor: 0x0f172a,
        sockColor: 0x991b1b,
        skinTone: (i === 1 ? 0xc6865d : (i === 2 ? 0x8d5524 : 0xdf9d76)),
        hairColor: (i === 1 ? 0x3d2314 : 0x18181b),
        wallPose: true
    });
    const defender = defenderRig.root;
    defender.position.set(xOffset, 0, 0);
    wallGroup.add(defender);

    const dummyBody = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(0.38, 0.95, 0.24)),
        position: new CANNON.Vec3(xOffset, 0.95, -13.5),
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
            finishShot('miss', 'BLOCKED!', 'HIT THE DEFENSIVE WALL', '#ef4444');
        }
    });
    world.addBody(dummyBody);
    wallBodies.push(dummyBody);
}
scene.add(wallGroup);

'''

content = re.sub(sec7_pattern, new_sec7_8, content, flags=re.DOTALL)
print("SUCCESS: Refined Goalkeeper and Wall anatomy!")

# 3. Update finishShot to cancel shotSafetyTimer
finish_pattern = r"(function finishShot\(outcome, bannerMain, bannerSub, bannerColor\) \{)(.*?)(if \(bannerMain\) \{)"
new_finish = '''function finishShot(outcome, bannerMain, bannerSub, bannerColor) {
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    if (shotComplete) return;
    shotComplete = true;
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);

    '''
content = re.sub(finish_pattern, new_finish, content, flags=re.DOTALL)
print("SUCCESS: finishShot updated with safety timer cancellation!")

# 4. In Target Hit callback: set ballBody.scored = true
target_hit_pattern = r"(finishShot\('goal', bannerTxt, `\+\$\{totalPts\} PTS`, '#38bdf8'\);)"
new_target_hit = '''ballBody.scored = true;
                finishShot('goal', bannerTxt, `+${totalPts} PTS`, '#38bdf8');'''
content = re.sub(target_hit_pattern, new_target_hit, content)
print("SUCCESS: target hit updated with ballBody.scored = true!")

# 5. In executeShot: set safety timeout to 2000ms
timeout_pattern = r"setTimeout\(\(\) => \{\s*if \(ballInFlight && !shotComplete && isPlaying\) \{\s*if \(currentGameMode === 'duel' \|\| currentGameMode === 'practice'\) \{\s*finishShot\(ballBody\.scored \? 'goal' : 'miss', ballBody\.scored \? 'GOAL!' : 'OFF TARGET', '', ballBody\.scored \? '#22c55e' : '#ef4444'\);\s*\} else \{\s*finishShot\('complete'\);\s*setTimeout\(\(\) => \{ if \(currentGameMode === 'targets' && isPlaying\) resetBall\(\); \}, 600\);\s*\}\s*\}\s*\}, 2900\);"
new_timeout = '''if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    shotSafetyTimer = setTimeout(() => {
        if (ballInFlight && !shotComplete && isPlaying) {
            if (currentGameMode === 'duel' || currentGameMode === 'practice') {
                finishShot(ballBody.scored ? 'goal' : 'miss', ballBody.scored ? 'GOAL!' : 'OFF TARGET', '', ballBody.scored ? '#22c55e' : '#ef4444');
            } else {
                finishShot('complete');
                setTimeout(() => { if (currentGameMode === 'targets' && isPlaying) resetBall(); }, 600);
            }
        }
    }, 2000);'''
content = re.sub(timeout_pattern, new_timeout, content)
print("SUCCESS: executeShot safety timer updated to 2000ms!")

# 6. In resetBall: clear shotSafetyTimer
reset_timer_pattern = r"(window\.resetBall = function\(\) \{\s*if \(shotOutcomeTimer\) clearTimeout\(shotOutcomeTimer\);)"
new_reset_timer = '''window.resetBall = function() {
    if (shotSafetyTimer) clearTimeout(shotSafetyTimer);
    if (shotOutcomeTimer) clearTimeout(shotOutcomeTimer);'''
content = re.sub(reset_timer_pattern, new_reset_timer, content)
print("SUCCESS: resetBall updated with shotSafetyTimer clearance!")

# 7. In updateSimulation: Add ball rest detection for off-target resolution
enters_goal_pattern = r"(// Duel & Practice: Check Off-Target Miss.*?\n\s*if \(\(currentGameMode === 'duel' \|\| currentGameMode === 'practice'\).*?finishShot\('miss', 'OFF TARGET!', 'MISSED THE GOAL', '#ef4444'\);\s*\})"
new_off_target = '''// Duel & Practice: Check Off-Target Miss (passed goal plane without scoring or save)
    if ((currentGameMode === 'duel' || currentGameMode === 'practice') && ballInFlight && !ballBody.inNet && !ballBody.saved && !ballBody.scored) {
        if (ballBody.position.z < -20.05 || (ballBody.position.z < -13.0 && ballBody.velocity.length() < 0.25 && ballBody.position.y <= ballRadius + 0.05)) {
            streak = 0;
            updateHUD();
            sfx.playGasp();
            finishShot('miss', 'OFF TARGET!', 'MISSED THE GOAL', '#ef4444');
        }
    }'''
content = re.sub(enters_goal_pattern, new_off_target, content, flags=re.DOTALL)
print("SUCCESS: off-target miss check updated to immediately resolve!")

with open(game_path, "w", encoding="utf-8") as f:
    f.write(content)

print("ALL GAMEPATCHES COMPLETED SUCCESSFULLY!")
