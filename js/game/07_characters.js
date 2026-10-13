// ============================================================================
// 7. HIGH-FIDELITY ATHLETIC 3D GOALKEEPER, DEFENSIVE WALL & STRIKER RIGS
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

// National Team & Club Kit Presets (Rich broadcast fabric tones that never blow out under floodlights)
const TEAM_PRESETS = {
    france:    { name: 'FRANCE',    code: 'FRA', flag: 'assets/france.jpg',    shirt: 0x1e3a8a, shorts: 0xe2e8f0, socks: 0xb91c1c, gkShirt: 0x0d9488, starName: 'MBAPPE',     starNum: 10, skin: 0x8d5534, hair: 0x0f0f12 },
    brazil:    { name: 'BRAZIL',    code: 'BRA', flag: 'assets/brazil.jpg',    shirt: 0xd99b06, shorts: 0x1d4ed8, socks: 0xe2e8f0, gkShirt: 0x0d9488, starName: 'VINICIUS',   starNum: 7,  skin: 0x7c4b2b, hair: 0x0f0f12 },
    argentina: { name: 'ARGENTINA', code: 'ARG', flag: 'assets/argentina.jpg', shirt: 0x0284c7, shorts: 0x0f172a, socks: 0xe2e8f0, gkShirt: 0xdc2626, starName: 'MESSI',      starNum: 10, skin: 0xd89c7a, hair: 0x23170f },
    england:   { name: 'ENGLAND',   code: 'ENG', flag: 'assets/england.jpg',   shirt: 0xe2e8f0, shorts: 0x1e3a8a, socks: 0xe2e8f0, gkShirt: 0xd97706, starName: 'BELLINGHAM', starNum: 10, skin: 0x8d5534, hair: 0x0f0f12 },
    spain:     { name: 'SPAIN',     code: 'ESP', flag: 'assets/spain.jpg',     shirt: 0xb91c1c, shorts: 0x1e3a8a, socks: 0xb91c1c, gkShirt: 0x0284c7, starName: 'YAMAL',      starNum: 19, skin: 0x9c623e, hair: 0x12100e },
    germany:   { name: 'GERMANY',   code: 'GER', flag: 'assets/germany.jpg',   shirt: 0xe2e8f0, shorts: 0x0f172a, socks: 0xe2e8f0, gkShirt: 0x15803d, starName: 'MUSIALA',    starNum: 10, skin: 0xc68863, hair: 0x18120e },
    portugal:  { name: 'PORTUGAL',  code: 'POR', flag: 'assets/portugal.jpg',  shirt: 0x991b1b, shorts: 0x065f46, socks: 0x991b1b, gkShirt: 0xd97706, starName: 'RONALDO',    starNum: 7,  skin: 0xd2946e, hair: 0x14100d },
    usa:       { name: 'USA',       code: 'USA', flag: 'assets/usa.jpg',       shirt: 0x1e293b, shorts: 0x1e293b, socks: 0xb91c1c, gkShirt: 0x7e22ce, starName: 'PULISIC',    starNum: 10, skin: 0xdca07c, hair: 0x382214 }
};
window.TEAM_PRESETS = TEAM_PRESETS;
window.selectedHomeTeam = 'france';
window.selectedAwayTeam = 'brazil';

// Instantiation: Goalkeeper Rig
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

// Legacy pose registry populated with state proxies for full test-suite compatibility
const gkPoseModels = {
    idle:            { visible: true },
    dive_right:      { visible: false },
    dive_left:       { visible: false },
    low_sweep_right: { visible: false },
    low_sweep_left:  { visible: false },
    parry:           { visible: false },
    recovery_roll:   { visible: false }
};
let gkAnimator = null;
const characterAnimators = [];

function prepCharacterMaterials(model) {
    model.traverse(n => {
        if (!n.isMesh) return;
        n.castShadow = true;
        n.receiveShadow = false; // Prevent directional shadow-map self-shadowing staircase acne on curved limbs
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach(m => {
            if (!m || !m.name) return;
            if (m.name.indexOf('kit_shirt') === 0 || m.name.indexOf('kit_shorts') === 0 || m.name.indexOf('kit_socks') === 0) {
                m.normalMap = null; m.roughness = 0.64; m.metalness = 0.02;
            } else if (m.name.indexOf('gk_gloves') === 0) {
                m.normalMap = null; m.roughness = 0.45;
            } else if (/Human\.body/i.test(m.name)) {
                m.map = null; m.aoMap = null; m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null;
                m.color.setRGB(0.76, 0.52, 0.38); m.roughness = 0.58; m.metalness = 0;
                m.transparent = false; m.opacity = 1; m.depthWrite = true; m.alphaTest = 0; m.needsUpdate = true;
            }
        });
    });
}

