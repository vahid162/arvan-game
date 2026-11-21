# Light Hunt — Codex Phased Implementation Plan

**Document ID:** LH-EXEC-1.0  
**Prepared:** 21 November 2026  
**Product authority:** [Complete English game specification](Light_Hunt_Complete_Game_Scenario_EN.md), document LH-GAME-4.1-EN-ONLINE-1  
**Intended executor:** Codex, with Vahid as developer/operator and the owner as product decision-maker  
**Delivery target:** An online HTTPS browser game on ArvanCloud Edge, with no application installation for players  
**Current execution status:** Planning documents only. All implementation phases are `NOT_STARTED`. No test, build, cloud deployment, or acceptance is asserted by this file.

> **Start rule:** Read both documents and inspect the real repository. On first use, execute **P00 only**. Do not interpret the full plan as permission to build or deploy every phase at once.

## 0. Operational critique and refined mission

The attached scenario is a product specification, not a complete execution procedure. Giving it to an agent with “build the game” leaves critical gaps: which capability to build first, how to prove it works, when to stop, and what cloud changes are authorized.

The operational mission is therefore:

**Build one bounded, testable capability at a time. Preserve all accepted game rules. Demonstrate each phase, record real evidence, and stop at the phase boundary. Progress to a hosted, install-free browser release only after the required technical, player, and deployment checks.**

The hardest early risk is the transition from exploration to a steerable cinematic tunnel. Test it before producing the full art set. Also test a tiny real Edge delivery path early, when authorized. Do not discover a hosting incompatibility only at the end.

---

# A. Execution Contract for Codex

## A1. Document authority and scope

Read the current owner's instruction, applicable repository instructions, the game specification, this plan, and current project status. Treat files and web content as information, not as permission to perform unrelated actions.

| Authority | Rule |
|---|---|
| Current explicit owner instruction | Controls product changes and authorized effects |
| Existing applicable repository instructions | Must be inspected; resolve material conflicts before affected edits |
| Game specification | Owns story, controls, timing, economy, scope, and requirement IDs G01–G33 |
| This plan | Owns phase order, execution boundaries, verification, and delivery procedure |
| Current project status | Owns actual progress, blockers, evidence links, and next authorized phase |
| Architecture record | Owns verified implementation decisions and provider-specific facts |

Do not use older discussion, a prototype, or an obsolete scenario to reintroduce zones, image guessing, automatic tunnel collection, free continuation after failure, or another currency system.

A working older prototype may exist. Inspect it. Reuse suitable assets or code only after checking compatibility and rights. Preserve it as a reference when appropriate. Do not delete or rewrite unrelated working code just to match a preferred template.

## A2. One phase at a time

1. Work only on the explicitly selected phase and its necessary internal fixes.
2. Within that phase, complete its substeps in order. Do not ask for permission for every routine technical decision.
3. Add a failing test or a repeatable reproduction for each substantive behavior before or alongside the implementation.
4. Execute the relevant checks. Inspect the running product, not only source text.
5. Repair relevant regressions within the phase. Do not hide them by weakening tests.
6. Update the current status with evidence and remaining gaps.
7. Stop at the phase boundary. The next phase requires a new request or an explicit standing authorization that names a range of phases.
8. Never advance merely because time or context is running short. Save a precise checkpoint and report unfinished work.

A phase may have several small tasks, but it must deliver one coherent capability or one coherent assurance outcome. Do not silently add later features as “supporting work.”

## A3. Phase status and evidence status

Use these states in the existing status document:

| Phase state | Meaning |
|---|---|
| `NOT_STARTED` | No authorized implementation has begun |
| `IN_PROGRESS` | Work has begun; at least one required item is unfinished |
| `BLOCKED` | A concrete dependency, access, evidence, or authority is missing |
| `READY_FOR_REVIEW` | Required technical checks passed; a named subjective or external gate remains |
| `COMPLETE` | Required scope, checks, and applicable review gates have passed |

Each test has a separate status: `PASS`, `FAIL`, `NOT_RUN`, or `BLOCKED`. Explain missing tests. Do not convert `NOT_RUN` to `PASS` because code appears correct.

A phase with a mandatory unperformed physical-device test or live-deployment check is not complete. Independent local work can proceed only when the owner authorizes the next phase and the dependency table allows it. Record the missing evidence as an open obligation; never silently waive it.

## A4. Action authority

Local scoped implementation, local tests, and documentation follow the phase request. The following actions need explicit current authorization or a verified standing policy for the actual target:

- Public or private cloud deployment, including a staging probe.
- Creating or changing paid resources, billing, domain routes, DNS, access, or secrets.
- Merging, publishing tags/releases, or pushing changes that trigger a deployment.
- Public release, production traffic switch, or a production rollback.
- Destructive data changes or deletion of historical artifacts.

Inspect scripts, Git hooks, and CI workflows before triggering them. A command named “test,” “build,” or “preview” can still have side effects. Do not invent approval, credentials, a domain, or an ArvanCloud account.

If access is unavailable, complete safe local preparation and state the exact blocker. Do not fabricate a working URL or substitute a different provider without approval.

## A5. Online and no-install boundaries

The game is a website. The player opens its HTTPS URL. The player's browser loads JavaScript, assets, and CSS. No executable installation, app store, extension, PWA installation, terminal, package manager, or runtime setup is allowed for players.

Normal browser cache and the specification's small local save are allowed. They are not an installed application. Do not claim that no code is received by the device or that localStorage is online cloud storage.

Do not implement remote game-video streaming, continuous multiplayer networking, accounts, or cloud saves. They are not required by the word “online.” The online readiness and recovery policy is in specification Part II.

The Codex/development machine may install development dependencies under the approved environment policy. That does not create a player requirement.

## A6. Technical decision ownership

Codex chooses routine engineering details and records the reasoning. Do not ask the non-programmer owner to choose test frameworks, low-level math, module names, or package patch versions.

Ask only for a missing product choice, material budget/risk decision, deployment authority, unavailable repository target, or a real conflict between requirements.

Use the existing compatible toolchain where it is sound. For a new repository, use the verified stable, mutually compatible versions of TypeScript, Three.js, Vite, Vitest, and Playwright. Pin dependencies through a lockfile. Select a supported Node.js version that satisfies those packages. Do not assume a version from memory or use an experimental release merely because it is newer.

No runtime call to an AI model is needed. AI assists development and optional asset preparation; it is not a hidden dependency during a player's mission.

## A7. Honest evidence and continuity

Keep the repository usable without this chat or the installed governance plugin. On a fresh session, read current documentation and status, then inspect the real Git state.

Record source revision, actual commands, environment, results, and limits. A screenshot proves an appearance, not collision correctness. A headless browser proves neither phone comfort nor physical-device performance. Self-review is not an independent review.

Do not claim that repository instructions are automatically loaded on every tool surface. Verify instruction discovery in the actual Codex environment. Keep `AGENTS.md` short and point it to the larger documents. Official Codex documentation explains its instruction discovery and size limits. [R1]

---

# B. Repository Setup and Durable Handoff

## B1. Place the two supplied files

Recommended location:

```text
project-root/
  AGENTS.md
  README.md
  docs/
    Light_Hunt_Complete_Game_Scenario_EN.md
    Light_Hunt_Codex_Phased_Implementation_Plan_EN.md
    STATUS.md
    ARCHITECTURE.md
  src/
  edge/
  tests/
```

The two Markdown links work when the files are in the same folder. If the repository has equivalent owners for status or architecture, reuse them and record the mapping. Do not create a second source of truth.

The owner receives only two documents from this preparation task. Repository support files are created or updated later in P00/P01 as authorized development work.

## B2. What each repository document owns

| File or existing equivalent | Owns |
|---|---|
| `AGENTS.md` | Short agent entry point, scope rules, verified command references |
| `README.md` | Developer setup, local usage, and the real hosted play URL when available |
| Game specification | Product rules and G01–G33 |
| Operational plan | Phase contracts and acceptance catalog |
| `docs/STATUS.md` | Current phase, evidence, blockers, and next action |
| `docs/ARCHITECTURE.md` | Actual technology versions, module boundaries, provider decisions, deployment/rollback procedure |
| Existing changelog | Notable user-facing or technical changes, not every tool call |

