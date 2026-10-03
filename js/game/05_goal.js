// ============================================================================
// 5. REGULATION GOAL FRAME & SPRING-DEFORMING NET
// ============================================================================
const goalGroup = new THREE.Group();

// Tubular aluminum goal posts with realistic metallic specularity
const postMat = new THREE.MeshStandardMaterial({
    color: 0xfdfdfd,
    roughness: 0.12,
    metalness: 0.62
});
const stanchionMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.28,
    metalness: 0.82
});
const jointWeldMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.55
});
const groundSocketMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.85
});
const groundAnchorBoltMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.20,
    metalness: 0.90
});
const rubberTurfMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.92,
    metalness: 0.05
});

const postRadius = 0.06, postHeight = 2.44, goalWidth = 7.32, goalDepth = 2.0, ballRadius = 0.22;

// Upright Tubular Aluminum Posts
const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 32), postMat);
leftPost.position.set(-goalWidth / 2, postHeight / 2, 0);
leftPost.castShadow = true;
goalGroup.add(leftPost);

const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 32), postMat);
rightPost.position.set(goalWidth / 2, postHeight / 2, 0);
rightPost.castShadow = true;
goalGroup.add(rightPost);

// Crossbar spanning horizontally
const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth + postRadius * 2, 32), postMat);
crossbar.rotation.z = Math.PI / 2;
crossbar.position.set(0, postHeight, 0);
crossbar.castShadow = true;
goalGroup.add(crossbar);

// Crossbar Corner Depth Bevels & Elbow Castings:
// Left Corner Elbow Joint
const leftElbow = new THREE.Mesh(new THREE.TorusGeometry(postRadius, postRadius * 0.98, 16, 24, Math.PI / 2), postMat);
leftElbow.rotation.z = Math.PI;
leftElbow.position.set(-goalWidth / 2 + postRadius, postHeight - postRadius, 0);
goalGroup.add(leftElbow);

// Left Corner Weld Sleeves & Depth End Cap
const leftWeldV = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.04, postRadius * 1.04, 0.02, 32), jointWeldMat);
leftWeldV.position.set(-goalWidth / 2, postHeight - postRadius * 1.8, 0);
goalGroup.add(leftWeldV);
const leftWeldH = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.04, postRadius * 1.04, 0.02, 32), jointWeldMat);
leftWeldH.rotation.z = Math.PI / 2;
leftWeldH.position.set(-goalWidth / 2 + postRadius * 1.8, postHeight, 0);
goalGroup.add(leftWeldH);
const leftCornerCap = new THREE.Mesh(new THREE.SphereGeometry(postRadius, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), postMat);
leftCornerCap.position.set(-goalWidth / 2, postHeight, 0);
goalGroup.add(leftCornerCap);

// Right Corner Elbow Joint
const rightElbow = new THREE.Mesh(new THREE.TorusGeometry(postRadius, postRadius * 0.98, 16, 24, Math.PI / 2), postMat);
rightElbow.rotation.z = -Math.PI / 2;
rightElbow.position.set(goalWidth / 2 - postRadius, postHeight - postRadius, 0);
goalGroup.add(rightElbow);

// Right Corner Weld Sleeves & Depth End Cap
const rightWeldV = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.04, postRadius * 1.04, 0.02, 32), jointWeldMat);
rightWeldV.position.set(goalWidth / 2, postHeight - postRadius * 1.8, 0);
goalGroup.add(rightWeldV);
const rightWeldH = new THREE.Mesh(new THREE.CylinderGeometry(postRadius * 1.04, postRadius * 1.04, 0.02, 32), jointWeldMat);
rightWeldH.rotation.z = Math.PI / 2;
rightWeldH.position.set(goalWidth / 2 - postRadius * 1.8, postHeight, 0);
goalGroup.add(rightWeldH);
const rightCornerCap = new THREE.Mesh(new THREE.SphereGeometry(postRadius, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2), postMat);
rightCornerCap.position.set(goalWidth / 2, postHeight, 0);
goalGroup.add(rightCornerCap);