charGltfLoader.load('assets/goalkeeper.glb', (gltf) => {
    const model = gltf.scene;
    prepCharacterMaterials(model);
    model.rotation.y = Math.PI / 2; // face the striker (+Z)
    gkMesh.add(model);
    gkAnimator = new CharacterAnimator(model, gltf.animations, CharacterAnimator.GK_POSES, 'gk');
    const away = TEAM_PRESETS[window.selectedAwayTeam] || TEAM_PRESETS.brazil;
    gkAnimator.setKit({
        shirt: away.gkShirt,
        shorts: 0x111827,
        socks: away.gkShirt,
        boots: 0x0f172a,
        gloves: 0xe2e8f0,
        skin: 0xc68863,
        hair: 0x2c1b10,
        number: 1,
        name: 'KEEPER',
        numberColor: '#ffffff'
    });
    gkAnimator.setPose('idle');
    characterAnimators.push(gkAnimator);
    window.gkAnimator = gkAnimator;
});

function setGkPose(poseKey) {
    for (const k in gkPoseModels) {
        if (gkPoseModels[k]) gkPoseModels[k].visible = (k === poseKey);
    }
    if (gkAnimator) gkAnimator.setPose(poseKey);
    if (window.PlayerKinematics) {
        PlayerKinematics.setGkPose(poseKey);
    }
}
window.setGkPose = setGkPose;
window.gkPoseModels = gkPoseModels;

// Ground Contact Shadow under Goalkeeper (Grounded flush at y = 0.004)
const gkShadowGeo = new THREE.PlaneGeometry(1.85, 1.10);
gkShadowGeo.rotateX(-Math.PI / 2);
const gkShadowMat = new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.78, depthWrite: false });
const gkShadow = new THREE.Mesh(gkShadowGeo, gkShadowMat);
gkShadow.position.set(0, 0.004, -19.6);
scene.add(gkShadow);

gkGroup.position.set(0, 0.0, -19.6);
scene.add(gkGroup);
window.keeperGroup = gkGroup;

// Cannon Physics Collider for Goalkeeper
const gkBodyCollider = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    shape: new CANNON.Box(new CANNON.Vec3(0.75, 1.15, 0.45)),
    position: new CANNON.Vec3(0, 1.15, -19.6),
    material: postPhysMat
});
gkBodyCollider.collisionResponse = 0;
world.addBody(gkBodyCollider);

// Instantiation: Defensive Wall & Grounded Free-Kick Training Mannequins
const wallGroup = new THREE.Group();
wallGroup.position.set(0, 0.0, -13.5);
const wallDefenders = [];
const wallShadows = [];
const wallBaseDisks = [];

const wallDefenderConfigs = [
    { id: 0, xOffset: -0.85, scale: 1.22, delay: 0.055, maxH: 0.50, duration: 0.65, lean: -0.14, inwardYaw: 0.09, skin: 0xd89c7a, hair: 0x1a120b, num: 4 },
    { id: 1, xOffset: 0.00,  scale: 1.26, delay: 0.000, maxH: 0.64, duration: 0.72, lean: -0.18, inwardYaw: 0.00, skin: 0x8d5534, hair: 0x0f0f12, num: 5 },
    { id: 2, xOffset: 0.85,  scale: 1.24, delay: 0.080, maxH: 0.54, duration: 0.68, lean: -0.15, inwardYaw: -0.09, skin: 0xc6865c, hair: 0x3b2314, num: 6 }
];

// Weighted Grounded Rubber Base Disk + Spring Spike Collars for each Wall Defender / Mannequin
const mannequinBaseGeo = new THREE.CylinderGeometry(0.28, 0.30, 0.03, 24);
const mannequinBaseMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
    metalness: 0.15
});
const mannequinRimGeo = new THREE.CylinderGeometry(0.29, 0.295, 0.012, 24);
const mannequinRimMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.45,
    metalness: 0.35
});

