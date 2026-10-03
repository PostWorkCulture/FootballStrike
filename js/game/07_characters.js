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

const gkPoseModels = {
    idle: null,
    dive_right: null,
    dive_left: null,
    parry: null,
    low_sweep_right: null,
    low_sweep_left: null,
    recovery_roll: null
};

function setupGkPoseModel(gltf, poseKey) {
    const model = gltf.scene;
    model.scale.set(1.30, 1.30, 1.30);
    model.traverse(node => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
                node.material.normalMap = glovesNormalTex;
                node.material.normalScale = new THREE.Vector2(0.65, 0.65);
                node.material.roughness = 0.32; // German Contact Latex foam palm & grip
                node.material.metalness = 0.04;
                node.material.emissive = new THREE.Color(0x333333);
                node.material.emissiveIntensity = 0.35;
                node.material.needsUpdate = true;
            }
        }
    });
    model.visible = (poseKey === 'idle');
    gkMesh.add(model);
    gkPoseModels[poseKey] = model;
}

charGltfLoader.load('assets/goalkeeper_pro_3d.glb', (gltf) => setupGkPoseModel(gltf, 'idle'));
charGltfLoader.load('assets/goalkeeper_dive_right.glb', (gltf) => setupGkPoseModel(gltf, 'dive_right'));
charGltfLoader.load('assets/goalkeeper_dive_left.glb', (gltf) => setupGkPoseModel(gltf, 'dive_left'));
charGltfLoader.load('assets/goalkeeper_parry.glb', (gltf) => setupGkPoseModel(gltf, 'parry'));
charGltfLoader.load('assets/goalkeeper_low_sweep_right.glb', (gltf) => setupGkPoseModel(gltf, 'low_sweep_right'));
charGltfLoader.load('assets/goalkeeper_low_sweep_left.glb', (gltf) => setupGkPoseModel(gltf, 'low_sweep_left'));
charGltfLoader.load('assets/goalkeeper_recovery_roll.glb', (gltf) => setupGkPoseModel(gltf, 'recovery_roll'));

function setGkPose(poseKey) {
    for (const k in gkPoseModels) {
        if (gkPoseModels[k]) {
            gkPoseModels[k].visible = (k === poseKey);
        }
    }
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

charGltfLoader.load('assets/wall_defender_pro_3d.glb', (gltf) => {
    const baseModel = gltf.scene;

    wallDefenderConfigs.forEach((cfg) => {
        const defender = baseModel.clone(true);
        defender.scale.set(cfg.scale, cfg.scale, cfg.scale);
        defender.position.set(cfg.xOffset, 0, 0);
        defender.rotation.y = cfg.inwardYaw * 0.2;
        defender.traverse(node => {
            if (node.isMesh) {
                node.castShadow = true;
                node.receiveShadow = true;
                if (node.material) {
                    node.material = node.material.clone();
                    node.material.normalMap = jerseyNormalTex;
                    node.material.normalScale = new THREE.Vector2(0.75, 0.75);
                    node.material.roughness = 0.44; // Micro-knit polyester weave
                    node.material.metalness = 0.02;
                    node.material.emissive = new THREE.Color(0x222222);
                    node.material.emissiveIntensity = 0.22;
                    node.material.needsUpdate = true;
                }
            }
        });
        wallGroup.add(defender);
        wallDefenders.push(defender);
    });
});

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

const strikerPoseModels = {
    idle: null,
    run: null,
    plant: null,
    strike_instep: null,
    strike_laces: null,
    follow_through: null,
    celebrate: null,
    disbelief: null
};

function setupStrikerPoseModel(gltf, poseKey) {
    const model = gltf.scene;
    model.scale.set(1.24, 1.24, 1.24);
    model.traverse(node => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            if (node.material) {
                node.material.roughness = 0.35;
                node.material.metalness = 0.04;
                node.material.emissive = new THREE.Color(0x222222);
                node.material.emissiveIntensity = 0.25;
            }
        }
    });
    model.visible = (poseKey === 'idle');
    strikerGroup.add(model);
    strikerPoseModels[poseKey] = model;
}

charGltfLoader.load('assets/striker_idle.glb', (gltf) => setupStrikerPoseModel(gltf, 'idle'));
charGltfLoader.load('assets/striker_run.glb', (gltf) => setupStrikerPoseModel(gltf, 'run'));
charGltfLoader.load('assets/striker_plant.glb', (gltf) => setupStrikerPoseModel(gltf, 'plant'));
charGltfLoader.load('assets/striker_strike_instep.glb', (gltf) => setupStrikerPoseModel(gltf, 'strike_instep'));
charGltfLoader.load('assets/striker_strike_laces.glb', (gltf) => setupStrikerPoseModel(gltf, 'strike_laces'));
charGltfLoader.load('assets/striker_follow_through.glb', (gltf) => setupStrikerPoseModel(gltf, 'follow_through'));
charGltfLoader.load('assets/striker_celebrate.glb', (gltf) => setupStrikerPoseModel(gltf, 'celebrate'));
charGltfLoader.load('assets/striker_disbelief.glb', (gltf) => setupStrikerPoseModel(gltf, 'disbelief'));

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