// Ground Anchor Pins & Foundation Sockets:
[-goalWidth / 2, goalWidth / 2].forEach(px => {
    // Heavy galvanized ground socket collar embedded into pitch
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.07, 24), groundSocketMat);
    socket.position.set(px, 0.035, 0);
    goalGroup.add(socket);

    // Turf protector rubber gasket flush with grass
    const rubberRim = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.02, 24), rubberTurfMat);
    rubberRim.position.set(px, 0.01, 0);
    goalGroup.add(rubberRim);

    // 4 High-Tensile Steel Ground Anchor Hex Bolts/Pins
    for (let b = 0; b < 4; b++) {
        const ang = (b * Math.PI) / 2 + Math.PI / 4;
        const bx = px + Math.cos(ang) * 0.082;
        const bz = Math.sin(ang) * 0.082;
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.045, 6), groundAnchorBoltMat);
        bolt.position.set(bx, 0.05, bz);
        goalGroup.add(bolt);
    }

    // Ground locking wedge latch pin clamping the upright into socket
    const lockPin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 12), groundAnchorBoltMat);
    lockPin.rotation.x = Math.PI / 2;
    lockPin.position.set(px, 0.06, 0);
    goalGroup.add(lockPin);
});

// Turf Net Ground Anchor Peg Pins (Holding bottom net taut into the pitch)
for (let p = -3.2; p <= 3.25; p += 0.8) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 8), groundAnchorBoltMat);
    peg.position.set(p, 0.03, -goalDepth);
    goalGroup.add(peg);
    const pegCap = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), groundAnchorBoltMat);
    pegCap.position.set(p, 0.07, -goalDepth);
    goalGroup.add(pegCap);
}
// Side turf anchor pegs
[-goalWidth / 2, goalWidth / 2].forEach(sx => {
    [-0.5, -1.0, -1.5].forEach(sz => {
        const sidePeg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.08, 8), groundAnchorBoltMat);
        sidePeg.position.set(sx, 0.03, sz);
        goalGroup.add(sidePeg);
    });
});

// Rear Stanchions
const leftStanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, postHeight, 16), stanchionMat);
leftStanchion.position.set(-goalWidth / 2 - 0.02, postHeight / 2, -goalDepth / 2);
leftStanchion.rotation.x = 0.22; goalGroup.add(leftStanchion);

const rightStanchion = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, postHeight, 16), stanchionMat);
rightStanchion.position.set(goalWidth / 2 + 0.02, postHeight / 2, -goalDepth / 2);
rightStanchion.rotation.x = 0.22; goalGroup.add(rightStanchion);

const bottomBackBar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, goalWidth, 16), stanchionMat);
bottomBackBar.rotation.z = Math.PI / 2; bottomBackBar.position.set(0, 0.03, -goalDepth); goalGroup.add(bottomBackBar);

// Procedural Hexagonal Net Pattern
const netCanvas = document.createElement('canvas'); netCanvas.width = 64; netCanvas.height = 64;
const nctx = netCanvas.getContext('2d');
nctx.fillStyle = 'rgba(0, 0, 0, 0)'; nctx.fillRect(0, 0, 64, 64);
nctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'; nctx.lineWidth = 2.0;
nctx.beginPath(); nctx.moveTo(32, 0); nctx.lineTo(64, 32); nctx.lineTo(32, 64); nctx.lineTo(0, 32); nctx.closePath(); nctx.stroke();
const netTex = new THREE.CanvasTexture(netCanvas);
netTex.wrapS = THREE.RepeatWrapping; netTex.wrapT = THREE.RepeatWrapping;
netTex.repeat.set(24, 12);

const netMat = new THREE.MeshStandardMaterial({
    map: netTex,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    roughness: 0.7
});

// Dynamic Back Net Mesh with Spring Vertex Deformations
const backNetSegmentsX = 32, backNetSegmentsY = 16;
const backNetGeo = new THREE.PlaneGeometry(goalWidth, postHeight, backNetSegmentsX, backNetSegmentsY);
const backNet = new THREE.Mesh(backNetGeo, netMat);
backNet.position.set(0, postHeight / 2, -goalDepth);
goalGroup.add(backNet);

const sideNetMat = netMat.clone(); sideNetMat.map = netTex.clone(); sideNetMat.map.repeat.set(8, 12);
const leftSideNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, postHeight), sideNetMat);
leftSideNet.rotation.y = Math.PI / 2;
leftSideNet.position.set(-goalWidth / 2, postHeight / 2, -goalDepth / 2);
goalGroup.add(leftSideNet);

const rightSideNet = new THREE.Mesh(new THREE.PlaneGeometry(goalDepth, postHeight), sideNetMat);
rightSideNet.rotation.y = -Math.PI / 2;
rightSideNet.position.set(goalWidth / 2, postHeight / 2, -goalDepth / 2);
goalGroup.add(rightSideNet);