const wallAnimators = [];
function buildWall(gltf) {
    const away = TEAM_PRESETS[window.selectedAwayTeam] || TEAM_PRESETS.brazil;
    wallDefenderConfigs.forEach((cfg) => {
        const defender = THREE.SkeletonUtils.clone(gltf.scene);
        prepCharacterMaterials(defender);
        defender.scale.setScalar(cfg.scale / 1.24);
        defender.position.y = -0.022;
        defender.rotation.y = Math.PI / 2; // MPFB faces local -X; turn to face the ball (+Z)
        const pivot = new THREE.Group();
        pivot.add(defender);
        pivot.position.set(cfg.xOffset, 0.0, 0);
        pivot.rotation.y = cfg.inwardYaw * 0.2;
        const anim = new CharacterAnimator(defender, gltf.animations, CharacterAnimator.WALL_POSES, 'wall');
        anim.setKit({
            shirt: away.shirt,
            shorts: away.shorts,
            socks: away.socks,
            boots: 0x111111,
            skin: cfg.skin,
            hair: cfg.hair,
            number: cfg.num
        });
        anim.setPose('idle');
        anim.mixer.setTime(0.08 + cfg.id * 0.04);
        characterAnimators.push(anim);
        wallAnimators.push(anim);
        wallGroup.add(pivot);
        wallDefenders.push(pivot);
    });

    // Standalone Grounded Blender 3D Training Mannequins placed on the outer training flanks (no overlap with human wall!)
    const trainingPropsGroup = new THREE.Group();
    scene.add(trainingPropsGroup);
    window.trainingPropsGroup = trainingPropsGroup;
    charGltfLoader.load('assets/models/training_mannequin.glb', (mGltf) => {
        if (!mGltf || !mGltf.scene) return;
        // Refine mannequin materials to matte pro-training slate & amber (no neon blowout)
        mGltf.scene.traverse(n => {
            if (n.isMesh && n.material) {
                n.castShadow = true;
                n.receiveShadow = true;
                if (n.material.color && n.material.color.r > 0.7 && n.material.color.g > 0.6) {
                    n.material = n.material.clone();
                    n.material.color.setHex(0xd97706);
                    n.material.roughness = 0.68;
                    n.material.metalness = 0.12;
                }
            }
        });
        [
            { x: -5.2, z: -15.5, rotY: 0.22 },
            { x:  5.2, z: -15.5, rotY: -0.22 }
        ].forEach(pos => {
            const prop = mGltf.scene.clone();
            prop.position.set(pos.x, 0.0, pos.z);
            prop.rotation.y = pos.rotY;
            trainingPropsGroup.add(prop);

            const propShadow = new THREE.Mesh(
                defShadowGeo,
                new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.75, depthWrite: false })
            );
            propShadow.position.set(pos.x, 0.004, pos.z);
            trainingPropsGroup.add(propShadow);
        });
    }, undefined, () => {});
}
window.wallAnimators = wallAnimators;

// Ground Contact Shadows (y = 0.004) & Dual-Boot Cleat AO Pads for each human wall defender
const defShadowGeo = new THREE.PlaneGeometry(1.10, 0.82);
defShadowGeo.rotateX(-Math.PI / 2);
const bootAoGeo = new THREE.PlaneGeometry(0.42, 0.52);
bootAoGeo.rotateX(-Math.PI / 2);

wallDefenderConfigs.forEach((cfg) => {
    const shadowGroup = new THREE.Group();
    const shadowMat = new THREE.MeshBasicMaterial({
        map: softShadowTex,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });
    const defShadow = new THREE.Mesh(defShadowGeo, shadowMat);
    shadowGroup.add(defShadow);

    // Left & right boot contact AO shadows right under the cleats
    [-0.14, 0.14].forEach(bx => {
        const bootAo = new THREE.Mesh(bootAoGeo, new THREE.MeshBasicMaterial({
            map: softShadowTex,
            transparent: true,
            opacity: 0.92,
            depthWrite: false
        }));
        bootAo.position.set(bx, 0.001, 0.02);
        shadowGroup.add(bootAo);
    });

    shadowGroup.position.set(cfg.xOffset, 0.004, 0);
    wallGroup.add(shadowGroup);
    wallShadows.push(defShadow);
});
window.wallBaseDisks = wallBaseDisks;

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
        if (!wallGroup.visible) return;

        if (ballInFlight && !ballBody.scored && !ballBody.saved && !ballBody.blocked) {
            ballBody.blocked = true;
            streak = 0;
            if (typeof window.onFireCharge !== 'undefined') window.onFireCharge = 0;
            updateHUD();
            sfx.playPost();
            sfx.playGasp();
            finishShot('miss', 'BLOCKED BY WALL', '', '#ef4444');
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
window.keeperGroup = gkGroup;
window.gkShadow = gkShadow;
window.gkSpine = gkSpine;
window.gkMesh = gkMesh;
window.gkBodyCollider = gkBodyCollider;

// ============================================================================
// 8B. HIGH-FIDELITY ATHLETIC 3D STRIKER RIG (OVER-THE-SHOULDER 3RD PERSON)
// ============================================================================
const strikerGroup = new THREE.Group();
const strikerShadowGeo = new THREE.PlaneGeometry(1.25, 0.95);
strikerShadowGeo.rotateX(-Math.PI / 2);
const strikerShadowMat = new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.88, depthWrite: false });
const strikerShadow = new THREE.Mesh(strikerShadowGeo, strikerShadowMat);
[-0.18, 0.18].forEach(bx => {
    const sBootAo = new THREE.Mesh(bootAoGeo, new THREE.MeshBasicMaterial({
        map: softShadowTex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
    }));
    sBootAo.position.set(bx, 0.001, 0.0);
    strikerShadow.add(sBootAo);
});
strikerShadow.position.set(-1.15, 0.004, -7.85);
strikerShadow.visible = true;
scene.add(strikerShadow);

