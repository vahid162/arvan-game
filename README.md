# Light Hunt

Light Hunt is a single-player browser game in development. The player guides a firefly through dark tunnels, steers toward lights and brings them back to a guardian. Each of the three missions restores more of the same forest. Players will open an HTTPS link on a phone or desktop.

## Developer setup

The playable demo covers one clearing and one tunnel with twelve lights. To run it locally, use the Node.js version in `.nvmrc` (26.13.1, with npm 11.20.0). From the repository root, run

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite and select **Start exploring**.

1. Hold and drag to guide the firefly, or move with the arrow keys. Look for an opening near the upper right of the clearing.
2. Release when the amber ring and inward arrows appear. With a keyboard, press Space.
3. At the tunnel entrance, move the mouse, touch the playfield again, or press Left or Right. Steer horizontally to collect lights as the firefly moves forward.
4. Select **Try again** after returning to the clearing. **Pause** or Escape pauses the demo.

The demo honors the browser’s reduced-motion preference and needs WebGL 2. Your score is for this run.

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
