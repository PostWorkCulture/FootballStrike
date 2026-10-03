import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))
PORT = 8893

html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>3D Character Showcase</title>
    <style>
        body { margin: 0; background: radial-gradient(circle at center, #1e293b 0%, #090d16 100%); overflow: hidden; font-family: sans-serif; }
        #badge { position: absolute; bottom: 24px; left: 24px; background: rgba(0,0,0,0.85); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; padding: 12px 20px; color: #fff; z-index: 10; }
        .badge-title { font-size: 16px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #facc15; }
        .badge-sub { font-size: 11px; color: #94a3b8; margin-top: 4px; font-weight: 600; }
    </style>
    <script src="js/three.min.js"></script>
    <script src="js/GLTFLoader.js"></script>
</head>
<body>
    <div id="badge">
        <div id="badge-title" class="badge-title">3D PLAYER SHOWCASE</div>
        <div id="badge-sub" class="badge-sub">51,777 VERTICES • VOLUMETRIC PBR MESH</div>
    </div>
    <script>
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0.95, 2.8);
        camera.lookAt(0, 0.95, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.35;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.appendChild(renderer.domElement);

        // Circular Studio Turf / Podium
        const podiumGeo = new THREE.CylinderGeometry(1.6, 1.7, 0.08, 64);
        const podiumMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.1 });
        const podium = new THREE.Mesh(podiumGeo, podiumMat);
        podium.position.y = -0.04;
        podium.receiveShadow = true;
        scene.add(podium);

        // Studio Turf Ring
        const ringGeo = new THREE.RingGeometry(1.48, 1.52, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.002;
        scene.add(ring);

        // Brilliant 4-Point High-Key Studio Lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x64748b, 1.8);
        scene.add(hemiLight);

        const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
        keyLight.position.set(0.5, 2.0, 3.5);
        keyLight.castShadow = true;
        scene.add(keyLight);

        const sideLightR = new THREE.DirectionalLight(0xffffff, 1.4);
        sideLightR.position.set(3.5, 2.5, 2.0);
        scene.add(sideLightR);

        const sideLightL = new THREE.DirectionalLight(0x93c5fd, 1.2);
        sideLightL.position.set(-3.5, 2.5, 2.0);
        scene.add(sideLightL);

        const rimLight = new THREE.DirectionalLight(0xfef08a, 1.6);
        rimLight.position.set(0, 3.5, -3.0);
        scene.add(rimLight);

        let currentModel = null;
        const loader = new THREE.GLTFLoader();

        window.loadShowcase = function(path, rotY = 0, title = '', sub = '') {
            if (currentModel) {
                scene.remove(currentModel);
                currentModel = null;
            }
            document.getElementById('badge-title').innerText = title;
            document.getElementById('badge-sub').innerText = sub;
            window.loaded = false;

            loader.load(path, gltf => {
                const m = gltf.scene;
                const box = new THREE.Box3().setFromObject(m);
                const center = box.getCenter(new THREE.Vector3());
                
                m.position.x = -center.x;
                m.position.y = -box.min.y;
                m.position.z = -center.z;
                m.rotation.y = rotY;

                m.traverse(node => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                        if (node.material && node.material.map) {
                            node.material.map.encoding = THREE.sRGBEncoding;
                            node.material.needsUpdate = true;
                        }
                    }
                });

                scene.add(m);
                currentModel = m;
                window.loaded = true;
            });
        };

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }
        animate();
    </script>
</body>
</html>
"""

with open("showcase_player_3d.html", "w", encoding="utf-8") as f:
    f.write(html)

server_proc = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(f"http://localhost:{PORT}/showcase_player_3d.html")
        page.wait_for_timeout(1000)

        # 1. Goalkeeper Full Body Front View
        page.evaluate("window.loadShowcase('assets/goalkeeper_pro_3d.glb', 0, 'PRO GOALKEEPER (1.95m)', 'VOLT GREEN KIT • LATEX GLOVES • 51,777 VERTS')")
        page.wait_for_function("window.loaded === true", timeout=10000)
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "preview_3d_gk_full_front.png"))

        # 2. Goalkeeper 3/4 Volumetric Angle View
        page.evaluate("window.loadShowcase('assets/goalkeeper_pro_3d.glb', 0.55, 'PRO GOALKEEPER (3/4 PERSPECTIVE)', '3D LIMB VOLUME • ATHLETIC SCULPT • PBR TURF SHADOW')")
        page.wait_for_function("window.loaded === true", timeout=10000)
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "preview_3d_gk_perspective.png"))

        # 3. Defensive Wall Player Full Body Front View
        page.evaluate("window.loadShowcase('assets/wall_defender_pro_3d.glb', 0, 'WALL DEFENDER (1.88m)', 'CRIMSON STRIPED KIT • CLEATS • 51,777 VERTS')")
        page.wait_for_function("window.loaded === true", timeout=10000)
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "preview_3d_wall_full_front.png"))

        # 4. Defensive Wall Player 3/4 Volumetric Angle View
        page.evaluate("window.loadShowcase('assets/wall_defender_pro_3d.glb', 0.55, 'WALL DEFENDER (3/4 PERSPECTIVE)', '3D VOLUMETRIC MESH • MUSCLE DEFINITION • PBR SHADING')")
        page.wait_for_function("window.loaded === true", timeout=10000)
        page.wait_for_timeout(600)
        page.screenshot(path=os.path.join(ARTIFACT_DIR, "preview_3d_wall_perspective.png"))

        print("Successfully captured all 3D character showcase previews!")
finally:
    server_proc.terminate()
    try:
        server_proc.wait(timeout=2)
    except:
        server_proc.kill()
