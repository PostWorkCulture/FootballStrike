[Project Architecture]
- Core stack: Vanilla JavaScript, Three.js (WebGL), HTML5 Canvas, CSS.
- Assets: Store 3D GLB/glTF models and PBR textures in `assets/`.
- Performance: Enforce 60 FPS target; avoid dynamic memory allocations inside `requestAnimationFrame`.
- Physics & Controls: Maintain deterministic trajectory calculations and touch/swipe vector transformations.
- Verification: Run headless verification scripts before completing major gameplay changes.