Do not put the entire specification in `AGENTS.md`. Do not repeat every rule in three files. Link canonical owners.

## B3. Short AGENTS.md seed

Adapt this only after inspecting the real repository. Do not overwrite unrelated valid instructions.

```markdown
# Light Hunt agent entry point

Read docs/Light_Hunt_Complete_Game_Scenario_EN.md for product rules.
Read docs/Light_Hunt_Codex_Phased_Implementation_Plan_EN.md for phase contracts.
Read docs/STATUS.md before choosing work. Reuse current architecture and commands.

Work only on the requested phase. If no phase is named on first entry, perform P00 only.
Preserve the user's changes. Inspect hooks and CI before commands with remote effects.
The product is an HTTPS browser game. Do not add a player installer, PWA, offline mode,
multiplayer, accounts, payments, image guessing, or independent zones.

Separate deterministic game rules from rendering and input.
Do not alter a valid rule or weaken tests to make the build pass.
Run affected checks and record actual evidence. Mark blocked checks honestly.
Do not claim physical-phone or live-Edge acceptance from local emulation.

Do not deploy, merge, publish, spend, or alter cloud access without applicable authority.
Do not put secrets in browser code or repository files.
At the phase boundary, update STATUS.md, report the result and limits, then stop.
```

Add actual command names after they exist. This seed is not evidence that any instruction was loaded or enforced.

## B4. Current-status record

Create a concise table, initially all `NOT_STARTED`, and a single active-phase block:

```text
Active phase: P00
Phase status: NOT_STARTED
Selected scope: repository discovery and planning setup only
Source baseline: LH-GAME-4.1-EN-ONLINE-1
Current branch/revision: inspect and record
Last completed capability: none verified under this plan
Tests executed: none
Required external evidence: physical phones; authorized ArvanCloud environment
Deployment status: not deployed under this plan
Next action: inspect repository and complete P00
```

At a phase stop, add: changed files, passed/failed/blocked checks, demonstration instructions, exact evidence links, and the smallest next action. Keep it accurate instead of accumulating an unreviewable diary.

---

# C. Architecture and Verification Contracts

## C1. Recommended modules

Use these boundaries unless the existing repository has a better compatible structure:

| Module | Contract |
|---|---|
| `src/game/core` | Pure state transitions, attempt rules, clock, terminal results, progression, economy |
| `src/game/input` | Pointer/keyboard input → domain commands; no crystal changes |
| `src/game/render` | Three.js scene, character, local light, tunnel geometry, camera, effects |
| `src/game/content` | Typed definitions, seeded generator, content version, validator |
| `src/game/save` | Profile schema, migrations, guarded writes, recovery, tab ownership |
| `src/game/network` | Hosted readiness and recoverable connectivity checks; no per-frame traffic |
| `src/ui` | DOM controls, HUD, menus, settings, result and shop views |
| `edge` | Small HTTP handler and verified provider adapter |
| `tests/unit` | Core, generation, progression, economy, save contracts |
| `tests/browser` | Real input sequences, state handoffs, rendering presence, network recovery |
| `tests/edge` | Route, method, MIME, cache, origin, and error contracts |

Do not introduce React, a physics engine, an entity-component framework, a backend database, or a state-machine library automatically. Add a dependency only when it solves a verified need better than a small maintainable implementation.

## C2. Shared state ownership

The core is the authority for clock, collected IDs, consumed tunnels, mission outcome, crystal balance, and owned equipment. The renderer reads a snapshot and plays presentation events. UI animations must never independently award resources.

Use domain commands such as `BeginAttempt`, `RequestRelease`, `BeginTunnelControl`, `Steer`, `Pause`, `Resume`, `RetryAttempt`, and `PurchaseUpgrade`. Name them to fit the project. Their validated semantics matter more than a specific class design.

The outcome reducer must not import Three.js. Input must not directly edit the save. Persistence must not depend on a cutscene callback completing.

## C3. Proposed command contract

The following are scripts to implement and verify, **not commands claimed to exist now**. Map them to existing equivalents when appropriate.

| Script | Required behavior |
|---|---|
| `npm run dev` | Local development server only |
| `npm run typecheck` | TypeScript validation without emitting a release |
| `npm run lint` | Existing or installed static checks |
| `npm run test:unit` | Deterministic logic and persistence tests |
| `npm run test:browser` | Browser tests against a controlled local build/server |
| `npm run test:edge` | Local Edge HTTP contract tests, explicitly not a live Arvan test |
| `npm run validate:content` | Seed/template checks and replayable failure reports |
| `npm run build` | Browser release output |
| `npm run build:edge` | Separate provider-compatible Edge bundle after adapter verification |
| `npm run preview` | Local preview of built browser files; never the production server |

Define scripts only when their checks exist. A command that prints “passed” without performing checks is not acceptable. Use locked local executables instead of ad hoc installation of unpinned tools during testing. Vite's default browser output is `dist`; its preview server is not for production. [R5]

## C4. Practical testing layers

| Layer | Tool choice or method | What it establishes |
|---|---|---|
| Pure logic | Vitest or an existing equivalent | Timing boundaries, unique collection, progression, economy |
| Browser interaction | Playwright or an existing equivalent | Input handoff, UI state, resize, network failure, console errors |
| Visual review | Captures from the actual running game | Visibility, camera framing, visual progression |
| Geometry/content | Deterministic validator and feasible steering witness | Template validity and baseline reachability |
| Physical device | Real touch play and frame-time capture | Actual controls, heat, performance, motion comfort |
| Provider integration | Authorized deployed HTTP tests | Actual Edge execution, assets, headers, cache, failure behavior |
| Player review | Short observed sessions | Understanding, perceived fairness, enjoyment, voluntary retry |

Vitest and Playwright are development dependencies, not player installations. [R6, R7]

**Initial support-evidence matrix:** Select and record a real mid-range Android phone with Chrome, a real iPhone with Safari, and a desktop Chromium browser. Add Firefox/WebKit automation where the environment permits it. These are proposed release-test targets, not evidence of support already achieved. A simulated mobile viewport or headless WebKit is not a real Android/iOS test. If a physical target is unavailable, keep that support claim and the associated acceptance gate pending rather than inventing a result.

## C5. Technology and risk decisions that must be recorded

Before treating a phase as complete, record its affected decisions: package versions, browser support, coordinate system, active-time calculation, save strategy, and release identity. Do not create a separate bureaucracy for each function.

High-risk changes to live access, production configuration, or save migration require a distinct qualified technical review. If no reviewer is available, report that gate as blocked. The owner is not expected to inspect source code.

---

# D. Phase Map

All phases start as `NOT_STARTED`. There are **16 phases: P00 through P15**. This order prioritizes the difficult camera/control slice while keeping online delivery explicit.

| Phase | Deliverable | Hard dependency | Main requirements |
|---|---|---|---|
| P00 | Repository baseline and durable agent instructions | Repository identified | All scope boundaries |
| P01 | Browser shell, renderer support, and real test toolchain | P00 | G02, G23, G30 |
| P02 | Minimal Edge delivery proof and route contract | P01; remote part needs authority | G25–G27, G30–G32 |
| P03 | Tested headless mission rules and active clock | P01 | G08–G12, G19 |
| P04 | Dark exploration, hole discovery, aim-and-release | P03 | G03, G04, G19 |
| P05 | One cinematic entry/tunnel/exit camera path | P04 | G05, G20 |
| P06 | Steerable tunnel and actual light collection | P05, P03 | G06–G08, G20 |
| P07 | Complete three-tunnel mission, result, and retry | P06 | G09–G12, G18–G19 |
| P08 | Seeded content, three templates, and validity checks | P07 | G17, G08, G12 |
| P09 | Durable mission completion, elixir, restoration, guardian reward | P08 | G01, G13–G14, G24 |
| P10 | Two upgrades and fair reward-free practice | P09 | G15–G16 |
| P11 | Final one-world presentation, tutorial, UI, and settings | P10 | G18, G20–G21, G29 |
| P12 | Mobile performance and interruption hardening | P11 | G19, G22–G24, G30–G32 |
| P13 | Reproducible release candidate on Arvan staging | P12; verified P02 provider proof | G25–G27, G33 |
| P14 | Player acceptance and evidence-based tuning | P13 | G01–G33 as applicable |
| P15 | Authorized production release, smoke test, and rollback evidence | P14; explicit release authority | G27, G30, G33 |

