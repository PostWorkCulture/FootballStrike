# Football Strike: International

Three.js penalty football with Blender-authored articulated players and a stitched match ball.

## Play modes
- **Nations Cup:** three knockout rounds against CPU rivals.
- **Shootout:** five penalties per side, early resolution and paired sudden death. Rival penalties are simulated.
- **Target Rush:** 45 seconds, corner targets, streak bonuses and a saved personal best.
- **Training:** unlimited penalties, optional goalkeeper and an aiming trajectory.

Choose Sweden, England, Norway, Brazil, Italy, France, Germany, Argentina, Spain, Portugal, Netherlands or Mexico. The twelve home-strip recreations have distinct palettes and patterns; exact official crests and final pattern matching remain outstanding. See [kit references](docs/KIT_REFERENCES.md).

## Run
Node.js 22:
```sh
node tools/serve.cjs
```
Open http://localhost:8080. Assets are generated in the feature-branch CI and checked in after verification. If absent, install Blender and run:
```sh
npm run build:assets
```

## Controls
Shooting uses a first-person eye-level view. Swipe towards the goal with a mouse, finger or pen and release. Every shot has the same pace, so swipe speed is not a power control. Straight swipes give straight shots. Change direction near the end of the swipe to curl left or right. A visible trail follows the gesture.

Keyboard: arrows aim, Space shoots, Q/E adjust curl, Escape pauses. The game pauses when the tab is hidden. Cancelled touch gestures, extra fingers and screen rotation cannot launch an accidental shot.

Choose **Easy**, **Normal** or **Hard** from the home menu or before a penalty. Easy is the initial setting. The levels change reaction time, dive speed, reach, accuracy, wrong-way guesses and rival scoring. In the checked-in seeded 3,000-shot calibration, save rates are approximately 17%, 37% and 60%; these are simulation measurements, not predicted player success rates.

## Verification
```sh
npm test
npm run verify
```
Run `npm ci` first to install the browser test dependencies. Deterministic physics tests cover scoring, posts, keeper saves, full-ball goal-line crossing, reproducibility and shootout rules. Puppeteer checks the actual UI on desktop, mobile and landscape. Results and screenshots are written to `verification/`. Performance readings from software-rendered CI are diagnostic, not a physical-device FPS guarantee.

## Architecture
- `js/penalty/physics.js`: deterministic fixed-step ball and shootout rules.
- `js/penalty/world.js`: Three.js lighting, pitch, instanced crowd, stadium, net and actor rendering.
- `js/penalty/game.js`: menus, input, match state, replay and sound.
- `tools/build_international_assets.py`: reproducible Blender source for GLB players and ball.
- `legacy.html`: original game retained for comparison and rollback.

The original GitHub Pages deployment stays on main until the overhaul is reviewed and merged. Once merged, deployments run the physics and browser suites before publishing. This is a single-player build; it does not implement online multiplayer.