const roofNetMat = netMat.clone(); roofNetMat.map = netTex.clone(); roofNetMat.map.repeat.set(24, 8);
const roofNet = new THREE.Mesh(new THREE.PlaneGeometry(goalWidth, goalDepth), roofNetMat);
roofNet.rotation.x = Math.PI / 2;
roofNet.position.set(0, postHeight, -goalDepth / 2);
goalGroup.add(roofNet);

goalGroup.position.set(0, 0, -20);
scene.add(goalGroup);

// FIFA-Grade 3D Hexagonal Spring-Mass Net Cloth Engine
let netClothPhysics = null;
if (window.NetClothPhysics) {
    netClothPhysics = new window.NetClothPhysics({
        scene,
        goalGroup,
        goalWidth,
        postHeight,
        goalDepth,
        ballRadius: 0.22,
        goalZ: -20.0,
        replaceMeshes: [backNet, leftSideNet, rightSideNet, roofNet]
    });
    window.netClothPhysics = netClothPhysics;
}

// Net Spring Vertex State (Fallback)
const netVertexCount = backNetGeo.attributes.position.count;
const netDisplacements = new Float32Array(netVertexCount);
const netVelocities = new Float32Array(netVertexCount);
const netOrigPositions = backNetGeo.attributes.position.array.slice();

function triggerNetBillow(worldHitX, worldHitY) {
    if (netClothPhysics) {
        const vz = (typeof ballBody !== 'undefined' && ballBody) ? ballBody.velocity.z : -20;
        const vx = (typeof ballBody !== 'undefined' && ballBody) ? ballBody.velocity.x : 0;
        const vy = (typeof ballBody !== 'undefined' && ballBody) ? ballBody.velocity.y : 0;
        const hitZ = (typeof ballBody !== 'undefined' && ballBody) ? ballBody.position.z : -21.8;
        netClothPhysics.triggerImpact(worldHitX, worldHitY, hitZ, vx, vy, vz);
        return;
    }
    const localHitX = worldHitX;
    const localHitY = worldHitY - postHeight / 2;
    const pos = backNetGeo.attributes.position.array;

    for (let i = 0; i < netVertexCount; i++) {
        const vx = pos[i * 3];
        const vy = pos[i * 3 + 1];
        const dist = Math.hypot(vx - localHitX, vy - localHitY);
        if (dist < 2.2) {
            const impactForce = Math.max(0, (1 - dist / 2.2)) * -0.55;
            netVelocities[i] += impactForce * 12.0;
        }
    }
}

function updateNetDeformation(dt) {
    if (netClothPhysics) {
        netClothPhysics.update(dt, (typeof ballBody !== 'undefined' ? ballBody : null), (typeof ballMesh !== 'undefined' ? ballMesh : null));
        return;
    }
    let active = false;
    const pos = backNetGeo.attributes.position.array;
    const stiffness = 85.0;
    const damping = 9.0;

    for (let i = 0; i < netVertexCount; i++) {
        if (Math.abs(netDisplacements[i]) > 0.001 || Math.abs(netVelocities[i]) > 0.01) {
            active = true;
            const force = -stiffness * netDisplacements[i] - damping * netVelocities[i];
            netVelocities[i] += force * dt;
            netDisplacements[i] += netVelocities[i] * dt;
            pos[i * 3 + 2] = netOrigPositions[i * 3 + 2] + netDisplacements[i];
        } else {
            pos[i * 3 + 2] = netOrigPositions[i * 3 + 2];
            netDisplacements[i] = 0;
            netVelocities[i] = 0;
        }
    }
    if (active) {
        backNetGeo.attributes.position.needsUpdate = true;
        backNetGeo.computeVertexNormals();
    }
}

// Rigid Goal Post & Crossbar Cannon Colliders
let shotSafetyTimer = null;

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
                    finishShot('miss', 'WOODWORK', '', '#ef4444');
                }
            }, 600);
        }
    });
    world.addBody(b);
};
addCylinderCollider(-goalWidth / 2, postHeight / 2, -20, postRadius, postHeight);
addCylinderCollider(goalWidth / 2, postHeight / 2, -20, postRadius, postHeight);
addCylinderCollider(0, postHeight, -20, postRadius, goalWidth, Math.PI / 2);

