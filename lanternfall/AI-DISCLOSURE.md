# AI assistance disclosure

I estimate that Claude (by Anthropic) generated approximately 30% of the project's source
code. This is an estimate, not a line-by-line measurement; it corresponds to the 25-50% range on
forms that use those brackets.

## Written by Claude (AI-assisted)
- Milestone 1 scaffold; Room 1 vertical slice (player, camera, environment, lantern rule, HUD, audio)
- FBX character integration (loader, scaling, animation switching, fallback)
- Visual contrast/gate pass; fall tracking ("most falls" stat), squash/stretch and footsteps
- Milestone 2 step 1: beacon crystals, locked bridge, Room 2 layout, CI workflow, tests for all of the above

My estimate includes code generated with Claude and does not mean every listed feature was
written entirely by Claude; I reviewed and developed the project. I solely own the project. The
GitHub commit identities `noha` and `obig20` refer to me, not separate contributors.

## Update, 30 October 2026 (second Claude session)

In a later session Claude wrote the following. Each of these is its own commit and carries a
`Co-authored-by: Claude` trailer, so `git log --grep "Co-authored-by: Claude"` lists them.

- Camera collision (`src/physics/raycast.ts`, camera changes)
- Settings, best-run records and the safe storage wrapper (`src/core/Settings.ts`, `Records.ts`, `storage.ts`) and their HUD/Game wiring
- Gamepad and touch controls (`src/input/analog.ts`, `GamepadMap.ts`, `TouchControls.ts`, `Input.ts` changes)
- Moving platforms and Room 3 "The Drifting Gallery" (`src/world/MovingPlatform.ts`, Room 3 data, `Level.ts` and `Game.ts` changes)
- Tests for all of the above, including the Room 3 timing-window bot (`tests/helpers/room3Sim.ts`)

Size of that session: about 860 lines added to `src/` and about 720 lines to `tests/` (git diff --numstat
against commit 6667978). It was not playtested in a browser by Claude: the build, lint and unit tests were run,
but rendering, audio, touch and gamepad behaviour were not seen working.

Effect on the estimate above: taking the earlier ~30% figure as correct, this session raises Claude's
share of the `src/` code to roughly 50% (about 1,440 of 2,880 lines). The earlier estimate should be read as
superseded by this one. The owner reviewed the changes and is responsible for the project.