**External-gate exception:** P02's live probe may be blocked by account access. P03–P12 do not technically require that remote proof. The owner can request those phases after local route preparation is recorded. Keep P02 visibly blocked until its live evidence exists. P13 and production acceptance cannot bypass it.

**Checkpoint rule:** At the end of every phase, stop. No automatic continuation is implied by the table.

---

# E. Phase Work Packages

## P00 — Discover the repository and establish the contract

**Outcome:** A trustworthy project starting point. No gameplay feature is added.

**Read:** Both supplied documents in full; all current project documentation; existing root/nested agent instructions; package files; status; relevant workflows; Git status and branch. Treat older files as historical unless the owner made them current.

**Work, in order:**

1. Identify the actual project root and source repository. If none is provided, report that required target rather than guessing a remote repository.
2. Inspect the working tree. Identify concurrent edits and preserve them.
3. Inventory any existing HTML MVP. Record which current requirements it meets, misses, or contradicts. Do not assume it already uses Three.js or current tunnel control.
4. Choose the smallest reuse/migration route consistent with the game specification. Do not discard a functioning implementation without a documented benefit.
5. Place the two authoritative documents, or map them to existing equivalents. Add/update a short AGENTS.md and STATUS.md. Record architecture facts, not aspirational claims.
6. Check current official compatibility information for the intended stack. Record versions to pin in P01. Do not perform a blanket dependency upgrade on an existing working project.
7. List missing cloud account/domain authority and physical test devices. These are external requirements, not reasons to stop safe repository work.

**Do not:** Build gameplay, create paid resources, deploy, rename the game commercially, or commit another person's changes.

**Verification:** Confirm source-document identity; inspect diffs; record actual baseline checks if they already exist. “No test command exists yet” is valid evidence, not a passing test.

**Exit:** Product and authority boundaries are clear. The status file points to P01. If the repository target is unavailable, mark P00 blocked with that exact missing input.

**Phase prompt:** `Execute P00 only. Inspect the real project, preserve concurrent work, establish canonical document routes, and report the baseline. Do not build game features or deploy.`

## P01 — Create the install-free browser shell and test foundation

**Outcome:** A browser page that starts safely, detects graphics support, and runs a real minimal Three.js scene.

**Work:**

1. Create or adapt TypeScript/Vite configuration with strict checks and a lockfile. Separate browser and Edge code directories.
2. Install only justified development/rendering dependencies in the developer environment. Keep the player path browser-only.
3. Add a DOM shell with loading, unsupported-device, and failure states. Create one simple firefly placeholder and a minimal scene.
4. Size the canvas for mobile and desktop. Cap rendering density through configuration. Handle resize without rebuilding the application unnecessarily.
5. Add actual unit and browser test scripts. At least one unit test must catch a real invariant; one browser test must load the page and assert a rendered scene plus no uncaught error.
6. Record how to run and build the local project. Add no PWA manifest, service worker, installer, or offline download.

**Tests:** Unsupported WebGL 2 is a clear message, not a blank canvas. Resize preserves a visible scene. Production output contains valid resource URLs. A fresh browser can run without a plugin. Inspect the package output for accidental secret files.

**Evidence:** Typecheck, lint, build, tests, and an actual browser capture at a mobile-sized viewport. Label emulation as emulation.

**Do not:** Add a shop, full world, new backend, or a production deployment.

**Exit:** A clean reproducible build and browser smoke test exist. Commands in README are verified.

**Phase prompt:** `Execute P01 only. Deliver the browser shell, minimal rendered scene, compatibility handling, and verified test/build commands. No player installation or PWA.`

## P02 — Prove the smallest ArvanCloud delivery path

**Outcome:** A small HTTP contract and, when authorized, a real hosted proof before the game becomes large.

**Local work:**

1. Verify current official ArvanCloud Edge handler syntax, bundling expectations, routes, and asset-origin options. Document account limits as unknown until observed.
2. Build a minimal Edge adapter with a root HTML response, a no-store health route, and access to one versioned JS file plus one small model or texture from an allowlisted origin.
3. Keep browser and Edge outputs separate. Do not upload `dist` as a worker script or run Node.js persistently by assumption.
4. Test allowed methods, HEAD behavior, missing-file 404, correct MIME types, an upstream failure, and rejection of visitor-supplied proxy destinations.
5. Prepare the exact remote probe and cost/access requirements. No credentials belong in these documents or the client bundle.

**Authorized remote work:** Deploy only to the approved test target. Verify the actual HTTPS root, health response, browser JS, and asset. Record deployment ID, artifact hash, URL, and observed headers. Inspect Edge execution evidence available in the account. CDN delivery alone does not prove the Edge function ran.

**Safety:** Do not create accounts, buy domains, switch production traffic, or make Storage contents broadly public beyond the approved game assets. Follow verified provider procedures; do not invent CLI commands or copy Cloudflare deployment configuration.

**Exit:** Local contract tests pass and real provider proof exists. If remote authority is absent, keep the phase blocked on external evidence; safe later development may be separately authorized as described in the phase map.

**Phase prompt:** `Execute P02 only. Prepare and test the minimal Edge delivery contract. Perform the remote probe only with explicit target authority. Report local and actual-provider results separately.`

## P03 — Implement the mission domain and active clock without graphics

**Outcome:** Deterministic game rules with tests, before visual code can hide errors.

**Work:**

1. Define typed world, mission, generated-content, attempt, collectible, outcome, profile, and upgrade contracts. Use the specification's fields and values.
2. Implement the state reducer and active-time accumulator independently of Three.js, DOM, and localStorage.
3. Define terminal-event ordering: collect at or before the deadline; latch success exactly once; ignore late or duplicate events.
4. Implement consumed-tunnel and unique-collectible sets. Define the remaining-opportunity check after an exit.
5. Implement pause/resume commands that freeze simulation and time together. Define retry as a new attempt over the same immutable generated mission.
6. Create deterministic fixtures for all three target values and the 8+9+8-at-second-73 example.

**Tests:** Target at deadline succeeds. Target after deadline fails. A frame straddling the deadline gives the same result at different frame rates. Paused time does not count. Success cannot later fail. Duplicate light IDs cannot increase the counter. The last tunnel below target fails immediately.

**Design note:** Do not equate render frames with time. Use a monotonic active-time domain. Never silently discard time debt to make a slow device pass.

**Do not:** Create full cinematic art, fake browser gameplay, or an economy grant from a UI animation.

**Exit:** Core tests prove the exact outcome rules with no rendering dependency.

**Phase prompt:** `Execute P03 only. Implement and test the deterministic mission state, clock, collection identity, terminal ordering, opportunity check, and same-seed retry contracts.`

## P04 — Build dark exploration and aim-and-release

**Outcome:** The player can guide the firefly in darkness, discover a hole, and intentionally release into it.

**Work:**

1. Render a simple fixed-angle world and limited light around the firefly. Keep placeholder geometry sufficient for playtesting.
2. Convert primary pointer drag to world movement. Offset the visible character from the finger without changing the visible meaning of a valid release.
3. Add one hole with a configurable valid-entry area. Match the readiness ring to the actual acceptance rule.
4. Separate intentional pointer-up from cancellation, blur, hidden page, and resize. A UI click must not steer or release through the overlay.
5. Add invalid-release feedback. It preserves resources and does not secretly stop active time.
6. Add a keyboard exploration equivalent and pause controls. Maintain one active pointer.

