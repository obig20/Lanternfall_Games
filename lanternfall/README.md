# Lanternfall (Rooms 1, 2 & 3)

A low-poly puzzle-platformer. Hidden platforms exist only where your lantern's light reaches.

Rooms: **The Lantern Steps** (hidden stones), **The Beacon Span** (crystal-locked bridge), **The Drifting Gallery** (moving and dark platforms, plus a lift).

## Run
    npm install
    npm run dev      # open http://localhost:5173
    npm run build    # type-check + production build
    npm test         # unit tests (Vitest)
    npm run lint     # ESLint

## Controls
| | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Move | W A S D | Left stick | On-screen stick |
| Jump | Space | A | JUMP button |
| Lantern pulse | Q | X, RT or RB | PULSE button |
| Camera | Drag mouse or Left/Right arrows, scroll to zoom | Right stick | Drag anywhere else |
| Back to checkpoint | R | Y | - |
| Pause | Esc / P | Start | II button |
| Mute | M | - | - |

The pause screen has volume, camera speed and invert-Y settings. Settings and your best time / fewest falls are saved in the browser (localStorage). If storage is blocked the game still works and just forgets between sessions.

## The lantern rule (src/world/LightReveal.ts)
A hidden platform is *lit* when the lantern is within `radius` of the platform's nearest point.
Lit platforms are visible and solid. When the light leaves they stay solid for 0.6 s, then vanish.
Held radius = 3 m. Pulse (Q) = 12 m for 3 s, 5 s cooldown: use it to scout gaps the held light can't reach.
Note: a blind leap can still work, because the platform appears as you get close. The pulse is a scouting aid, not a lock.

## Beacons (Room 2)
Some bridge stones are *locked*: the lantern cannot reveal them. Walk to the crystal on the side ledge and pulse (Q)
within 4.5 m. It wakes and the bridge stays solid for the rest of the run (kept across respawns).

## Progress, hints, splits, ghost and more
- **Continue:** the title screen offers to resume from your furthest checkpoint (src/core/Progress.ts). A continued run skips the start of the tower, so it never saves a best-time record. Starting fresh or finishing clears the save.
- **Hints:** one-time tips teach the pulse, the crystal, the drifting stones and the lift, and a "stuck" tip appears after three falls at one checkpoint (src/core/Hints.ts). Each tip shows once and is remembered between sessions.
- **Splits:** the best time to reach each checkpoint is saved, and the checkpoint message shows how far ahead or behind that pace you are (src/core/Splits.ts).
- **Ghost:** your best full run is recorded (10 samples a second, whole centimetres) and replayed as a translucent runner (src/core/Ghost.ts). It snaps across respawns, and is never recorded or shown for continued runs.
- **Achievements:** seven, shown on the win screen (src/core/Achievements.ts). The time targets (120 s and 75 s) are design guesses, not measured data. Retune them after timing real players.
- **Lifetime stats:** play time, falls and runs finished, shown on the pause screen (src/core/LifetimeStats.ts). Saved when you pause, finish, or every 30 seconds.
- **Settings:** tips on/off, ghost on/off and reduced screen flashing, next to volume, camera speed and invert-Y.
- **Rebindable keys:** every keyboard action can be changed in the pause menu (src/input/Keybinds.ts). Picking a key that is already used swaps the two actions, Escape always pauses and can never be bound, and a clash in saved data resets the layout. The gamepad follows the same layout for jump, pulse, restart and pause.
- All of these save to localStorage and fall back to memory if storage is blocked. They are unit-tested, but nobody has play-tested the wording or timing of the tips yet.

## Moving platforms (Room 3)
Platforms M1, M2 and the lift V1 slide along fixed paths (src/world/MovingPlatform.ts). Their position is a pure function of time, with easing and a pause at each end.
You are carried while standing on one; a platform that slides into you pushes you aside. M2 is a *dark* mover: it is only solid while your lantern lights it, like a hidden platform that also moves.
The gate is too high to jump to from the rest stop, so the lift is required.

## Tuning with data
The win screen shows the platform you fell from most ("Most falls: leaving H5"). Use it to find unfair jumps.
For Room 3 there is also a bot (tests/helpers/room3Sim.ts) that tries every start moment in a mover's cycle; each hop must succeed from at least 25% of them. That checks the timing windows are not unfair, but it does not replace watching real players.

## Structure
- src/core: Game (loop, wiring), GameState, EventBus, FallLog, Settings, Records, storage (safe localStorage), dispose helper
- src/physics: aabb (box maths), raycast (ray vs box, used for camera collision), PlayerBody (gravity, jump, collision; no graphics)
- src/world: LevelData (layout, movers, checkpoints), LightReveal (the rule), MovingPlatform (movers, carrying), Level (meshes), Environment, Tower
- src/player: Player (character + lantern), ThirdPersonCamera (follow camera with wall collision)
- src/input: Input (keyboard + gamepad polling), GamepadMap, analog (deadzones), TouchControls
- src/audio: Synth (all sounds generated live, no audio files) - src/fx: Sparkles - src/ui: Hud
- tests: unit tests for the logic above, plus jsdom tests for the menu screens, including bots that complete the route and sweep Room 3's timing

## Design decision: no Rapier yet
Platforms are axis-aligned boxes, so a small custom collision system (PlayerBody) is simpler, deterministic and
fully unit-tested. Moving platforms use the same boxes, updated each physics step. Rapier can be added later if rotating or sloped geometry is needed.

## Status
`npm run lint`, `npm run build` and `npm test` pass (278 tests). Tests cover the logic: physics, the lantern rule, beacons,
moving platforms, camera ray clipping, settings, records, gamepad mapping and level layout.
Rendering, HUD, audio, touch controls and the feel of the game are **not** covered by automated tests and need playtesting.

## Known limitations
- Hidden platforms cannot be re-lit while you stand inside them.
- Camera collision only considers platforms, not the decorative ruins.
- Menus (Begin / Resume / Play again) need a mouse or touch; the gamepad does not navigate them.
- Room 3's timing windows are checked by a bot, not by human players.

## History
The first 25 commits are batch updates ("Update 1" to "Update 19") plus documentation. From the camera-collision commit onward each feature is its own commit with a descriptive message. See AI-DISCLOSURE.md for who wrote what.
