# Light Hunt

Light Hunt is a single-player browser game in development. The player guides a firefly through dark tunnels, steers toward lights and brings them back to a guardian. Each of the three missions restores more of the same forest. Players will open an HTTPS link on a phone or desktop.

## Developer setup

The local demo includes all three forest missions, the guardian’s reward, the upgrade shop, and practice. Use the Node.js version in `.nvmrc` (26.13.1, with npm 11.20.0). From the repository root, run

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Select **Play story** and **Start mission**. Each mission gives you 90 seconds of active time to collect 22, 25, or 28 lights from three tunnels.

1. Hold and drag to guide the firefly, or move with the arrow keys. Sweep the far side of the clearing to reveal the three openings.
2. Release when the amber ring and inward arrows appear. With a keyboard, press Space.
3. At the tunnel entrance, move the mouse, touch the playfield again, or press Left or Right. Steer horizontally to collect lights as the firefly moves forward.
4. Use **Pause**, Escape, or **Try again** as needed. A retry keeps the same layout. After each win, continue to the next mission to restore more of the forest.
5. After the third win, return to the clearing. Spend your 12 crystals on a wider exploration light (8) or a wider collection radius (10). **Practice** replays any completed mission with your equipment and saves a separate best score.

**Start exploring · Tutorial** teaches the controls in an untimed tunnel. Open **Settings** to change sound, reduced motion, or mouse and touch steering sensitivity. English is the default, and the **فارسی** link opens the Persian right-to-left interface. The game needs WebGL 2. Reopen the same address in the same browser profile to continue your saved forest.

## Build and verify

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Checks the browser source and tests in strict TypeScript mode |
| `npm run lint` | Checks the code with Oxlint |
| `npm run test:unit` | Tests mission rules, continuous collection, camera geometry and viewport sizing |
| `npm run build` | Type-checks and produces the static browser files in `dist/` |
| `npm run preview` | Serves that build locally |
| `npm run test:browser` | Builds, starts an isolated local preview on port 4173 and runs the Chromium tests |
| `npm run build:edge` | Builds the browser files and writes the separate Edge script and artifact manifest to `dist-edge/` |
| `npm run preview:edge` | Runs the generated Edge script with a local asset origin on port 4174 after a build |
| `npm run test:edge` | Checks the Edge route contract with controlled origin responses |
| `npm run test:browser:edge` | Builds and runs the Chromium suite against the local Edge preview |

For the browser tests, install the Chromium headless shell once with `npm exec -- playwright install --only-shell chromium`. On Linux, Playwright may also require system libraries. Its `install-deps chromium` command installs those on a developer machine with package-management permission. Port 4173 must be free for the tests. Set `P01_CAPTURE=1` when running them to refresh the [mobile viewport capture](docs/evidence/p01-mobile.png).

See the [phase status](docs/STATUS.md) for results and the next development milestone.
See the [Edge runbook](edge/README.md) for local HTTP checks and the staging probe.

| To find | Read |
| --- | --- |
| Game rules, first-release scope and requirement IDs G01–G33 | [Game specification](docs/Light_Hunt_Complete_Game_Scenario_EN.md) |
| Phase deliverables, prerequisites and acceptance checks T01–T60 | [Phased implementation plan](docs/Light_Hunt_Codex_Phased_Implementation_Plan_EN.md) |
| Browser and Edge responsibilities and verified tool versions | [Architecture](docs/ARCHITECTURE.md) |
| Instructions for development agents | [Repository instructions](AGENTS.md) |
