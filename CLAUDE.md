# Jobsite Smash

A GTA-style open-world sandbox: free-roam heavy machinery on a construction
jobsite, crashing through piles of materials. Physics playground, no fail state.
Score/combo for destruction. Portfolio piece.

## Stack
- Three.js (vanilla, no React)
- Rapier (@dimforge/rapier3d-compat) for physics + raycast vehicle
- Vite for dev/build, deploys as static site

## Core design
- Free-roam, no timer. The fun IS the physics.
- Destructible piles = clusters of dynamic Rapier bodies that scatter on impact
- Arcade handling: weighty but responsive, not a hardcore sim
- Switchable cameras: chase cam AND top-down, toggle with C
- Multiple vehicles, switchable (bulldozer, excavator, dump truck, wheel loader)
- Vehicles are DATA-DRIVEN: one config object per vehicle (mass, speed,
  dimensions, etc.) so adding a machine is just adding a config entry

## Conventions
- Modular from the start: scene.js, physics.js, vehicles.js, camera.js,
  destructibles.js, score.js, controls.js, main.js
- Block out all geometry with primitives before any GLB models
- Touch controls required alongside keyboard
- Performance is a first-class concern: sleep settled bodies, despawn old
  debris, use instancing for repeated props
- Run the dev server after changes so I can see results

## Phase sequence
1. Scene + render loop + OrbitControls (temporary, for verification)
2. Rapier physics: ground collider + falling test bodies
3. Data-driven bulldozer with raycast vehicle, WASD + touch
4. Camera module: switchable chase + top-down, toggle with C
5. Destructible piles: clusters that scatter on impact
6. Score/combo system + HUD
7. Vehicle roster: 3-4 machines from config, switch with a key
8. Jobsite world: textures, boundary fence, props, a few buildings
9. Juice: engine audio, impact thuds, dust/debris particles, camera shake
10. Performance pass: body sleeping, debris despawn, instancing
11. Build + deploy to Netlify/Vercel

## Current phase
Phase 4 complete: camera module.
- camera.js: CameraRig with chase + topdown modes, toggle with C, smoothed follow
- topdown is world-aligned, +Z maps to screen-up; chase resets camera.up to +Y
- #cam-mode HUD indicator updates on toggle
- Bulldozer handling tuned faster: engineForce 3400, maxSpeed 28, damping 0.18
  (real top speed ~21.5 m/s, grounded/stable)
Next: Phase 5 (destructible piles: clusters that scatter on impact).

## Dev/preview notes
- node/npm only on PATH via /opt/homebrew/bin (Homebrew). The Bash tool and
  preview tool don't inherit it, so .claude/launch.json wraps the dev server in
  `/bin/sh -c "export PATH=/opt/homebrew/bin:$PATH && cd jobsite-smash && npm run dev"`.
- launch.json lives at the PARENT dir (.../ConGTA/.claude/launch.json), since the
  preview tool anchors to the working directory, not this subfolder.
