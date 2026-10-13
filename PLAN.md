# Master Execution Plan (`PLAN.md`) — International Penalty & Free-Kick Training Game

## 1. Locked-In Design & Technical Scope
- **Single Unified Game Mode (`Training`)**:
  - One streamlined, instant-play **International Training Mode** (no multi-mode clutter).
  - **Progressive Combined Drill**: Starts with hanging corner bullseye targets, then introduces an agile diving **Goalkeeper** and **Free-Kick Training Mannequins / Wall** as your streak escalates.
  - **Varied Spot Progression**: Cycles dynamically from the 11m penalty spot out to 16m–22m free-kick angles around the penalty arc with an endless **Streak + Multiplier + High Score** loop.
- **Visual Target & Atmosphere (`Concept A` + `Concept C`)**:
  - **Floodlit Night Stadium Bowl**: Dramatic overhead stadium floodlights, subtle atmospheric twilight mist, enclosed multi-tier stadium bowl, manicured checkered pitch with crisp chalk lines.
  - **Static Matte Perimeter Boards**: Completely remove the distracting scrolling/moving LED advertising board. Replace with realistic, static matte-finish international tournament/training perimeter hoardings with Nano Banana-authored textures.
- **3D Pipeline (`Blender MCP + Three.js PBR + Nano Banana`)**:
  - **Blender MCP**: Author and export clean, collision-ready 3D geometry (regulation goal frame with corner joints & tensioned net hooks, articulated training mannequins, stadium architectural segments, and static hoarding frames).
  - **Nano Banana Texture Pipeline**: Generate bespoke 2K textures for turf blades, thermally bonded match ball panels, national kit fabrics, static perimeter sponsor boards, and bullseye rings.
  - **Rigged 3D Characters**: Athletic 3rd-person Striker (`#10`) and diving Goalkeeper (`#1`) with grounded boots, realistic cloth/skin shaders, and zero floating geometry.

---

## 2. Milestones & Deliverables

### Milestone 1: Single-Mode Streamlining & Nano Banana PBR Texture Pack
- Strip out multi-mode menu clutter so the game launches into a unified **International Training** mode.
- Remove all scrolling/moving LED hoarding animation logic.
- Launch parallel **Nano Banana** subagents to generate 2K textures for turf, static matte perimeter hoardings, match ball panels, and target rings.

### Milestone 2: Parallel 3D World & Asset Construction (Blender MCP + Three.js)
- **Subagent 1 (Pitch & Static Hoardings)**: High-density pitch with normal-mapped turf, chalk markings, and static matte perimeter boards with rear struts.
- **Subagent 2 (Blender MCP Goal, Net & Training Equipment)**: Regulation goal frame, corner joints, hexagonal net mesh, hanging corner bullseyes, and 3D free-kick training mannequins.
- **Subagent 3 (Night Stadium Bowl & Floodlights)**: Enclosed 360° tiered stadium bowl, roof trusses, 4 floodlight towers with atmospheric mist, and physical multi-light rig.
- **Subagent 4 (Characters, Ball & Progressive Training Loop)**: Grounded 3rd-person Striker (`#10`) and Goalkeeper (`#1`), progressive drill spawner (Targets -> Mannequins -> Diving Keeper across 11m–22m spots), and swipe-curve mechanics.

### Milestone 3: Iterative 4-Shot Adversarial Art Director Critic Loop (Target >= 9/10)
- Render 4 diagnostic views after every round: (1) 3/4 Overview, (2) Close-Up Surface Details, (3) Low-Angle Grounding Check, (4) Wireframe Geometry Check.
- Have the **Adversarial Critic Subagent** inspect all 4 screenshots, list >= 3 concrete flaws, and score out of 10. Iterate until **>= 9/10** and save every round to `progress.html`.

### Milestone 4: Interactive On-Screen Lighting, Texture & Camera Control Panel
- Add an on-screen control panel with live sliders for lighting, textures, and camera angles plus a **"Copy Settings as JSON"** button to bake preferred defaults.

### Milestone 5: 2K Nano Banana 1:1 Viewport Reference Target Renders
- Hide all UI/HUD overlays, capture clean screenshots from 4 key camera viewpoints, and pass each to **Nano Banana** at 2K resolution with the exact 1:1 photorealistic reference transformation prompt.

### Milestone 6: 1:1 Photorealistic Convergence & Final Polish
- Compare live 3D views side-by-side against the 2K Nano Banana target renders in `progress.html` and iteratively upgrade real 3D geometry, shaders, lighting, and materials until the live scene matches the 2K targets across every viewpoint.
