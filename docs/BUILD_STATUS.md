# International overhaul
Base: a56c581b0e52f2f159d3ade93c77ea6602e1527f
Branch: codex/international-penalty-overhaul

## Audit findings
- Country selection absent from active entry point.
- Ball launched immediately while the striker began a delayed run-up.
- Main duel mixed penalties with free kicks rather than keeping penalty play.
- Keeper collision and goal checks used loose volumes.
- Package test/verify scripts referenced files missing from the repository.
- Previously asserted visual-quality certifications had no checked-in supporting verification.

## Scope implemented
New playable entry point, preserved legacy game, twelve-country selector, four modes, deterministic shot engine, run-up-synchronised launch, keeper reactions, woodwork collisions, net reaction, replays, saveable settings, sound, keyboard/touch input, stadium and crowd, Blender asset generation and headless tests.

## Acceptance still requiring evidence
Read verification/report.json for the actual browser test outcome. No claim of superiority over Miniclip Football Strike or 60 FPS on physical devices is made. Exact official kit crests and detailed replica matching remain unfinished. Human comparison playtesting, mobile hardware performance, and animation/art polish need review.

## Controls and keeper revision
- Easy, Normal and Hard are exposed in both the home menu and match controls. Existing pre-revision settings migrate to Easy once.
- Fixed shot pace removes the old slow-swipe penalty. There is no power meter or curl slider.
- Mouse, pen, phone and tablet share pointer-event gesture recognition. The complete resampled path controls the shot, including vertical arches and S bends. No gesture line is drawn.
- Shooting uses an eye-level first-person camera. Nation selection and cinematic replays retain the player model.
- Touch cancellation, second fingers and viewport rotation are handled without firing.
- See verification/difficulty.json for seeded keeper calibration and verification/report.json for actual phone/tablet interaction results. Physical iOS/Android hardware testing remains outstanding.

## Freehand and goalkeeper revision (2.2)
- Sixty-five resampled gesture points become a perspective-correct world path. Timing depends on path distance at a fixed pace, rather than input-event speed.
- Dedicated original Blender goalkeeper with a continuous skinned body, elbow/knee weights, proportionate head, boots and detailed gloves.
- The deterministic joint solver uses planted feet, push-off, ballistic root motion, leading/trailing arms, separate low/mid/high dives, side landing and recovery. Central shots use an upright block/catch.
- Visible joints also drive swept ball contact. The old planar reach volume is removed.
- Replay and next-penalty timing preserve the recovery sequence.
- Motion review evidence: verification/motion/report.json and the low-left, mid-right, high-left and central contact sheets. The browser capture checks skin-bone alignment against collision joints.
- Reference cues: FIFA Training Centre, [mid-height dives](https://www.fifatrainingcentre.com/en/environment/fifa-goalkeeper-training/goalkeeping-fundamentals/learning-to-dive-at-mid-height.php) and [high dives](https://www.fifatrainingcentre.com/en/environment/fifa-goalkeeper-training/goalkeeping-fundamentals/learning-to-dive-high.php). The movement is procedural animation, not motion capture.
