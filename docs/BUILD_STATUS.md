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
- Mouse, pen, phone and tablet share pointer-event gesture recognition. Changing swipe direction adds curl; straight diagonals remain straight.
- Shooting uses an eye-level first-person camera. Nation selection and cinematic replays retain the player model.
- Touch cancellation, second fingers and viewport rotation are handled without firing.
- See verification/difficulty.json for seeded keeper calibration and verification/report.json for actual phone/tablet interaction results. Physical iOS/Android hardware testing remains outstanding.
