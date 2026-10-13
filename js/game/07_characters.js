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

// National Team & Club Kit Presets
const TEAM_PRESETS = {
    france:    { name: 'FRANCE',    code: 'FRA', flag: 'assets/france.jpg',    shirt: 0x1e3a8a, shorts: 0xffffff, socks: 0xdc2626, gkShirt: 0xc6f432, starName: 'MBAPPE',     starNum: 10, skin: 0x8d5534, hair: 0x0f0f12 },
    brazil:    { name: 'BRAZIL',    code: 'BRA', flag: 'assets/brazil.jpg',    shirt: 0xfacc15, shorts: 0x1d4ed8, socks: 0xffffff, gkShirt: 0x10b981, starName: 'VINICIUS',   starNum: 7,  skin: 0x7c4b2b, hair: 0x0f0f12 },
    argentina: { name: 'ARGENTINA', code: 'ARG', flag: 'assets/argentina.jpg', shirt: 0x38bdf8, shorts: 0x0f172a, socks: 0xffffff, gkShirt: 0xef4444, starName: 'MESSI',      starNum: 10, skin: 0xd89c7a, hair: 0x23170f },
    england:   { name: 'ENGLAND',   code: 'ENG', flag: 'assets/england.jpg',   shirt: 0xf8fafc, shorts: 0x1e3a8a, socks: 0xf8fafc, gkShirt: 0xf97316, starName: 'BELLINGHAM', starNum: 10, skin: 0x8d5534, hair: 0x0f0f12 },
    spain:     { name: 'SPAIN',     code: 'ESP', flag: 'assets/spain.jpg',     shirt: 0xdc2626, shorts: 0x1e3a8a, socks: 0xdc2626, gkShirt: 0x38bdf8, starName: 'YAMAL',      starNum: 19, skin: 0x9c623e, hair: 0x12100e },
    germany:   { name: 'GERMANY',   code: 'GER', flag: 'assets/germany.jpg',   shirt: 0xf1f5f9, shorts: 0x0f172a, socks: 0xf1f5f9, gkShirt: 0x22c55e, starName: 'MUSIALA',    starNum: 10, skin: 0xc68863, hair: 0x18120e },
    portugal:  { name: 'PORTUGAL',  code: 'POR', flag: 'assets/portugal.jpg',  shirt: 0xb91c1c, shorts: 0x065f46, socks: 0xb91c1c, gkShirt: 0xfacc15, starName: 'RONALDO',    starNum: 7,  skin: 0xd2946e, hair: 0x14100d },
    usa:       { name: 'USA',       code: 'USA', flag: 'assets/usa.jpg',       shirt: 0x1e293b, shorts: 0x1e293b, socks: 0xdc2626, gkShirt: 0xa855f7, starName: 'PULISIC',    starNum: 10, skin: 0xdca07c, hair: 0x382214 }
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
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        mats.forEach(m => {
            if (!m || !m.name) return;
            if (m.name.indexOf('kit_shirt') === 0 || m.name.indexOf('kit_shorts') === 0 || m.name.indexOf('kit_socks') === 0) {
                m.normalMap = jerseyNormalTex; m.normalScale = new THREE.Vector2(0.55, 0.55); m.roughness = 0.62;
            } else if (m.name.indexOf('gk_gloves') === 0) {
                m.normalMap = glovesNormalTex; m.normalScale = new THREE.Vector2(0.65, 0.65); m.roughness = 0.38;
            } else if (/Human\.body/i.test(m.name)) {
                // Only target Human.body skin; preserve hair (short02/short04), eyes (low-poly), and eyebrows
                m.map = null; m.aoMap = null; m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null;
                m.color.setRGB(0.82, 0.58, 0.44); m.roughness = 0.52; m.metalness = 0;
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
        gloves: 0xf8fafc,
        skin: 0xd69a72,
        hair: 0x2c1b10,
        number: 1,
        name: 'KEEPER',
        numberColor: '#0f172a'
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

// Ground Contact Shadow under Goalkeeper
const gkShadowGeo = new THREE.PlaneGeometry(1.85, 1.10);
gkShadowGeo.rotateX(-Math.PI / 2);
const gkShadowMat = new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.75, depthWrite: false });
const gkShadow = new THREE.Mesh(gkShadowGeo, gkShadowMat);
gkShadow.position.set(0, 0.015, -19.6);
scene.add(gkShadow);

gkGroup.position.set(0, 0, -19.6);
scene.add(gkGroup);

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

// Instantiation: Defensive Wall (Decoupled Individual Jumper Mechanics)
const wallGroup = new THREE.Group();
wallGroup.position.set(0, 0, -13.5);
const wallDefenders = [];
const wallShadows = [];

const wallDefenderConfigs = [
    { id: 0, xOffset: -0.85, scale: 1.22, delay: 0.055, maxH: 0.50, duration: 0.65, lean: -0.14, inwardYaw: 0.09, skin: 0xd89c7a, hair: 0x1a120b, num: 4 },
    { id: 1, xOffset: 0.00,  scale: 1.26, delay: 0.000, maxH: 0.64, duration: 0.72, lean: -0.18, inwardYaw: 0.00, skin: 0x8d5534, hair: 0x0f0f12, num: 5 },
    { id: 2, xOffset: 0.85,  scale: 1.24, delay: 0.080, maxH: 0.54, duration: 0.68, lean: -0.15, inwardYaw: -0.09, skin: 0xc6865c, hair: 0x3b2314, num: 6 }
];

const wallAnimators = [];
function buildWall(gltf) {
    const away = TEAM_PRESETS[window.selectedAwayTeam] || TEAM_PRESETS.brazil;
    wallDefenderConfigs.forEach((cfg) => {
        const defender = THREE.SkeletonUtils.clone(gltf.scene);
        prepCharacterMaterials(defender);
        defender.scale.setScalar(cfg.scale / 1.24);
        defender.rotation.y = Math.PI / 2; // MPFB faces local -X; turn to face the ball (+Z)
        const pivot = new THREE.Group();
        pivot.add(defender);
        pivot.position.set(cfg.xOffset, 0, 0);
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
        anim.mixer.setTime(0.1 + cfg.id * 0.65);
        characterAnimators.push(anim);
        wallAnimators.push(anim);
        wallGroup.add(pivot);
        wallDefenders.push(pivot);
    });
}
window.wallAnimators = wallAnimators;

// Ground Contact Shadows for each individual defender
const defShadowGeo = new THREE.PlaneGeometry(1.05, 0.78);
defShadowGeo.rotateX(-Math.PI / 2);

wallDefenderConfigs.forEach((cfg) => {
    const shadowMat = new THREE.MeshBasicMaterial({
        map: softShadowTex,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
    });
    const defShadow = new THREE.Mesh(defShadowGeo, shadowMat);
    defShadow.position.set(cfg.xOffset, 0.015, 0);
    wallGroup.add(defShadow);
    wallShadows.push(defShadow);
});

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
        const isPenalty = (currentGameMode === 'duel' && currentRound === 1) ||
                          (currentGameMode === 'keeper') ||
                          (currentGameMode === 'practice' && practiceSpots[practiceSettings.spotIndex] && practiceSpots[practiceSettings.spotIndex].isPenalty);
        const isWallActive = (currentGameMode === 'duel' && !isPenalty) ||
                             (currentGameMode === 'practice' && practiceSettings.wall && !isPenalty);
        if (!isWallActive) return;

        if (ballInFlight && !ballBody.scored && !ballBody.saved && !ballBody.blocked) {
            ballBody.blocked = true;
            streak = 0;
            if (typeof window.onFireCharge !== 'undefined') window.onFireCharge = 0;
            updateHUD();
            sfx.playPost();
            sfx.playGasp();
            finishShot('miss', 'BLOCKED', '', '#ef4444');
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
window.gkShadow = gkShadow;
window.gkSpine = gkSpine;
window.gkMesh = gkMesh;
window.gkBodyCollider = gkBodyCollider;

// ============================================================================
// 8B. HIGH-FIDELITY ATHLETIC 3D STRIKER RIG (OVER-THE-SHOULDER 3RD PERSON)
// ============================================================================
const strikerGroup = new THREE.Group();
const strikerShadowGeo = new THREE.PlaneGeometry(1.20, 0.90);
strikerShadowGeo.rotateX(-Math.PI / 2);
const strikerShadowMat = new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.75, depthWrite: false });
const strikerShadow = new THREE.Mesh(strikerShadowGeo, strikerShadowMat);
strikerShadow.position.set(-1.15, 0.015, -7.85);
strikerShadow.visible = true;
scene.add(strikerShadow);

strikerGroup.position.set(-1.15, 0, -7.85);
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
            wallAnimators.forEach((a, idx) => {
                a.setPose('idle');
                a.mixer.setTime(0.1 + idx * 0.65);
            });
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
