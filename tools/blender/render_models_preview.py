import os
import time
import subprocess
from playwright.sync_api import sync_playwright

html = """<!DOCTYPE html>
<html>
<head>
<script src="js/three.min.js"></script>
<script src="js/GLTFLoader.js"></script>
</head>
<body style="margin:0;background:#0f172a;overflow:hidden;">
<script>
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0.9, 1.8);
camera.lookAt(0, 0.8, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xffffff, 0x475569, 0.8);
scene.add(hemi);
const dir = new THREE.DirectionalLight(0xffffff, 1.2);
dir.position.set(3, 4, 4);
scene.add(dir);
const dirFill = new THREE.DirectionalLight(0x94a3b8, 0.6);
dirFill.position.set(-3, 2, 3);
scene.add(dirFill);

const loader = new THREE.GLTFLoader();
window.loadModel = function(path) {
    while(scene.children.length > 2) {
        scene.remove(scene.children[2]);
    }
    window.loaded = false;
    loader.load(path, gltf => {
        const m = gltf.scene;
        // Compute bounding box and normalize
        const box = new THREE.Box3().setFromObject(m);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        m.position.x = -center.x;
        m.position.y = -box.min.y;
        m.position.z = -center.z;
        m.traverse(node => {
            if (node.isMesh) {
                const map = node.material && node.material.map ? node.material.map : null;
                node.material = new THREE.MeshStandardMaterial({
                    map: map,
                    color: map ? 0xffffff : 0xe2e8f0,
                    roughness: 0.6,
                    metalness: 0.1
                });
            }
        });
        scene.add(m);
        window.loaded = true;
    }, undefined, err => {
        console.error(err);
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

with open("preview_3d.html", "w") as f:
    f.write(html)

server = subprocess.Popen(["python", "-m", "http.server", "8891"])
time.sleep(1.5)

ARTIFACT_DIR = os.environ.get("FS_OUT_DIR", os.path.join(os.getcwd(), "tools", "verify", "out"))

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto("http://localhost:8891/preview_3d.html")
        page.wait_for_timeout(1000)

        for model_name in ["goalkeeper_pro_3d.glb", "wall_defender_pro_3d.glb"]:
            rel_path = f"assets/{model_name}"
            if os.path.exists(rel_path):
                page.evaluate(f"window.loadModel('{rel_path}')")
                page.wait_for_function("window.loaded === true", timeout=10000)
                page.wait_for_timeout(500)
                out_img = os.path.join(ARTIFACT_DIR, f"preview_mesh_{model_name}.png")
                page.screenshot(path=out_img)
                print(f"Captured: {out_img}")
        browser.close()
finally:
    server.terminate()
    if os.path.exists("preview_3d.html"):
        os.remove("preview_3d.html")