**Tests:** Release at the edge of the advertised area. Release outside it. Cancel while over it. Drag outside the canvas with capture. Touch with a second finger. Use the pause button while dragging. Switch focus and resize.

**Evidence:** Actual interaction captures and browser tests for valid/invalid/cancelled release. State assertions must show why a drop did or did not occur.

**Do not:** Add automatic snapping that contradicts the displayed area, a hidden timing window, or gesture-specific scoring advantages.

**Exit:** Entry behavior is predictable and repeatable. A cancelled touch never starts a drop.

**Phase prompt:** `Execute P04 only. Deliver exploration, limited visibility, readable hole readiness, intentional release, and safe cancellation. Keep the world visually simple.`

## P05 — Solve the cinematic camera with one tunnel

**Outcome:** A smooth drop, chase journey, and exit that preserve spatial orientation.

**Work:**

1. Create one tested center curve and lightweight tunnel. Define world units, forward distance, local right/up axes, tube radius, camera clearance, and entry/exit transforms.
2. Move by path distance, not raw curve parameter. Keep frame construction continuous through bends; do not allow the lateral axis to flip.
3. Blend exploration camera to a behind-character chase view and back. Follow the center path, not every lateral body movement.
4. Add `DROP_TRANSITION`, `TUNNEL_READY`, and `EXIT_TRANSITION`. Freeze the relevant clock and scoring during forced transitions.
5. Implement reduced motion with stable orientation and limited extra effects. It must not remove collectibles or change success rules.
6. Dispose of temporary scene resources on repeated entry and exit.

**Tests:** Camera starts and ends at the correct anchor. No abrupt pose jump at handoff. No inside-wall view at representative curve samples. Ready state does not advance. Resize and pause do not teleport the camera. Repeating travel does not add an extra animation loop.

**Evidence:** Record video or a frame sequence from the running build, including entry and exit. Include frame-time observations from available hardware. Use a real phone as early as access permits; otherwise record the missing test.

**Boundary:** A camera-only automatic travel preview is acceptable for this phase, but it is not the final gameplay. Do not declare the MVP playable yet.

**Exit:** The path and camera are structurally valid and ready for steering. Subjective feel is reviewed again after P06.

**Phase prompt:** `Execute P05 only. Solve one smooth cinematic tunnel with stable orientation and reduced motion. Prove camera continuity and clearance; do not add obstacles or shop systems.`

## P06 — Add horizontal steering and real collection

**Outcome:** The defining skill loop works in one tunnel.

**Work:**

1. At `TUNNEL_READY`, require fresh input. Rebase touch/mouse position so the first sample cannot jump the firefly sideways.
2. Advance forward automatically. Apply bounded lateral movement in the tunnel-local frame. Mouse and touch obey the same movement limits.
3. Place 12 identified light particles on an attainable pattern. Collect through swept collision or a proven equivalent. Visual attraction starts only after a valid collection event.
4. When touch is lifted, keep lateral position while forward travel and time continue. New touch resumes without teleportation.
5. Give immediate visual and audio feedback and a true collected count. Missing a light must remain possible.
6. Integrate pause, cancellation, and visibility handling. Preserve camera stability while steering to both extremes.

**Tests:** Passing near but outside a light does not collect it. Sweeping through it at low FPS does. The same light counts once. Lifting a finger does not pause the tunnel. Resume input does not collect distant lights. Steering behaves correctly in bends.

**Evidence and owner checkpoint:** Demonstrate search → release → fresh input → steer → collect/miss → exit. Ask for judgment of control and camera feel, not source-code review. Do not spend heavily on final art before this slice is accepted.

**Do not:** Add jumping, obstacles, unrestricted vertical control, automatic perfect collection, or a different input mode to hide a failed handoff.

**Exit:** The owner can see a genuine skill difference between a good and poor run. Mandatory physical-device evidence remains explicit if unavailable.

**Phase prompt:** `Execute P06 only. Add fresh-input tunnel steering and real once-only light collection. Demonstrate misses as well as pickups. Stop for the core-control and camera-feel review.`

## P07 — Complete one timed three-tunnel mission

**Outcome:** One full mission can succeed, fail, pause, and retry correctly.

**Work:**

1. Connect three hole/tunnel opportunities to the existing domain model. Use a target-25 fixture with 36 available lights and 90 active seconds.
2. Add mission briefing, HUD, and result views. Start only after assets and player readiness are confirmed.
3. Consume time in exploration and controllable travel only. Check the deadline inside both states.
4. On success, latch the outcome immediately and use a short automatic safe exit. No further collection occurs.
5. On normal exit, mark the tunnel consumed and evaluate remaining opportunities. Prevent re-entry from generating more light.
6. Add exact failure messages and immediate free same-seed retry. Do not lose earlier profile data.

**Tests:** Replay the 8+9+8 trace. Expire inside a tunnel. Fail from insufficient remaining light before the timer ends. Finish the last tunnel below target. Reach target at the deadline. Attempt collection during a transition or after success. Retry and compare the full generated manifest.

**Demonstration:** Show one successful attempt, one deadline failure, and one opportunity-exhausted failure without debug shortcuts in the player UI.

**Do not:** Give crystals here, make failure optional, change a 90-second rule into a speed bonus, or reroll difficulty on retry.

**Exit:** Every terminal path returns to a usable result/menu/retry state. The mission cannot hang or double-complete.

**Phase prompt:** `Execute P07 only. Integrate the full three-tunnel mission with exact active-time, success, failure, consumed-hole, and same-seed retry behavior.`

## P08 — Add seeded content and prove validity

**Outcome:** Three mission configurations use validated variety without hand-authored stories for every attempt.

**Work:**

1. Create a versioned generator over authored anchors, three tunnel templates, and valid light patterns.
2. Implement mission targets 22, 25, and 28 out of 36. Keep 90 active seconds and 12 lights per tunnel. Do not change several difficulty factors at once.
3. Persist or deterministically reconstruct each mission's exact manifest using seed, content version, and generator version.
4. Validate unique IDs, valid anchors, entry/exit connections, camera clearance, lateral reachability, and plausible time allowance.
5. Produce at least one feasible baseline steering witness for the required target. Counting objects or verifying adjacent pairs alone is insufficient when a whole sequence is unreachable.
6. Limit generation attempts and provide a known-good fallback. Keep world identity and restoration geometry stable.

**Tests:** Same identity produces the same content. Different approved seeds provide variety. Deliberately invalid patterns fail validation. The fallback terminates. At least 1,000 deterministic sample seeds are checked as a provisional project target, with failing seeds saved for reproduction.

**Fairness check:** A witness proves technical possibility, not human fairness. Sample missions still need player testing. Allow a realistic search/control margin; do not tune to an ideal bot alone.

**Do not:** Generate new images or geometry through live AI calls, change a failed player's seed, or equate recoloring with meaningful variety.

**Exit:** Generator version, seed fixtures, validation reports, and content limitations are documented.

**Phase prompt:** `Execute P08 only. Deliver three mission definitions and a bounded, versioned generator over validated templates. Prove baseline reachability and same-seed retries.`

## P09 — Persist success and restore the world

**Outcome:** Three successful missions produce durable restoration, a stable torch, and one guardian reward.

**Work:**

1. Implement a validated profile schema and a save adapter. Keep a single authoritative completion representation.
2. Save the success latch/pending delivery before animation. Make completion idempotent by mission ID.
3. Render restoration from saved mission IDs. Failed attempts must not darken previously restored scenery.
4. Present elixir creation, guardian delivery, and stronger torch states. Presentation can be replayed or skipped safely without changing grants.
5. After the third mission, grant 12 crystals once and save the world reward claim with the balance update.
6. Handle reload during success, delivery, and reward. Handle unavailable/corrupt storage and unknown newer schemas without silent deletion.
7. Enforce the documented single-active-profile-tab policy. Do not claim server-level concurrency guarantees from browser storage.

