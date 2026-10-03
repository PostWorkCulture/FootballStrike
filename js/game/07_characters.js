// ============================================================================
// 7. HIGH-FIDELITY ATHLETIC 3D GOALKEEPER & DEFENSIVE WALL RIG
// ============================================================================


// ============================================================================
// 8. FIFA-GRADE BIOMECHANICAL 3D SKELETAL ATHLETIC RIGS (12-BONE HIERARCHICAL ARMATURES)
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

// Instantiation: Goalkeeper Rig (High-Fidelity 3D Polygonal Mesh)
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

// Legacy pose registry kept for test-suite compatibility; the realistic mocap keeper drives all poses.
const gkPoseModels = {};
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
                m.normalMap = glovesNormalTex; m.normalScale = new THREE.Vector2(0.65, 0.65); m.roughness = 0.4;
            } else if (/skin|caucasian|african|asian|body|human/i.test(m.name)) {
                // MPFB game-engine skin bakes blotchy diffuse/AO; use a clean subsurface-like tone instead
                m.map = null; m.aoMap = null; m.normalMap = null; m.roughnessMap = null; m.metalnessMap = null;
                m.color.setRGB(0.66, 0.45, 0.34); m.roughness = 0.55; m.metalness = 0;
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
    gkAnimator = new CharacterAnimator(model, gltf.animations, CharacterAnimator.GK_POSES);
    gkAnimator.setKit({ shirt: 0xc6f432, shorts: 0x111111, socks: 0xc6f432, boots: 0x111111, gloves: 0xf1f1ea });
    gkAnimator.setPose('idle');
    characterAnimators.push(gkAnimator);
    window.gkAnimator = gkAnimator;
});

function setGkPose(poseKey) {
    if (gkAnimator) gkAnimator.setPose(poseKey);
    if (window.PlayerKinematics) {
        PlayerKinematics.setGkPose(poseKey);
    }
}
window.setGkPose = setGkPose;
window.gkPoseModels = gkPoseModels;
// Ground Contact Shadow under Goalkeeper (Decoupled to Ground Plane)
const gkShadowGeo = new THREE.PlaneGeometry(1.85, 1.10);
gkShadowGeo.rotateX(-Math.PI / 2);
const gkShadowMat = new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.75, depthWrite: false });
const gkShadow = new THREE.Mesh(gkShadowGeo, gkShadowMat);
gkShadow.position.set(0, 0.015, -19.6);
scene.add(gkShadow);

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

// Instantiation: Defensive Wall (Decoupled Individual Jumper Mechanics)
const wallGroup = new THREE.Group();
wallGroup.position.set(0, 0, -13.5);
const wallDefenders = [];
const wallShadows = [];

const wallDefenderConfigs = [
    { id: 0, xOffset: -0.85, scale: 1.22, delay: 0.055, maxH: 0.50, duration: 0.65, lean: -0.14, inwardYaw: 0.09 },
    { id: 1, xOffset: 0.00,  scale: 1.26, delay: 0.000, maxH: 0.64, duration: 0.72, lean: -0.18, inwardYaw: 0.00 },
    { id: 2, xOffset: 0.85,  scale: 1.24, delay: 0.080, maxH: 0.54, duration: 0.68, lean: -0.15, inwardYaw: -0.09 }
];

const wallAnimators = [];
function buildWall(gltf) {
    wallDefenderConfigs.forEach((cfg) => {
        const defender = THREE.SkeletonUtils.clone(gltf.scene);
        prepCharacterMaterials(defender);
        defender.scale.setScalar(cfg.scale / 1.24); // legacy configs assumed 1.24x undersized models
        // Inner model carries the MPFB facing fix; legacy code resets the outer pivot's rotation each round.
        defender.rotation.y = Math.PI / 2; // MPFB faces local -X; turn to face the ball (+Z)
        const pivot = new THREE.Group();
        pivot.add(defender);
        pivot.position.set(cfg.xOffset, 0, 0);
        pivot.rotation.y = cfg.inwardYaw * 0.2;
        const anim = new CharacterAnimator(defender, gltf.animations, CharacterAnimator.WALL_POSES);
        anim.setKit({ shirt: 0x1d4ed8, shorts: 0x1e293b, socks: 0x1d4ed8, boots: 0x111111 });
        anim.setPose('idle');
        anim.mixer.setTime(cfg.id * 0.7); // de-synchronise idle breathing
        characterAnimators.push(anim);
        wallAnimators.push(anim);
        wallGroup.add(pivot);
        wallDefenders.push(pivot);
    });
}
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
// 8B. HIGH-FIDELITY ATHLETIC 3D STRIKER RIG & KINEMATICS INITIALIZATION
// ============================================================================
const strikerGroup = new THREE.Group();
const strikerShadowGeo = new THREE.PlaneGeometry(1.20, 0.90);
strikerShadowGeo.rotateX(-Math.PI / 2);
const strikerShadowMat = new THREE.MeshBasicMaterial({ map: softShadowTex, transparent: true, opacity: 0.75, depthWrite: false });
const strikerShadow = new THREE.Mesh(strikerShadowGeo, strikerShadowMat);
strikerShadow.position.set(0, 0.015, -7.0);
scene.add(strikerShadow);
strikerGroup.position.set(0, 0, -7.0);
scene.add(strikerGroup);

const strikerPoseModels = {};
let strikerAnimator = null;

charGltfLoader.load('assets/player.glb', (gltf) => {
    const model = gltf.scene;
    prepCharacterMaterials(model);
    model.rotation.y = -Math.PI / 2; // MPFB export faces local -X; turn to face the goal (-Z)
    strikerGroup.add(model);
    strikerAnimator = new CharacterAnimator(model, gltf.animations, CharacterAnimator.STRIKER_POSES);
    strikerAnimator.setKit({ shirt: 0xdc2626, shorts: 0xffffff, socks: 0xdc2626, boots: 0x111111 });
    strikerAnimator.setPose('idle');
    characterAnimators.push(strikerAnimator);
    window.strikerAnimator = strikerAnimator;
    buildWall(gltf);
    if (window.PlayerKinematics) {
        // Route legacy pose switches into the mocap animator
        const origSetStrikerPose = PlayerKinematics.setStrikerPose.bind(PlayerKinematics);
        PlayerKinematics.setStrikerPose = function (k) { origSetStrikerPose(k); if (strikerAnimator) strikerAnimator.setPose(k); };
        const origSetGkPose = PlayerKinematics.setGkPose.bind(PlayerKinematics);
        PlayerKinematics.setGkPose = function (k) { origSetGkPose(k); if (gkAnimator) gkAnimator.setPose(k); };
    }
});

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
// ============================================================================
