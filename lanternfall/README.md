# Lanternfall — Rooms 1 & 2 ("The Lantern Steps", "The Beacon Span")

A low-poly puzzle-platformer. Hidden platforms exist only where your lantern's light reaches.

## Run
    npm install
    npm run dev      # open http://localhost:5173
    npm run build    # type-check + production build
    npm test         # unit tests (Vitest)
    npm run lint     # ESLint

## Controls
W A S D move · Space jump · Q lantern pulse · drag mouse or ← → turn camera · scroll zoom · R back to checkpoint · Esc pause · M mute

## The lantern rule (src/world/LightReveal.ts)
A hidden platform is *lit* when the lantern is within `radius` of the platform's nearest point.
Lit platforms are visible and solid. When the light leaves they stay solid for 0.6 s, then vanish.
Held radius = 3 m. Pulse (Q) = 12 m for 3 s, 5 s cooldown: use it to scout gaps the held light can't reach.
Note: a blind leap can still work, because the platform appears as you get close. The pulse is a scouting aid, not a lock.

## Beacons (Room 2)
Some bridge stones are *locked*: the lantern cannot reveal them. Walk to the crystal on the side ledge and pulse (Q)
within 4.5 m. It wakes and the bridge stays solid for the rest of the run (kept across respawns).

## Tuning with data
The win screen shows the platform you fell from most ("Most falls: leaving H5"). Use it to find unfair jumps.

## Structure
- src/core: Game (loop, wiring), GameState (menu/playing/paused/won), EventBus, dispose helper
- src/physics: aabb (box maths), PlayerBody (gravity, jump, collision; no graphics)
- src/world: LevelData (platform layout), LightReveal (the rule), Level (meshes), Environment (sky, lights, ruins), Tower
- src/player: Player (visible character + lantern), ThirdPersonCamera (follow camera)
- src/audio: Synth (all sounds generated live, no audio files) · src/fx: Sparkles · src/ui: Hud · src/input: Input
- tests: GameState, EventBus, PlayerBody, LightReveal, Level (includes a bot that completes the route)

## Design decision: no Rapier yet
Platforms are axis-aligned boxes, so a small custom collision system (PlayerBody) is simpler, deterministic and
fully unit-tested. Rapier can be added later if rotating or sloped geometry is needed.

## Status
Logic (physics, lantern rule, beacons, level layout, state machine) is unit-tested (74 tests under a stand-in runner). Rendering, HUD and audio code has NOT yet been
built or run by the author tooling (sandbox had no network). Run the commands above and report any errors.

## Known limitations
- One room only. Hidden platforms cannot be re-lit while you stand inside them (not needed in Room 1).
- Camera does not collide with geometry. No gamepad/touch support.

Commit 1

Commit 2

Commit 3

Commit 4

Commit 5

Commit 6

Commit 7

Commit 8

Commit 9

Commit 10

Commit 11

Commit 12

Commit 13

Commit 14

Commit 15

Commit 16

Commit 17