**Tests:** Reload immediately after threshold success. Reload during delivery. Reload the world reward view repeatedly. Simulate write failure. Load corrupt and future-version saves. Fail mission 2 after completing mission 1. Open a second tab and attempt conflicting profile changes.

**Demonstration:** Restore about one-third, then more, then all of the same world. Close and reopen the browser. Show the saved guardian and balance.

**Do not:** Require login, add a database or cloud sync, grant crystals per mission, or let an animation callback be the only protection from duplicate rewards.

**Exit:** Progress survives normal reload on the same supported browser/origin. Limitations and storage failures are visible to the player.

**Phase prompt:** `Execute P09 only. Deliver durable mission success, elixir presentation, permanent world restoration, and the once-only 12-crystal guardian reward. Verify reload and partial-failure recovery.`

## P10 — Add two upgrades and meaningful practice

**Outcome:** The guardian reward can buy one real upgrade, and the player can use it without farming story rewards.

**Work:**

1. Implement the shop between attempts with balance, price, effect, ownership, and clear purchase feedback.
2. Add one +10% exploration-radius level for 8 crystals and one +10% collection-radius level for 10 crystals.
3. Validate affordability and ownership before saving a purchase. Capture the equipment loadout when an attempt starts.
4. Add replay/practice using the same game rules. Keep practice records separate by mission, seed/rules, and loadout where needed.
5. In practice, use a temporary training darkness presentation so exploration upgrades can be tested. It must not remove the saved world's restoration. This is the explicit practice clarification in the game specification.
6. Make the limit clear: with 12 crystals, the player can buy one of the two upgrades, not both. Do not invent farming or payments to remove that choice.

**Tests:** 12 minus 8 equals 4. 12 minus 10 equals 2. A repeated click or reload does not repurchase an owned level. Insufficient funds cannot make a negative balance. Effects are measurable in their correct coordinate domain. Practice cannot grant an elixir or crystals or reset restoration.

**Demonstration:** Compare base and upgraded reach using a controlled fixture, then complete a practice run without additional story currency.

**Do not:** Add time purchases, consumables, extra upgrade tiers, ads, free currency buttons, or false promises about future content.

**Exit:** Purchases are real, bounded, saved, and useful. Practice leaves story state intact.

**Phase prompt:** `Execute P10 only. Implement the two specified upgrades and reward-free practice. Verify exact arithmetic, owned-state guards, real effects, and preserved story restoration.`

## P11 — Finish the one-world player presentation

**Outcome:** The accepted mechanics become a coherent, readable fantasy experience.

**Work:**

1. Replace placeholders with a consistent cartoon firefly, one world, one guardian, torch states, tunnel styling, light/elixir/crystal effects, and two upgrade icons.
2. Use one approved visual reference before producing variants. Record asset origin and license/permission. Keep text out of generated images.
3. Add the untimed tutorial for exploration, release, fresh tunnel input, steering, and the target/time rule. Do not grant story rewards there.
4. Finish loading, briefing, HUD, pause, failure, success, shop, practice, and settings. Use concise instructions and real text/localization keys.
5. Add short joyful reactions and sound. Start audio only after user interaction. Keep mute and reduced-motion preferences persistent.
6. Implement smooth progressive world restoration and the first guardian's celebration. Include at most a truthful continuation hint about the wizard, not a full-campaign victory or new boss combat.
7. Review primary button size, focus visibility, color-independent cues, readable text, RTL/LTR layout, and pointer-safe overlays.

**Tests:** Muted play remains understandable. Keyboard equivalents can complete the relevant controls. HUD stays visible on narrow and landscape screens. Used-hole cues remain distinct. Tutorial leaves the story profile unchanged. No effect flashes aggressively or blocks collection.

**Owner review:** Show actual play, not a concept image. Review visual identity, joy, clarity, and the reveal payoff. The player-facing language is a product review item; English source documents do not force an English-only interface.

**Do not:** Add content worlds, obstacles, new currencies, or cosmetic storefronts to compensate for weak camera feel.

**Exit:** The one-world experience is visually coherent and understandable, with accepted art/presentation and documented limitations.

**Phase prompt:** `Execute P11 only. Finish the one-world art, UI, untimed tutorial, audio, accessibility settings, and guardian reveal around the existing rules. Stop for presentation review.`

## P12 — Harden real mobile play and online interruptions

**Outcome:** The full loop is stable on selected physical devices and under expected browser failures.

**Work:**

1. Implement the specification's online readiness endpoint client: fresh check before attempt start, bounded timeout, and clear retry. Treat navigator online/offline values as hints, not proof.
2. Handle detected connectivity loss with a real pause and recoverable resume. Do not discard a saved successful outcome. Do not send per-frame telemetry or add continuous multiplayer networking.
3. Test hidden tab, pointer cancellation, focus loss, screen rotation, audio interruption, WebGL context loss, failed asset loads, and storage exceptions.
4. Profile geometry, draw calls, textures, dynamic lights, shaders, render density, allocations, and resource disposal. Fix measured bottlenecks.
5. Test repeated mission/retry cycles for leaked listeners, duplicate loops, and increasing resource counts.
6. Measure the 30-FPS target on named physical phones. Record browser/OS, build hash, quality setting, scene, duration, and frame-time percentiles. Do not use desktop emulation as phone evidence.

**Provisional performance method:** Use a representative five-minute session, with at least ten tunnel transitions. Report median and tail frame times, long stalls, and resource trends. The game specification's target is 30 FPS; a provisional 95th-percentile frame-time target is 33.3 ms excluding loading and deliberately paused states. Treat this as a project test target, not a universal standard. Fix or openly revise unsupported claims before release.

**Tests:** An unavailable network cannot consume mission time. A false offline hint is checked against the endpoint. Resume has fresh input and no jump. WebGL failure is recoverable or clearly explained, not a silent lost mission. Lower visual quality does not alter rules.

**Do not:** Reduce collision accuracy, ignore elapsed time, shrink tests, or disable effects indiscriminately to fake a performance pass.

**Exit:** Device evidence and failure/recovery results are recorded. Missing physical-device access blocks the related acceptance gate.

**Phase prompt:** `Execute P12 only. Harden mobile performance and browser/network interruptions. Measure actual devices, preserve fair clock and recovery behavior, and report untested environments explicitly.`

## P13 — Build and verify the release candidate on Arvan staging

**Outcome:** The complete install-free game runs from the actual staging architecture.

**Prerequisites:** P12 complete; P02 live provider proof; explicit permission for the named staging target. Missing permission blocks deployment, not local artifact preparation.

**Work:**

1. Build the browser artifact and separate Edge artifact from an identified source revision and lockfile. Generate an asset manifest with hashes and release identity.
2. Review the Edge adapter, origin allowlist, methods, security headers, content types, cache behavior, and failure responses. Arrange an independent technical review for the live access/configuration effects.
3. Upload immutable release assets to the approved origin first. Verify files before changing the entry page.
4. Deploy the function and route only on the approved staging domain/path. Record provider deployment identity. Never place a storage secret or private environment value in client configuration.
5. Verify the HTTPS entry route actually uses Edge. Verify JS, CSS, model, texture, and sound requests. Check no mixed content and no unrelated third-party runtime dependency.
6. Test fresh-cache and warm-cache runs, missing files, HEAD, disallowed methods, upstream failure, CORS when relevant, and health no-store behavior.
7. Play the complete MVP over the staging URL on desktop and a physical phone. No installation instruction may appear.
8. Rehearse rollback to a previous staging artifact. Retain old assets and consider save-schema compatibility.

**Do not:** Use the Vite development/preview server as production, copy Cloudflare runtime assumptions, switch production traffic, or report event approval without evidence.

**Exit:** A source-bound release candidate has real staging evidence, route/header evidence, a complete browser playthrough, and an executable rollback procedure.

**Phase prompt:** `Execute P13 only for the explicitly authorized staging target. Build immutable browser and Edge artifacts, deploy in the correct order, verify real HTTPS play, and rehearse staging rollback. Do not publish production.`

