# Light Hunt development status

**P11-B · READY_FOR_REVIEW** — the final Persian-first theme is ready for owner review. Settings saves the player’s language choice, and `?lang=en` opens one English visit. [Play the game](../README.md#developer-setup)

**P11-A · COMPLETE** — the owner approved the difficulty at `1d56887`. The P10 build at `4fa8d16` was the comparison baseline.

**P10 · READY_FOR_REVIEW** — the full forest campaign, upgrade shop and reward-free practice are playable locally on `feat/p07-p10-gameplay-loop`. [Play the game](../README.md#developer-setup)

**P06 · READY_FOR_REVIEW** — the one-tunnel demo is playable locally. Owner feedback on steering and camera feel and physical-phone verification remain open. [Play the demo](../README.md#developer-setup)

**P02 · BLOCKED on the live probe** — the browser and Edge artifacts passed local verification. The live probe awaits an approved account, target, asset origin and spending boundary. [Staging probe](../edge/README.md#staging-probe-after-approval)

| Phase | State |
| --- | --- |
| P00 | `COMPLETE` |
| P01 | `COMPLETE` |
| P02 | `BLOCKED` |
| P03 | `COMPLETE` |
| P04 | `COMPLETE` |
| P05 | `COMPLETE` |
| P06 | `READY_FOR_REVIEW` |
| P07 | `COMPLETE` |
| P08 | `COMPLETE` |
| P09 | `COMPLETE` |
| P10 | `READY_FOR_REVIEW` |
| P11-A difficulty adjustment | `COMPLETE` |
| P11-B presentation | `READY_FOR_REVIEW` |
| P12–P15 | `NOT_STARTED` |

## P03 checkpoint

Implemented deterministic mission state and the active-time clock. Unit tests cover the three target fixtures, the 25-light result at second 73, the exact deadline under different frame schedules, pause, unique collection, exhausted opportunities, and same-seed retry. `npm run test:unit`, strict TypeScript and lint passed. Next in the authorized local range is P04.

## P04 checkpoint

The firefly lights a small area of the clearing. Pointer or keyboard input can find the opening, and releasing within the displayed ring enters the drop state. Chromium covered near-boundary release, invalid release with the clock still running, capture outside the playfield, pause, focus loss, resize and two-finger cancellation. The capture shows the release cue at an emulated 390 × 844 viewport. [Ready to release](evidence/p04-ready.png)

## P05 checkpoint

One distance-sampled curve connects the opening to a separate forest exit. The chase camera follows the centerline. The drop, ready and exit states freeze the clock. Geometry tests checked the camera seams, wall clearance and firefly framing in portrait and landscape. Chromium checked pause, resize and repeated rides on the same canvas. A 12-frame SwiftShader sample on the workspace host had a median interval of 150 ms. Physical-phone performance remains unmeasured. [Entry](evidence/p05-entry.png) · [Travel](evidence/p05-travel.png) · [Exit](evidence/p05-exit.png)

## P06 checkpoint

Fresh mouse, touch or keyboard input starts the tunnel. The firefly advances automatically while the player steers across the tunnel. Swept collision records first contact with each of 12 lights. Confirmed pickups update the score, flash and play a short note. The ride returns to the clearing and offers a same-layout retry.

Strict TypeScript and lint passed. `npm run test:unit` passed 23 tests, `npm run test:edge` passed 29, and `npm run test:browser:edge` passed 14 through the local Edge adapter. All seven gameplay browser tests passed again after the final keyboard timing fix. Chromium collected 4 of 12 by staying centered and 12 of 12 by steering. The browser suite also checked touch lift and recontact, pause, and a long frame that spans the end of travel and the return while charging only the active time. The local production preview emitted four Web Audio notes on the four-pickup keyboard run. [Emulated tunnel](evidence/p06-tunnel.png) · [Emulated result](evidence/p06-result.png)

## P07 checkpoint

The 25-of-36 mission now plays through three openings with a 90-second active clock. Chromium drove the 8+9+8 win at active second 73, checked that used openings stay shut and verified free retry with the same layout. The reducer and browser checks cover deadline and exhausted-opportunity outcomes. Camera tests verified the added routes in portrait and landscape.

## P08 checkpoint

The campaign advances through targets 22, 25 and 28. Each mission has three seeded tunnels and 90 active seconds. All 3,000 sampled layouts reproduced from their seed and allowed base steering to reach every light. The longest full route in the validation sweep took 29.197 active seconds. Geometry checks covered all nine template and anchor combinations in portrait and landscape. Chromium won missions 1 and 2 and opened mission 3 with its correct target and fresh clock.

## P09 checkpoint

A winning frame saves the elixir delivery and restoration before the return animation. The third win restores the last part of the forest, steadies the guardian’s torch and records the one-time 12-crystal reward. Nine save tests covered reload, duplicate completion, competing tabs, and storage failures. Chromium won all three missions, reloaded at the winning frame and during delivery, and verified the single reward and progressive restoration.

## P10 checkpoint

Purchasing the 10% exploration upgrade leaves 4 crystals, or the 10% collection upgrade leaves 2. Ownership and balance survive reload. Practice uses the chosen mission’s original darkness, time and target. It records a best score for that mission and equipment while preserving story progress and currency.

Strict TypeScript and lint passed. All 121 unit cases, 29 Edge contract cases and 26 Chromium cases passed across the first runs and focused reruns. Chromium completed the campaign and a 22-light practice run and exercised both purchases. Controlled cases checked both 10% radius effects. The slow host caused initial setup and geometry timeouts. The retry test now checks the saved layout identity and repeat collection directly. P06 device acceptance and the P02 live probe remain open.

## P11-A difficulty checkpoint

For new story assignments, entrances appear at 1.58 ground units instead of 1.86. The same seeded light trails call for 14% more sideways travel. The release ring, collision reach, forward speed, clock, mission targets and economy retain their P10 values. `forest-routes-2` identifies the tuned layouts. Previously assigned missions and their practice records still use their saved version and seed.

The same-seed comparison on mission 3 found 14 lights within reach of a centered flight in P10 and 12 after tuning. A model using base equipment, a 250 ms steering delay and a 0.10-unit aiming offset reached all 36 on each of the three campaign seeds. The existing validator checked 3,000 tuned seeds, with the slowest direct route at 29.197 active seconds. Archived P10 saves verified unfinished layouts, progress, upgrade ownership, both practice records and reward claims. These measurements support owner difficulty review. Perceived difficulty and physical-device comfort still need player feedback. The live P02 probe remains open.

Strict TypeScript, lint and 43 focused unit cases passed. Seven Chromium cases passed across focused runs. They checked the visible entrance and release boundary, same-layout retry and deadline, three campaign wins with reload and one-time reward, and upgraded practice.

## P11-B presentation checkpoint

The approved procedural firefly, forest, tunnel walls and owl remain the visual reference. New presentation assets are project-authored meshes, CSS icons and synthesized Web Audio cues. The firefly carries a visible elixir, the restored area brightens over 1.4 seconds and the guardian celebrates beside a steady final torch. Reduced motion displays each finished restoration immediately. Sound, reduced motion and pointer sensitivity save in the existing profile. The untimed tutorial uses the existing controls and leaves story progress intact.

The production build, strict TypeScript, lint and 37 focused unit cases passed. All 31 distinct Chromium cases passed across focused runs. They covered an eight-minute tutorial wait followed by keyboard completion, muted pickups and audio activation, manual pause across device preference changes, Persian landscape and narrow portrait layouts, and the three campaign wins with reload and reward checks. Chromium pixel samples verified gradual restoration and an immediate settled view with reduced motion. Physical-device steering, motion comfort and listening checks remain open alongside the P02 live ArvanCloud probe.

## Final P11 UI/UX checkpoint

A Chromium playthrough of `2f1852d` found menu actions below the phone viewport, briefing controls exposed behind the card, and shop feedback clipped after purchase. The menu now fits its actions and save notice on the first screen at the checked sizes. Native dialogs keep pointer and keyboard focus inside and return focus on Back or Escape. Briefings separate the light target, active time and tunnel count. Failure feedback suggests what to try on the next run. The guardian result has one clear next action. The shop keeps purchase confirmation above the choices and explains the shortfall on the remaining upgrade.

The production build, strict TypeScript, lint and 14 focused Chromium cases passed across two runs. The isolated phone-menu check passed after a concurrent headless startup timeout. Before and after, a full Chromium playthrough covered the tutorial, failure and retry, wins at 22/25/28 lights, the 12-crystal reward, an 8-crystal purchase, and 22-light practice. The final saved profiles matched byte for byte. Layout checks covered English and Persian, emulated touch, keyboard focus, 48px controls, and portrait and landscape sizes down to 320×568 and 568×320. Sampled text and focus contrast pairs ranged from 7.3:1 to 15.5:1. Physical-device testing remains open for P12, and the P02 live ArvanCloud probe remains pending.

### Before and after screenshots

| Screen | P11-B baseline | Final UI/UX pass |
| --- | --- | --- |
| Phone menu | [Before](evidence/p11-ux/menu-320-before.png) | [After](evidence/p11-ux/menu-320-after.png) |
| Mission briefing | [Before](evidence/p11-ux/briefing-390-before.png) | [After](evidence/p11-ux/briefing-390-after.png) |
| Failure and retry | [Before](evidence/p11-ux/failed-320-before.png) | [After](evidence/p11-ux/failed-320-after.png) |
| Guardian reward | [Before](evidence/p11-ux/guardian-reward-320-before.png) | [After](evidence/p11-ux/guardian-reward-320-after.png) |
| Shop after purchase | [Before](evidence/p11-ux/shop-owned-320-before.png) | [After](evidence/p11-ux/shop-owned-320-after.png) |

## Persian-first refinement

Fresh browsers load Persian RTL. A supported URL language takes precedence for that visit, and Settings saves an explicit language choice with the existing v1 profile. Added one 111,152-byte Vazirmatn v33.003 WOFF2 with its upstream OFL notice. A rendered desktop and mobile review of ChildXDesign informed the periwinkle surround, mint and gold controls, and rounded goal cards. The forest canvas and game rules retain their approved behavior. [ChildXDesign reference](https://childxdesign.com/) · [Vazirmatn release](https://github.com/rastikerdar/vazirmatn/releases/tag/v33.003)

Mobile screenshots from the running Persian preview show the [main menu](evidence/persian-theme/menu.png), [mission briefing](evidence/persian-theme/briefing.png) and [active tunnel HUD](evidence/persian-theme/tunnel-hud.png).

The production and local Edge builds, strict TypeScript, lint, 19 profile tests, 36 Edge route tests, and 14 distinct Chromium cases passed. Chromium identified the same-origin font as the source of the Persian menu, briefing and HUD glyphs. The locale checks covered default and visit-only language, saved selection, unsupported-language fallback, and entry-module recovery. Switching language preserved a completed campaign, crystal balance, upgrade, and practice record. The campaign was also replayed through its one-time reward and reload. Checks used emulated mobile portrait and landscape and a desktop viewport. P12 physical-device checks and the live P02 ArvanCloud probe remain open.

## P02 evidence

On 22 November 2026, a clean checkout of `aeb2d59` on Ubuntu 22.04 x64 with Node 26.13.1 and npm 11.20.0 installed 52 packages from the lockfile using `npm ci --offline --no-audit --no-fund` and a populated npm cache. The independent review caught a build path error for checkouts containing spaces and a missing artifact integrity check. The final build passed from a path containing a space, and the preview rejected locally altered worker and notice files.

| Check | Observed result |
| --- | --- |
| Builds and static checks | `PASS`. `npm run lint` and strict TypeScript passed. `npm run build:edge` produced byte-identical browser and Edge outputs in two checkouts. The separate worker is about 4.6 kB. Vite still reports the 565 kB minified renderer size advisory. |
| HTTP contract (T55–T56, local) | `PASS`. All 29 `npm run test:edge` cases passed. The actual loopback HTTP preview returned the expected GET/HEAD status, MIME and cache headers, including 400, 404 and 405 behavior. Controlled origin responses verified rejection of redirects, bad MIME, proxy loops and network failure. |
| Browser delivery and notice (G30, local) | `PASS`. All three `npm run test:unit` cases and seven `npm run test:browser:edge` tests passed. HTTP response hashes matched the manifest for the JS, CSS, 580-byte versioned PNG and notice. The notice contained the complete pinned Three.js MIT license. |
| Runtime and cache on ArvanCloud | `BLOCKED`. The live request, upload, deployed runtime, HTTPS origin, provider execution evidence and account limits await an approved target. T49's mission readiness behavior remains scheduled for P12. |

The local manifest SHA-256 is `601982ca79fdb401110937c54c10e5f0b2b451614bebeccd60ebadbe32f43286`. The local `worker.js` SHA-256 is `2883cd953b40d62e846c749bbd34e551ef3c559dce1de95896db78380efa6acb`. The staging build will bind the approved origin and record its own manifest and worker hash.

## P01 evidence

P01 starts at the [merged P00 baseline](https://github.com/vahid162/arvan-game/pull/1). The published source and test revision has the same file tree as the local revision `56dfd0f` used for the original checks. [Published P01 revision](https://github.com/vahid162/arvan-game/commit/2e221f89cb7d084c1f7a8f408e618949d7fc8c0b) · [Developer instructions](../README.md#developer-setup)

| Check | Observed result |
| --- | --- |
| Clean install and build (T01) | `PASS`. A fresh Linux x64 checkout installed 52 packages from the lockfile with `npm ci --offline --no-audit --no-fund` using a populated npm cache. `npm run build` ran strict type checking and Vite. Two builds produced byte-identical files. |
| Static and unit checks | `PASS`. `npm run lint` passed. All three `npm run test:unit` cases passed for portrait and landscape framing, pixel density, and a zero-sized viewport. |
| Chromium smoke and recovery (T02–T03, local scope) | `PASS`. `P01_CAPTURE=1 npm run test:browser` passed all seven tests in a clean checkout. A fresh profile loaded same-origin assets and rendered visible firefly pixels without uncaught errors. Resizing kept the same WebGL context. Pausing held the rendered frame. An unavailable WebGL 2 context showed guidance, and a graphics startup failure, missing entry script and truncated entry script each recovered on reload. |
| Browser package | `PASS`. Inspected `dist/` and resolved the entry page's script and stylesheet against the build. It contains one HTML page, one stylesheet, the entry script and the lazy renderer chunk. There are no credential files, source maps, service workers or install manifests. |

The [390 × 844 capture](evidence/p01-mobile.png) came from headless Chromium 159.0.8154.6 with SwiftShader at an emulated mobile viewport. It demonstrates the local shell and placeholder. Real-phone performance, game rules, and hosted HTTPS acceptance belong to later phases.

The build used Node 26.13.1 and npm 11.20.0 on Ubuntu 22.04 x64. The SHA-256 of the sorted build file hashes is `303a471b55072bb9c024327c2a6c39aa67509e5264cff63150d376fa36d4e560`. From `dist/`, reproduce it with `sha256sum assets/* index.html | sha256sum`. Vite reported its default chunk-size advisory for the lazy Three.js renderer (565 kB minified, 142 kB gzip).

## P00 evidence

The checkout of [vahid162/arvan-game at a7f57eb](https://github.com/vahid162/arvan-game/tree/a7f57ebc3dcbf94e75681d98f68aa687d5e3ad38) started on `main` with a clean index and working tree. The initial commit contained a one-line README. The second added the two English design documents. Neither revision contained an HTML prototype, application code, artwork, package manifest, lockfile, test suite, or CI workflow. Git had only its sample hooks and no configured hook path.

| Check | Result and reproduction |
| --- | --- |
| Repository and source identity | `PASS`. From the repository root, `git ls-tree -r a7f57eb` lists the scenario (LH-GAME-4.1-EN-ONLINE-1, blob `614cb66524161619b9ab2893c9c2679dae098378`) and plan (LH-EXEC-1.0, blob `647b8e292dcb1b5cfb805f3a1beebf25242ddb2e`). The Persian source named in the scenario is outside this checkout. |
| Scope review | `PASS`. The specification and plan agree on one forest, one guardian, three missions, two upgrades, and reward-free practice. G01–G02 and G28–G29 were reviewed for scope. The chapter ending is reserved for a later multi-world game. |
| P01 version selection | `PASS` for the published version and compatibility metadata. See the [candidate pins and sources](ARCHITECTURE.md). P01 will install and exercise them together. |
| Handoff | `PASS`. Reviewed the README, root [agent instructions](../AGENTS.md), this status and the architecture record. Checked relative document links, verified the two specification blobs against the working files, and inspected the diff for scope and whitespace. Instructions were read explicitly in this checkout. |
| Product checks T01–T60 | `NOT_RUN`. P00 has no executable build, game or test command. The [acceptance catalog](Light_Hunt_Codex_Phased_Implementation_Plan_EN.md#f-acceptance-catalog-and-requirement-traceability) assigns each check to its implementation phase. |

## Evidence needed in later phases

- **Device testing.** Select a mid-range Android phone with Chrome and an iPhone with Safari. Record the model, OS and browser when available. Compare with desktop Chromium. Mobile viewport emulation covers layout. Physical sessions cover touch handoff, camera comfort and the 30 FPS target.
- **ArvanCloud.** The account/project, staging domain and route, Storage/CDN origin, runtime limits, costs and authority for the live probe are unverified. The P02 remote check needs an approved target. This handoff has no hosted play URL or deployment evidence.