strikerGroup.position.set(-1.15, 0.0, -7.85);
scene.add(strikerGroup);

const strikerPoseModels = {
    idle:           { visible: true },
    run:            { visible: false },
    plant:          { visible: false },
    strike_instep:  { visible: false },
    strike_laces:   { visible: false },
    follow_through: { visible: false },
    celebrate:      { visible: false },
    disbelief:      { visible: false }
};
let strikerAnimator = null;

charGltfLoader.load('assets/player.glb', (gltf) => {
    const model = gltf.scene;
    prepCharacterMaterials(model);
    model.rotation.y = -Math.PI / 2; // MPFB export faces local -X; turn to face the goal (-Z)
    strikerGroup.add(model);

    strikerAnimator = new CharacterAnimator(model, gltf.animations, CharacterAnimator.STRIKER_POSES, 'striker');
    const home = TEAM_PRESETS[window.selectedHomeTeam] || TEAM_PRESETS.france;
    strikerAnimator.setKit({
        shirt: home.shirt,
        shorts: home.shorts,
        socks: home.socks,
        boots: 0x0f172a,
        skin: home.skin,
        hair: home.hair,
        number: home.starNum,
        name: home.starName,
        numberColor: home.shirt === 0xfacc15 || home.shirt === 0xf8fafc || home.shirt === 0xf1f5f9 ? '#0f172a' : '#ffffff'
    });
    strikerAnimator.setPose('idle');
    characterAnimators.push(strikerAnimator);
    window.strikerAnimator = strikerAnimator;

    buildWall(gltf);

    if (window.PlayerKinematics) {
        const origSetStrikerPose = PlayerKinematics.setStrikerPose.bind(PlayerKinematics);
        PlayerKinematics.setStrikerPose = function (k) {
            origSetStrikerPose(k);
            if (strikerAnimator) strikerAnimator.setPose(k);
        };
        const origSetGkPose = PlayerKinematics.setGkPose.bind(PlayerKinematics);
        PlayerKinematics.setGkPose = function (k) {
            origSetGkPose(k);
            if (gkAnimator) gkAnimator.setPose(k);
        };
        const origStartWallJump = PlayerKinematics.startWallJump.bind(PlayerKinematics);
        PlayerKinematics.startWallJump = function () {
            origStartWallJump();
            wallAnimators.forEach(a => a.setPose('jump'));
        };
        const origResetWall = PlayerKinematics.resetWall.bind(PlayerKinematics);
        PlayerKinematics.resetWall = function (sx, sz, allowW) {
            origResetWall(sx, sz, allowW);
            wallShadows.forEach(s => { if (s) s.position.y = 0.004; });
            wallAnimators.forEach((a, idx) => {
                a.setPose('idle');
                a.mixer.setTime(0.08 + idx * 0.04);
            });
        };
        const origResetStriker = PlayerKinematics.resetStriker.bind(PlayerKinematics);
        PlayerKinematics.resetStriker = function (sx, sz, isPen, mode) {
            origResetStriker(sx, sz, isPen, mode);
            if (strikerGroup) strikerGroup.position.y = 0.0;
            if (strikerShadow) strikerShadow.position.y = 0.004;
        };
        const origResetGoalkeeper = PlayerKinematics.resetGoalkeeper.bind(PlayerKinematics);
        PlayerKinematics.resetGoalkeeper = function (sx, allowG, allowW) {
            origResetGoalkeeper(sx, allowG, allowW);
            if (gkGroup && allowG) gkGroup.position.y = 0.0;
            if (gkShadow && allowG) gkShadow.position.y = 0.004;
        };
        const origUpdateStriker = PlayerKinematics.updateStriker.bind(PlayerKinematics);
        PlayerKinematics.updateStriker = function (dt, time) {
            origUpdateStriker(dt, time);
            if (strikerShadow) strikerShadow.position.y = 0.004;
            if (PlayerKinematics.strikerState.phase === 'idle' && strikerGroup) {
                strikerGroup.position.y = 0.0;
            }
        };
        const origUpdateGoalkeeper = PlayerKinematics.updateGoalkeeper.bind(PlayerKinematics);
        PlayerKinematics.updateGoalkeeper = function (dt, time, bMesh, bFlight) {
            origUpdateGoalkeeper(dt, time, bMesh, bFlight);
            if (gkShadow && gkGroup.visible) gkShadow.position.y = 0.004;
            if (!PlayerKinematics.gkState.diving && gkGroup && gkGroup.visible) {
                gkGroup.position.y = 0.0;
            }
        };
        const origUpdateWall = PlayerKinematics.updateWall.bind(PlayerKinematics);
        PlayerKinematics.updateWall = function (dt, time, allowW) {
            origUpdateWall(dt, time, allowW);
            wallShadows.forEach(s => { if (s) s.position.y = 0.004; });
            if (!PlayerKinematics.wallState.jumping) {
                wallDefenders.forEach(def => {
                    if (def) {
                        def.position.y = 0.0;
                        def.rotation.x = 0.0;
                        def.rotation.z = 0.0;
                    }
                });
            }
        };
    }
});