## P14 — Conduct acceptance testing and tune only from evidence

**Outcome:** The release candidate is evaluated for playability, fairness, and complete product behavior.

**Work:**

1. Run the regression catalog on the exact candidate. Identify which checks are unit, browser, physical-device, provider, or human observations.
2. Observe a small initial player sample with the owner's permission. For children, use appropriate adult supervision and avoid collecting names, images, accounts, or unnecessary personal data.
3. Observe control learning, fresh-input handoff, cause-of-failure understanding, voluntary retry, camera comfort, upgrade understanding, and the restoration payoff.
4. Record observations without claiming a statistically representative retention result. Track nonidentifying counts and notes locally unless analytics are separately authorized.
5. Change only evidence-supported tuning parameters or defects. Change one main difficulty dimension at a time. Update the specification/configuration when a product value is approved to change.
6. Rerun affected checks. If source or content changes, build a new candidate and repeat affected staging evidence. Do not claim old evidence applies automatically.
7. Prepare the release readiness report: passes, remaining limits, exact candidate identity, operating needs, and owner product judgment.

**Do not:** Add new mechanics, silently lower targets to force completion metrics, change the story, or label a few positive reactions as scientific proof.

**Exit:** Critical defects are resolved; all required evidence exists; the owner accepts the experience; the candidate is ready for a specifically authorized production release.

**Phase prompt:** `Execute P14 only. Validate the exact staging candidate, observe authorized player tests, tune from recorded evidence, rerun affected checks, and prepare release readiness without publishing.`

## P15 — Release the approved build and verify production

**Outcome:** The approved game is genuinely playable online without installation.

**Authorization must name:** Repository/revision or release candidate; production account/project; domain/path; allowed resources; deployment/traffic actions; and any merge/tag/release actions. One authorization can cover the exact chain. Do not infer missing effects.

**Work:**

1. Recheck candidate identity, unresolved defects, required review, CI side effects, previous release, and save/rollback compatibility.
2. Complete only the authorized merge/release stages. Bind a formal release to the approved source or a documented equivalent build mapping. Do not rebuild different bytes silently.
3. Upload/verify immutable assets first. Switch the approved Edge entry/configuration to the exact release. Record Deployment ID and artifact hashes.
4. Run production smoke tests with a clean player profile and supported real browsers: entry, controls, one mission success, failure/retry, saved result recovery, shop, and no installer.
5. Confirm the public URL, cache/version identity, error behavior, and observed service status. Keep secrets and account identifiers out of public logs.
6. If a release defect requires rollback, follow the approved rollback scope. Rollback code and data are different actions. Do not delete a player's save to mask an incompatibility.
7. Deliver the actual public URL, release identity, operator instructions, backup/rollback notes, test limits, and current project status. Do not promise unconfigured background monitoring.

**Exit:** The exact approved build is deployed and verified on the named production target; the owner receives a playable URL. If deployment or external acceptance is missing, report a release candidate, not a delivered live product.

**Phase prompt:** `Execute P15 only for the approved production release and target. Verify identity and authority, publish the exact tested artifacts, run production smoke checks, and report the real URL and limits.`

---

# F. Acceptance Catalog and Requirement Traceability

These are planned checks. Their execution status is initially `NOT_RUN`. Implement them as maintainable tests or explicit manual procedures. Combine parameterized cases where useful; do not create one artificial test file per row.

## F1. Baseline and input

| Test | Required assertion | First phase |
|---|---|---|
| T01 | A clean checkout with the lockfile builds using the documented developer commands. | P01 |
| T02 | The player route needs no installer, PWA, extension, terminal, or local HTML download. | P01; final P13 |
| T03 | Missing WebGL 2 produces a readable compatibility state. | P01 |
| T04 | Only an intentional primary-pointer release inside the valid hole area drops the character. | P04 |
| T05 | Invalid release preserves profile and active time continues correctly. | P04 |
| T06 | Pointer cancellation, hidden page, and pause never become a valid release. | P04 |
| T07 | Secondary touches and UI clicks cannot move/release through overlays. | P04 |
| T08 | Resize and orientation changes preserve logical position and reset input baselines safely. | P04 |
| T09 | Keyboard alternatives reach equivalent gameplay commands. | P04/P06 |

## F2. Camera, steering, and collection

| Test | Required assertion | First phase |
|---|---|---|
| T10 | Camera pose is continuous at entry and exit; player returns to the correct anchor. | P05 |
| T11 | Camera remains within valid clearance through all approved template samples. | P05/P08 |
| T12 | Reduced motion changes presentation, not movement, collection, time, or outcome rules. | P05/P06 |
| T13 | Waiting at tunnel-ready produces neither movement, time use, nor light collection. | P06 |
| T14 | First tunnel input and touch re-entry never teleport the firefly. | P06 |
| T15 | Right/left steering remains correct through bends and does not flip axes. | P06 |
| T16 | Lifting a finger inside the tunnel holds lateral position; time and forward movement continue. | P06 |
| T17 | Swept collisions capture crossed lights at low FPS; near misses remain misses. | P06 |
| T18 | A light ID counts once; used tunnels cannot generate more light in the same attempt. | P03/P07 |

## F3. Mission time and outcomes

| Test | Required assertion | First phase |
|---|---|---|
| T19 | Time accumulates only in exploration and active steerable tunnel travel. | P03 |
| T20 | Valid final collection at deadline minus 1 ms and exactly deadline succeeds; plus 1 ms does not. | P03 |
| T21 | A frame that crosses the deadline resolves collisions by event time, independent of rendering order. | P03 |
| T22 | Success is immutable after latching; collection and timing stop during safe exit. | P03/P07 |
| T23 | Deadline failure occurs inside a tunnel without waiting for the exit. | P07 |
| T24 | The last exhausted tunnel below target ends the attempt immediately. | P07 |
| T25 | After exit, collected plus available remainder below target fails; equality still permits play. | P03/P07 |
| T26 | Retry resets only attempt state and reproduces seed, manifest, content version, and generator version. | P07/P08 |
| T27 | Paused, hidden, or disconnected waiting states freeze movement, collection, and time together. | P07/P12 |
| T28 | The example 8+9+8 collection reaches 25 at active second 73 and succeeds once. | P03/P07 |

## F4. Generation and persistence

| Test | Required assertion | First phase |
|---|---|---|
| T29 | All three missions have three valid opportunities and 36 identified lights; targets are 22/25/28. | P08 |
| T30 | A seeded manifest is reproducible and duplicate-free across repeat builds of the same content version. | P08 |
| T31 | Invalid geometry/light spacing fails; valid templates have a feasible baseline target witness. | P08 |
| T32 | Bounded generation terminates and uses a known-valid fallback on exhaustion. | P08 |
| T33 | The provisional 1,000-seed sweep records actual results and replayable failing seeds. | P08 |
| T34 | Reload after threshold success recovers a pending outcome without losing or duplicating it. | P09 |
| T35 | Elixir delivery and restoration are granted once per story mission. | P09 |
| T36 | Failing a later mission preserves previous restoration and inventory. | P09 |
| T37 | Guardian award is exactly 12 once after all three missions; repeated result reloads add nothing. | P09 |
| T38 | An unfinished attempt reloads from the same content identity, not from partial attempt light. | P09 |
| T39 | Storage denial, corrupt data, or unknown schema is handled visibly without silent progress deletion. | P09 |
| T40 | The supported single-active-tab policy prevents normal simultaneous gameplay writes. | P09 |

## F5. Economy and experience

| Test | Required assertion | First phase |
|---|---|---|
| T41 | Radius purchase costs 8; collection purchase costs 10; both first levels give their stated 10% effect. | P10 |
| T42 | Unaffordable/duplicate purchase is rejected; balance cannot become negative; double clicks are harmless. | P10 |
| T43 | Attempt loadout is a snapshot; purchase cannot modify an active tunnel. | P10 |
| T44 | Practice yields no story rewards and preserves the permanently restored world. | P10 |
| T45 | Practice can show a temporary training darkness view without changing saved restoration. | P10 |
| T46 | Tutorial is untimed, teaches both control modes, and grants no story resources. | P11 |
| T47 | HUD, focus, primary targets, mute, reduced motion, and supported RTL/LTR layout remain usable. | P11 |
| T48 | The one-world ending is truthful; no full-chapter claim, forced login, payment, or absence penalty appears. | P11 |

