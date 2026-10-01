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