window.applyMatchKits = function(homeKey, awayKey) {
    if (homeKey && TEAM_PRESETS[homeKey]) window.selectedHomeTeam = homeKey;
    if (awayKey && TEAM_PRESETS[awayKey]) window.selectedAwayTeam = awayKey;
    const home = TEAM_PRESETS[window.selectedHomeTeam] || TEAM_PRESETS.france;
    const away = TEAM_PRESETS[window.selectedAwayTeam] || TEAM_PRESETS.brazil;

    if (strikerAnimator) {
        strikerAnimator.setKit({
            shirt: home.shirt,
            shorts: home.shorts,
            socks: home.socks,
            boots: 0x0f172a,
            skin: home.skin,
            hair: home.hair,
            number: home.starNum,
            name: home.starName,
            numberColor: (home.shirt === 0xfacc15 || home.shirt === 0xf8fafc || home.shirt === 0xf1f5f9) ? '#0f172a' : '#ffffff'
        });
    }
    if (gkAnimator) {
        gkAnimator.setKit({
            shirt: away.gkShirt,
            shorts: 0x111827,
            socks: away.gkShirt,
            boots: 0x0f172a,
            gloves: 0xf8fafc,
            number: 1,
            name: 'KEEPER',
            numberColor: '#0f172a'
        });
    }
    wallAnimators.forEach((anim, idx) => {
        const cfg = wallDefenderConfigs[idx] || {};
        anim.setKit({
            shirt: away.shirt,
            shorts: away.shorts,
            socks: away.socks,
            boots: 0x111111,
            number: cfg.num || (idx + 4),
            numberColor: (away.shirt === 0xfacc15 || away.shirt === 0xf8fafc || away.shirt === 0xf1f5f9) ? '#0f172a' : '#ffffff'
        });
    });
    if (typeof window.updateScorebugTeams === 'function') {
        window.updateScorebugTeams();
    }
};

function updateCharacterAnimators(dt) {
    for (let i = 0; i < characterAnimators.length; i++) characterAnimators[i].update(dt);
}
window.characterAnimators = characterAnimators;
window.strikerGroup = strikerGroup;
window.strikerShadow = strikerShadow;
window.strikerPoseModels = strikerPoseModels;
window.kickerGroup = strikerGroup; // Backwards-compatible for test suites

if (window.PlayerKinematics) {
    PlayerKinematics.initStriker(strikerGroup, strikerShadow, strikerPoseModels);
    PlayerKinematics.initGoalkeeper(gkGroup, gkSpine, gkMesh, gkShadow, gkBodyCollider, gkPoseModels);
    PlayerKinematics.initWall(wallGroup, wallDefenders, wallShadows, wallBodies, wallDefenderConfigs);
}