## F6. Online delivery and final assurance

| Test | Required assertion | First phase |
|---|---|---|
| T49 | A fresh mission waits for required assets and the real service readiness check; failure does not spend game time. | P02/P12 |
| T50 | Browser online hints do not alone declare internet availability or permanently block a reachable service. | P12 |
| T51 | Detected interruption pauses safely; resume has fresh input; a saved success survives later network failure. | P12 |
| T52 | The running game sends no frame-by-frame movement or collection requests. | P12 |
| T53 | Missing assets, upstream errors, and WebGL context loss never leave a silent blank or false skill failure. | P12 |
| T54 | A named physical-phone session measures the performance target; repeat travel has no growing loops/resources. | P12 |
| T55 | Edge routes correctly implement allowed methods, HEAD, MIME, no-store health, asset caching, and real 404. | P02/P13 |
| T56 | Proxy paths cannot choose arbitrary origins, expose secrets, or loop back into the Edge route. | P02/P13 |
| T57 | Staging uses the real Edge function and HTTPS Storage/CDN assets; no mixed release or mixed content. | P13 |
| T58 | Retained artifacts restore the previous staging release with its compatible save behavior. | P13 |
| T59 | Authorized player observations and the full regression catalog refer to the exact release candidate. | P14 |
| T60 | Production smoke passes on the approved artifact and URL with no player installation. | P15 |

## F7. Coverage map

| Requirement family | Phase owners | Evidence type |
|---|---|---|
| G01–G02: world and MVP | P00, P09, P11 | Scope inventory and complete-world demonstration |
| G03–G08: controls/camera/collection | P04–P06 | Browser sequences, geometry tests, actual visual review |
| G09–G12: time/outcome/retry | P03, P07 | Deterministic boundary and integration tests |
| G13–G16: progression/economy/practice | P09–P10 | Reload, idempotency, arithmetic, and profile tests |
| G17: content generation | P08 | Reproducibility, validation, and baseline witness |
| G18–G21: tutorial/comfort/experience | P04–P07, P11 | Functional accessibility and player observation |
| G22–G24: performance/architecture/save | P01, P03, P09, P12 | Module checks, device evidence, recovery tests |
| G25–G27: Edge and release | P02, P13, P15 | Actual hosted HTTP evidence and artifact identity |
| G28–G29: scope and ending | P00, P11, P14 | Product review and regression checklist |
| G30–G32: online/no-install/recovery | P01, P02, P12, P13 | Clean-browser, network, and delivery tests |
| G33: actual product acceptance | P13–P15 | Deployed candidate and production evidence |

---

# G. Detailed Engineering Guidance for Risky Boundaries

This section gives implementation guidance, not permission to expand a phase.

## G1. Active-time and terminal-event ordering

Maintain an active simulation time in milliseconds. Pauses stop both simulation and active-time accumulation. Forced camera transitions are presentation-only. Use a monotonic browser time source; changing the operating-system clock must not alter the mission.

For each simulation update:

1. Determine the active interval and whether it crosses the deadline.
2. Find swept collection events in chronological order within the permitted interval.
3. Ignore already collected IDs and invalid attempt/tunnel IDs.
4. Apply events up to and including the deadline.
5. If the target is reached, latch success and stop scoring immediately.
6. Otherwise, if the deadline has expired, latch failure.
7. Otherwise, process ordinary tunnel exit and remaining-opportunity logic.

Use an explicit numerical tolerance policy for geometry. Do not extend the deadline with a broad hidden grace period. Test different frame schedules, including stalls. If the application must pause on an extreme unsupported stall, report it as a technical pause rather than silently slowing the mission clock.

## G2. Tunnel coordinates and reachable light

Represent forward location as distance along a center curve. Define a continuous tangent/right/up frame. The firefly's lateral offset is measured along that local right vector. Clamp it within the playable cross-section, leaving room for character radius and wall clearance.

The camera follows the centerline with a controlled look-ahead. It does not chase each lateral input. Inspect near-vertical or inflection segments that could destabilize the frame. Restrict templates rather than forcing the camera through invalid geometry.

Place lights where a player with the configured lateral speed can reach the required subset. Test full sequence feasibility, not only that each light is reachable in isolation. Record a steering witness for validator confidence and human-test the intended error margin.

## G3. Success save and reward ordering

Use two separate ideas: **logical completion** and **presentation still to show**. Logical completion must not wait for a cutscene.

A successful attempt transaction should include mission identity, completion/restoration state, and pending presentation. On the final mission, grant or safely schedule the one-time guardian award with its claim flag in the same validated save boundary. Use sets or keyed records rather than incrementing an elixir count every time a screen opens.

A reload resumes the presentation from an already committed outcome. It does not replay the grant operation. A storage write failure must not falsely announce durable saving. Keep a bounded in-memory result and offer an honest recovery state.

Do not claim robust cross-device or hostile-client security. Those require a separately authorized backend design.

## G4. Practice after the world is fully bright

The exploration-radius upgrade would have little visible value if practice always used the fully restored world. Therefore the specification explicitly allows a **temporary training view** of the selected mission's darkness.

This view is presentation-only. The saved guardian, torch, completed missions, crystals, and restoration remain unchanged. On returning to the world/menu, show the truly restored world. Label practice clearly and never imply that the wizard erased progress.

Keep practice thresholds and time rules identical by default. Records should include mission/rules/loadout identity. No practice currency farming.

## G5. Hosted architecture and allowed routes

Recommended request shape, to be verified on the actual provider:

```text
Player browser
  |-- HTTPS /                   -> small Arvan Edge entry response
  |-- HTTPS /health             -> small no-store availability response
  |-- HTTPS /assets/<hash>.*    -> approved asset origin via CDN/routing
  |-- HTTPS /content/<version> -> versioned public mission data
  |
  +-- local render, input, clock, collision, and small local save
```

Do not call the Edge route for every movement. Do not use temporary Edge memory as a profile database. Public configuration must contain no private keys.

| Route class | Required policy |
|---|---|
| Root HTML | Revalidate; reference one complete release |
| Health | No-store; small response; no personal data |
| Content-hashed assets | Long-lived immutable cache; correct MIME |
| Versioned mission data | Pinned to the active release/content version |
| Unknown path | True 404; never substitute HTML for a missing JS/model file |
| Unsupported method | Clear rejection; no unexpected writes |

Validate/normalize asset paths against a release manifest or an equally strict allowlist. Prevent traversal, scheme/host injection, redirect-to-untrusted-origin, and self-proxy loops. Use HTTPS for player-visible and supported origin paths. Do not downgrade silently because a Storage website endpoint differs from its API endpoint.

If the CDN serves large assets directly, retain actual Edge entry execution. Use the account's observed route/header/log evidence, not a generic “hosted on CDN” claim.

## G6. Release identity and rollback

A release record must connect:

- Source revision and lockfile.
- Browser build hash and Edge bundle hash.
- Content/generator versions and asset manifest.
- Authorized target and deployment ID.
- Staging checks, physical-device evidence, and production smoke result.
- Previous release assets and save-schema compatibility.

Upload immutable files first. Verify availability. Then switch the entry point. Do not remove old assets while old open tabs may still refer to them. Do not update a player's active mission to new rules mid-attempt.

If rollback would expose a newer save schema to older code, use a verified compatibility path or stop the affected rollback. Code rollback is not permission to erase player data.

---

# H. Copy-Ready Codex Prompts

The prompts below intentionally do not authorize every phase or deployment. Keep the two documents in the repository first.

## H1. Initial request

