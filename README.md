# Football Strike: International

Three.js penalty football with Blender-authored articulated players and a stitched match ball.

## Play modes
- **Nations Cup:** three knockout rounds against CPU rivals.
- **Shootout:** five penalties per side, early resolution and paired sudden death. Rival penalties are simulated.
- **Target Rush:** 45 seconds, corner targets, streak bonuses and a saved personal best.
- **Training:** unlimited penalties, optional goalkeeper and unlimited freehand shots.

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
Shooting uses a first-person eye-level view. Draw the full flight of your shot with a mouse, finger or pen, finish at your target and release. The ball follows the complete shape: straight, bent, arched or S-shaped. The drawing is invisible; a small reticle shows the endpoint. Shots have a fixed pace independent of drawing speed.

The next penalty starts automatically after the result pause and the goalkeeper’s recovery. Replay suspends the transition until playback ends; completed matches open the results screen automatically.

Keyboard: arrows aim, Space shoots, Q/E adjust curl, Escape pauses. The game pauses when the tab is hidden. Cancelled touch gestures, extra fingers and screen rotation cannot launch an accidental shot.

Choose **Easy**, **Normal** or **Hard** from the home menu or before a penalty. Easy is the initial setting. The levels change reaction time, dive speed, reach, accuracy, wrong-way guesses and rival scoring. In the checked-in seeded 3,000-shot calibration, save rates are approximately 15%, 27.5% and 40%; these are simulation measurements, not predicted player success rates.

## Goalkeeper
The goalkeeper uses a dedicated Blender skinned model. Its joint animation includes a bent-knee set, a planted step and push-off, separate low/mid/high dives, hands leading the reach, side landing, a supporting hand, kneeling recovery and stepping back into position. Central saves use an upright block; high central shots trigger a vertical jump and parry. Collision capsules follow the visible gloves and limbs; the keeper commits to an imperfect read of the early shot direction. Replays reproduce the full motion.

## Verification
```sh
npm test
npm run verify
node tests/motion.cjs
python tools/motion_sheets.py
```
Run `npm ci` first to install the browser test dependencies. Deterministic physics tests cover scoring, posts, keeper saves, full-ball goal-line crossing, reproducibility and shootout rules. Puppeteer checks the actual UI on desktop, mobile and landscape. Results and screenshots are written to `verification/`. Performance readings from software-rendered CI are diagnostic, not a physical-device FPS guarantee.

## Architecture
- `js/penalty/keeper.js`: deterministic anatomical joint poses shared by the skinned model and collision.
- `js/penalty/gestures.js`: complete pointer-path sampling for mouse, touch and pen.
- `js/penalty/physics.js`: deterministic fixed-step ball and shootout rules.
- `js/penalty/world.js`: Three.js lighting, pitch, instanced crowd, stadium, net and actor rendering.
- `js/penalty/game.js`: menus, input, match state, replay and sound.
- `tools/build_keeper_assets.py`: dedicated skinned goalkeeper and editable Blender source.
- `tools/build_international_assets.py`: reproducible Blender source for GLB players and ball.
- `legacy.html`: original game retained for comparison and rollback.

The original GitHub Pages deployment stays on main until the overhaul is reviewed and merged. Once merged, deployments run the physics and browser suites before publishing. This is a single-player build; it does not implement online multiplayer.
