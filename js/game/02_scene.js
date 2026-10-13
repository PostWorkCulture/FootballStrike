// ============================================================================
// 2. THREE.JS SCENE, CANNON PHYSICS & LIGHTING
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020617);
scene.fog = new THREE.FogExp2(0x020617, 0.004);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 600);
camera.position.set(0, 1.55, -5.1);
camera.lookAt(0, 1.10, -20);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.body.appendChild(renderer.domElement);

// Broadcast-Quality Post-Processing Pipeline
const composer = new THREE.EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

// Fine-Tuned UnrealBloomPass (Broadcast floodlight & specular radiance without turf/kit blowout)
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.14,   // strength — subtle halo on floodlight towers only
    0.35,   // radius — sharp optical halo around luminaire banks
    0.94    // threshold — prevents turf, white balls, and yellow kits from blooming
);
composer.addPass(bloomPass);

// Soft Cinematic Broadcast Vignette (Subtle telephoto lens falloff)
const vignettePass = new THREE.ShaderPass(THREE.VignetteShader);
vignettePass.uniforms['offset'].value = 1.04;
vignettePass.uniforms['darkness'].value = 1.05;
composer.addPass(vignettePass);

// Sharp FXAA Anti-Aliasing (Synchronized to true backbuffer resolution)
const fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
const curPr = composer._pixelRatio || Math.min(window.devicePixelRatio, 2);
fxaaPass.uniforms['resolution'].value.set(1.0 / (window.innerWidth * curPr), 1.0 / (window.innerHeight * curPr));
composer.addPass(fxaaPass);

// Cannon Physics World
const world = new CANNON.World();
world.gravity.set(0, -9.81, 0);
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 10;

const ballPhysMat = new CANNON.Material("ball");
const pitchPhysMat = new CANNON.Material("pitch");
const postPhysMat = new CANNON.Material("post");
const netPhysMat = new CANNON.Material("net");

world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, pitchPhysMat, { friction: 0.75, restitution: 0.45 }));
world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, postPhysMat, { friction: 0.2, restitution: 0.75 }));
world.addContactMaterial(new CANNON.ContactMaterial(ballPhysMat, netPhysMat, { friction: 0.98, restitution: 0.0 }));

// Matchday Broadcast Stadium Floodlighting & Character Illumination
const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x0d2614, 0.65);
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0x1e293b, 0.25);
scene.add(ambientLight);

// Primary Stadium Directional Key Light with High-Resolution 2048x2048 Orthographic Shadow Frustum
const goalKeyLight = new THREE.DirectionalLight(0xfff8eb, 1.35);
goalKeyLight.position.set(16, 34, 10);
goalKeyLight.target.position.set(0, 0.5, -14);
goalKeyLight.castShadow = true;
goalKeyLight.shadow.mapSize.width = 2048;
goalKeyLight.shadow.mapSize.height = 2048;
goalKeyLight.shadow.camera.near = 5;
goalKeyLight.shadow.camera.far = 85;
goalKeyLight.shadow.camera.left = -18;
goalKeyLight.shadow.camera.right = 18;
goalKeyLight.shadow.camera.top = 18;
goalKeyLight.shadow.camera.bottom = -18;
goalKeyLight.shadow.bias = -0.0004;
scene.add(goalKeyLight);
scene.add(goalKeyLight.target);

// 4-Point Stadium Floodlight Mast Arrays (Subtle cross-pitch rim/fill without washing out turf shadows)
const mastFloodlights = [];
const createMastFloodlight = (x, y, z, tx, ty, tz, castShadow = false, intensity = 0.26) => {
    const spot = new THREE.SpotLight(0xe0f2fe, intensity, 140, Math.PI / 3.2, 0.55, 1.2);
    spot.position.set(x, y, z);
    spot.target.position.set(tx, ty, tz);
    spot.castShadow = false;
    scene.add(spot);
    scene.add(spot.target);
    mastFloodlights.push(spot);
    return spot;
};

const floodlightNW = createMastFloodlight(-38, 33, -44, 2.5, 0.4, -18, false, 0.24);
const floodlightNE = createMastFloodlight(38, 33, -44, -2.5, 0.4, -18, false, 0.24);
const floodlightSW = createMastFloodlight(-38, 33, 26, 2.0, 1.2, -19.5, false, 0.26);
const floodlightSE = createMastFloodlight(38, 33, 26, -2.0, 1.2, -19.5, false, 0.26);
window.mastFloodlights = mastFloodlights;