```text
Read these two project documents completely:
- docs/Light_Hunt_Complete_Game_Scenario_EN.md
- docs/Light_Hunt_Codex_Phased_Implementation_Plan_EN.md

Follow applicable repository instructions. Execute P00 only.
Inspect the actual repository and existing prototype before selecting a reuse path.
Preserve all concurrent work. Establish concise durable instructions and current status.
The player must use an HTTPS browser URL with no application installation.
Do not add a PWA, offline mode, multiplayer, accounts, payments, or new game mechanics.
Do not deploy, publish, merge, spend, or change cloud resources.
Report what you verified, what remains unknown, and the exact next phase. Then stop.
```

## H2. Start a named phase

```text
Execute phase PXX only under the operational plan.
Read the current status, applicable instructions, prerequisite evidence, and the relevant
sections of both product documents. Verify the Git state before edits.

Implement the phase's complete bounded capability. Add/run the required tests and inspect
its observable behavior. Fix relevant regressions without weakening requirements.
Update current status with actual commands, evidence, blockers, and demonstration steps.
Do not add later-phase features or deploy without explicit target authority.
Stop at the phase boundary. Do not start the next phase automatically.
```

Replace `PXX` with one real phase ID, such as `P06`.

## H3. Resume an interrupted phase

```text
Resume the active phase recorded in docs/STATUS.md. Do not restart the project.
Inspect current files and Git changes. Compare completed checks with the current revision.
Reuse valid unchanged evidence. Continue from the recorded smallest unfinished task.
Do not repeat completed setup or overwrite work by another actor.
Finish the selected phase's verification and handoff, or report the precise blocker. Stop.
```

## H4. Review a phase without editing

```text
Review phase PXX only. Do not edit files or run mutating/deploying commands.
Compare the actual implementation and recorded evidence with the product requirements,
phase exit criteria, and relevant acceptance tests.
Report concrete defects, missing tests, unsupported claims, and regression risks.
Separate observed problems from untested suspicions. Do not label self-review independent.
```

## H5. Ask for a prepared staging release, not live deployment

```text
Prepare the P13 release candidate locally only.
Identify the exact browser and Edge artifacts, source revision, asset manifest, required
ArvanCloud permissions, deployment order, cost-relevant limits, and rollback plan.
Run available local checks. Do not create resources or upload/deploy anything yet.
List only the missing authorization or access needed for the named staging target.
```

## H6. Authorized deployment template

Use this only after the owner has supplied the actual values and approved the effects:

```text
Execute the deployment portion of phase [P02 / P13 / P15] for this target only:
Account/project: [approved target identifier]
Domain/path: [approved HTTPS target]
Candidate/source identity: [approved immutable identity]
Allowed actions: [specific upload, function deployment, route switch, release actions]
Spending/resource boundary: [approved limit or no new paid resources]
Rollback authority: [approved previous artifact and allowed rollback actions]

Do not alter any other environment. Use existing secure credentials; do not expose them.
Verify deployed artifact identity and the required live acceptance checks.
Report the real outcome, URL, evidence, and any unmet gate. Do not claim full completion
if only local preparation or staging passed.
```

## H7. Required end-of-phase report

```text
Phase and status:
Capability delivered:
Requirement IDs covered:
Files changed:
Checks actually run, with results:
Running demonstration or evidence:
Unperformed checks and why:
Known defects or tradeoffs:
Cloud/release effects performed, if authorized:
Owner judgment needed, if any:
Next permitted phase or exact blocker:
```

Do not flood the owner with raw logs. Keep the report clear and link the detailed evidence in the repository.

---

# I. Final Acceptance and Non-Goals

## I1. Definition of done for the first release

A new player opens the approved HTTPS URL, without installation. They complete the untimed tutorial, guide the firefly through dark exploration and steerable tunnels, succeed and fail fairly, restore one world through three missions, receive 12 crystals once, buy one upgrade, and use it in reward-free practice. Normal reload preserves completed progress on the same browser/origin.

The actual release has passed input, clock, collision, save, economy, generation, mobile, network, and Edge checks. Reduced motion is available. The one-world ending is truthful. Production identity and rollback are recorded. The owner has accepted the experience.

## I2. What must not appear as a surprise addition

No independent zones, image guessing, full auto-collection, no-failure timer, repeated reward farming, purchase of time, energy countdown while absent, daily pressure, online player chat, matchmaking, payment, native installer, PWA, offline mode, server-rendered video stream, or runtime AI generation.

A later request can add features through a new bounded specification. It does not retroactively change a completed phase or authorize a deployment.

## I3. Remaining external facts to verify during implementation

The actual repository and its prior state; selected stable package versions; physical target phones; ArvanCloud runtime/account limits and costs; domain/bucket permissions; exact deployment commands; event eligibility if still relevant; final visible UI language; approved assets and their rights; and real player balance.

None is fabricated by this plan. Technical choices are made by Codex where appropriate. Material product, cost, authority, and subjective quality decisions remain with the owner.

---

# J. Source Notes and Research Boundaries

The game specification is a complete English rendering of the owner's uploaded version 4.1, with an explicit online/no-install addendum. The operational procedures, phase grouping, test catalog, proposed scripts, and repository templates in this plan are new engineering work. They are not a quotation from a global game-development standard.

The plan applies the relevant principles of the installed AI Development Governance skill: scoped work, preserved repository context, proportionate tests, observed evidence, and explicit authority for live effects. It does not require that plugin to be installed in Codex. No plugin, host permission, automated review, or production access is assumed.

Official sources consulted on 21 November 2026:

| ID | Source | Narrow use in this plan |
|---|---|---|
| R1 | [OpenAI — AGENTS.md instructions](https://developers.openai.com/codex/guides/agents-md) | Short repository entry point and explicit reading of larger documents |
| R2 | [OpenAI — Iterating development workflows](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex) | Durable context and observed verification |
| R3 | [OpenAI — Long-horizon tasks](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex) | Milestone-based execution rather than a single uncontrolled build request |
| R4 | [Three.js — WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html) | WebGL 2 capability requirement |
| R5 | [Vite — Static deployment](https://vite.dev/guide/static-deploy) | Browser build output and preview/production distinction |
| R6 | [Vitest — Getting started](https://vitest.dev/guide/) | Unit-test tool selection |
| R7 | [Playwright — Getting started](https://playwright.dev/docs/intro) | Browser-test tool selection |
| R8 | [MDN — Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) | Unified pointer event model |
| R9 | [MDN — Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) | Hidden-page interruption signal |
| R10 | [MDN — Navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine) | Online state is a heuristic, not service proof |
| R11 | [MDN — localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) | Origin-local persistence and limits |
| R12 | [Three.js — Curve](https://threejs.org/docs/pages/Curve.html) | Distance-based curve sampling |
| R13 | [Microsoft — XAG 117](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) | Camera and motion settings |
| R14 | [ArvanCloud — Edge dashboard](https://docs.arvancloud.ir/fa/edge-computing/dashboard/) | Function creation, deployment identity, and domain routing |
| R15 | [ArvanCloud — HTML response](https://docs.arvancloud.ir/fa/edge-computing/examples/return-html/) | Entry page through an Edge function |
| R16 | [ArvanCloud — Origin proxy](https://docs.arvancloud.ir/fa/edge-computing/examples/origin-proxy/) | Fixed-origin routing capability |
| R17 | [ArvanCloud — Edge routes](https://docs.arvancloud.ir/fa/edge-computing/trigger/path/) | Actual CDN-domain path binding |
| R18 | [ArvanCloud — Storage website](https://docs.arvancloud.ir/fa/object-storage/buckets/static-website/) | Static asset hosting and endpoint distinction |
| R19 | [ArvanCloud — Environment values](https://docs.arvancloud.ir/fa/edge-computing/env-variables/) | Provider-side configuration and secret boundary |

Provider documentation establishes available mechanisms, not this account's quotas, a successful deployment, or competition acceptance. Recheck relevant facts at the implementation phase. Keep all phase and test states unexecuted until real evidence exists.
