# Light Hunt architecture

## Starting point

The [P00 inventory](STATUS.md#p00-evidence) found no prototype to migrate. Use the existing [game specification](Light_Hunt_Complete_Game_Scenario_EN.md) as the behavior contract. Start P01 with a small browser shell and a rendered placeholder.

## Toolchain selected for P01

On 22 November 2026 we checked the Node release index and the npm registry's stable `latest` manifests against the version-specific records below. These are the exact versions to pin at initial setup. Actual installation, transitive resolution and integration testing belong to P01.

| Component | Selected version | Reason and compatibility evidence |
| --- | --- | --- |
| Node.js and npm | Node `26.13.1`, bundled npm `11.20.0` | The Node 26 Lithium LTS release includes this npm version and satisfies the tools' engine ranges. [Release index](https://nodejs.org/dist/index.json) · [LTS status](https://nodejs.org/en/about/previous-releases) |
| TypeScript | `7.0.2` | Run the compiler separately for strict type checking. Its declared Node minimum is 16.20.0. [Manifest](https://registry.npmjs.org/typescript/7.0.2) |
| Three.js and declarations | `three@0.187.0`, `@types/three@0.187.0` | Use the browser renderer with its matching release of TypeScript declarations. Keep the declarations in development dependencies. [Renderer manifest](https://registry.npmjs.org/three/0.187.0) · [Declaration manifest](https://registry.npmjs.org/@types/three/0.187.0) |
| Vite | `8.3.8` | Builds the browser bundle. Its Node range includes 22.12.0 and later. [Manifest](https://registry.npmjs.org/vite/8.3.8) |
| Vitest | `5.1.1` | Its Node range includes 26.x and its Vite peer range includes 8.x. Use it for deterministic unit checks. [Manifest](https://registry.npmjs.org/vitest/5.1.1) |
| Playwright Test | `1.65.1` | Declares Node 20 or later and depends on the same Playwright version. Its supported test-host matrix includes Node 26. Use its matching browser build for the smoke test. [Manifest](https://registry.npmjs.org/@playwright/test/1.65.1) · [System requirements](https://playwright.dev/docs/intro#system-requirements) |

P01 will generate the npm lockfile, repeat the install from a clean checkout, and verify strict types, lint, the production build, a unit invariant and an actual rendered browser scene. Test the unsupported-WebGL 2 state and resize behavior as part of the shell. Three.js uses WebGL 2 for this renderer. [P01 acceptance](Light_Hunt_Codex_Phased_Implementation_Plan_EN.md#p01--create-the-install-free-browser-shell-and-test-foundation) · [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

## Runtime boundaries

- **Browser.** An HTTPS page runs the game on the player's device. Keep deterministic rules and the active clock independent of rendering. Input sends domain commands, Three.js draws snapshots, DOM controls display state, and the save module persists validated progress locally. Introduce these modules as their phases need them. The developer toolchain runs outside the player path.
- **Delivery.** The design calls for a separately built ArvanCloud Edge handler for HTTP entry and readiness, with versioned assets served through Object Storage and CDN. Movement and collision run in the browser. P02 must verify runtime and bundling requirements, the actual account and allowed origin before recording a provider adapter or deployment procedure.
- **Evidence.** The lockfile and successful P01 checks will establish what runs together. Physical Android Chrome and iPhone Safari sessions will establish touch and performance on named devices. A hosted probe will establish Edge execution on the authorized target. [Current evidence and next phase](STATUS.md)
