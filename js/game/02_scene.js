// ============================================================================
// 2. THREE.JS SCENE, CANNON PHYSICS & LIGHTING
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020617);
scene.fog = new THREE.FogExp2(0x020617, 0.004);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 600);
camera.position.set(0, 0.95, -6.5);
camera.lookAt(0, 1.10, -20);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// Broadcast-Quality Post-Processing Pipeline
const composer = new THREE.EffectComposer(renderer);
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

// Fine-Tuned UnrealBloomPass (Broadcast floodlight & specular radiance)
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.32,   // strength — balanced broadcast floodlight radiance without scene fogging
    0.45,   // radius — sharp optical halo around luminaire banks
    0.85    // threshold — highlights only floodlight emitters, metallic specular glints, and digital hoardings
);
composer.addPass(bloomPass);

// Soft Cinematic Broadcast Vignette (Subtle telephoto lens falloff)
const vignettePass = new THREE.ShaderPass(THREE.VignetteShader);
vignettePass.uniforms['offset'].value = 1.08;
vignettePass.uniforms['darkness'].value = 1.10;
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
const hemiLight = new THREE.HemisphereLight(0xf0f6ff, 0x1e3a1f, 0.72); // 5600K sky daylight tungsten with rich turf bounce
scene.add(hemiLight);

const ambientLight = new THREE.AmbientLight(0x334155, 0.40); // Stadium bowl shadow fill
scene.add(ambientLight);

// Dedicated High-Intensity Goalmouth Key Light (Brightens Goalkeeper Face, Kit & Gloves)
const goalKeyLight = new THREE.DirectionalLight(0xfffbf0, 1.25);
goalKeyLight.position.set(0, 18, -4);
goalKeyLight.target.position.set(0, 1.2, -20);
scene.add(goalKeyLight);
scene.add(goalKeyLight.target);

// 4-Point Stadium Floodlight Mast Arrays (5600K Daylight Tungsten: 0xf1f6ff)
// Cross-pitch lighting vectors producing realistic quad-shadows and specular gleams on aluminum posts & damp pitch
const mastFloodlights = [];
const createMastFloodlight = (x, y, z, tx, ty, tz, castShadow = true, intensity = 1.65) => {
    const spot = new THREE.SpotLight(0xf1f6ff, intensity, 140, Math.PI / 3.4, 0.38, 1.05);
    spot.position.set(x, y, z);
    spot.target.position.set(tx, ty, tz);
    if (castShadow) {
        spot.castShadow = true;
        spot.shadow.mapSize.width = 1024;
        spot.shadow.mapSize.height = 1024;
        spot.shadow.bias = -0.0004;
        spot.shadow.camera.near = 12;
        spot.shadow.camera.far = 135;
    }
    scene.add(spot);
    scene.add(spot.target);
    mastFloodlights.push(spot);
    return spot;
};

// 4 Corner Mast Floodlights:
// NW Mast Array (-38, 33, -44) -> Cross-pitch targeting pitch & goalmouth right channel
const floodlightNW = createMastFloodlight(-38, 33, -44, 2.5, 0.4, -18, true, 1.55);
// NE Mast Array (38, 33, -44) -> Cross-pitch targeting pitch & goalmouth left channel
const floodlightNE = createMastFloodlight(38, 33, -44, -2.5, 0.4, -18, true, 1.55);
// SW Mast Array (-38, 33, 26) -> Cross-pitch forward targeting penalty area and front of posts
const floodlightSW = createMastFloodlight(-38, 33, 26, 2.0, 1.2, -19.5, true, 1.70);
// SE Mast Array (38, 33, 26) -> Cross-pitch forward targeting penalty area and front of posts
const floodlightSE = createMastFloodlight(38, 33, 26, -2.0, 1.2, -19.5, true, 1.70);
window.mastFloodlights = mastFloodlights;

