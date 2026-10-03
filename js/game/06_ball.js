// ============================================================================
// 6. HIGH-POLY 3D MATCH BALL (PBR REGULATION MATCH BALL)
// ============================================================================
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);

const ballNormalTex = pbrTextureLoader.load('assets/ball_normal_pbr.png');
const ballDiffuseTex = pbrTextureLoader.load('assets/ball_texture_pbr.png');

const ballMat = new THREE.MeshStandardMaterial({
    map: ballDiffuseTex,
    normalMap: ballNormalTex,
    normalScale: new THREE.Vector2(0.95, 0.95),
    roughness: 0.28,
    metalness: 0.08
});

const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true;
scene.add(ballMesh);

const ballBody = new CANNON.Body({
    mass: 0.38,
    shape: new CANNON.Sphere(ballRadius),
    material: ballPhysMat,
    linearDamping: 0.008,
    angularDamping: 0.04
});
world.addBody(ballBody);
window.ballBody = ballBody;
window.ballMesh = ballMesh;
window.ballRadius = ballRadius;

