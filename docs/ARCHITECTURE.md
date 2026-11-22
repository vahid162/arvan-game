# Light Hunt architecture

## Starting point

The [P00 inventory](STATUS.md#p00-evidence) found no prototype to migrate. Use the existing [game specification](Light_Hunt_Complete_Game_Scenario_EN.md) as the behavior contract. Start P01 with a small browser shell and a rendered placeholder.

## P01 toolchain

P00 checked these versions against the Node release index and npm package manifests. P01 installed them. Exact dependencies and integrity hashes are in the [npm lockfile](../package-lock.json).

| Component | Selected version | Reason and compatibility evidence |
| --- | --- | --- |
| Node.js and npm | Node `26.13.1`, bundled npm `11.20.0` | The Node 26 Lithium LTS release includes this npm version and satisfies the tools' engine ranges. [Release index](https://nodejs.org/dist/index.json) · [LTS status](https://nodejs.org/en/about/previous-releases) |
| TypeScript | `7.0.2` | Run the compiler separately for strict type checking. Its declared Node minimum is 16.20.0. [Manifest](https://registry.npmjs.org/typescript/7.0.2) |
| Three.js and declarations | `three@0.187.0`, `@types/three@0.187.0` | Use the browser renderer with its matching release of TypeScript declarations. Keep the declarations in development dependencies. [Renderer manifest](https://registry.npmjs.org/three/0.187.0) · [Declaration manifest](https://registry.npmjs.org/@types/three/0.187.0) |
| Vite | `8.3.8` | Builds the browser bundle. Its Node range includes 22.12.0 and later. [Manifest](https://registry.npmjs.org/vite/8.3.8) |
| Vitest | `5.1.1` | Its Node range includes 26.x and its Vite peer range includes 8.x. Use it for deterministic unit checks. [Manifest](https://registry.npmjs.org/vitest/5.1.1) |
| Playwright Test | `1.65.1` | Declares Node 20 or later and depends on the same Playwright version. Its supported test-host matrix includes Node 26. Use its matching browser build for the smoke test. [Manifest](https://registry.npmjs.org/@playwright/test/1.65.1) · [System requirements](https://playwright.dev/docs/intro#system-requirements) |

Oxlint 1.94.0 checks source and test code. The test configuration uses Node type declarations 26.6.6. Three.js is the only direct runtime dependency. The player loads its renderer on demand after the browser confirms WebGL 2 support. [Three.js WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html)

The HTML shell presents loading and recovery text before the renderer loads. One canvas holds the orthographic scene. Resizing updates its camera and drawing buffer in place, with a maximum of two device pixels per CSS pixel on each axis. Rendering pauses when the tab is hidden. Reduced motion keeps a static first frame until the viewer resumes motion. The preview uses local geometry and makes no frame-by-frame network requests.

## Runtime boundaries

- **Browser.** An HTTPS page runs the game on the player's device. Keep deterministic rules and the active clock independent of rendering. Input sends domain commands, Three.js draws snapshots, DOM controls display state, and the save module persists validated progress locally. Introduce these modules as their phases need them. The developer toolchain runs outside the player path.
- **Delivery.** The P02 adapter serves entry HTML and readiness at the Edge. It forwards only exact build-manifest asset paths to a fixed HTTPS origin configured at build time. It strips visitor headers, checks upstream status and media type, and rejects redirects and proxy loops. The browser artifact includes a generated notice containing the Three.js MIT license. [Edge runbook](../edge/README.md)
- **Evidence.** The status record identifies the browser build exercised in automation. Physical Android Chrome and iPhone Safari sessions will establish touch and performance on named devices. A hosted probe will establish Edge execution on an authorized target. [Current evidence and next phase](STATUS.md)

### ArvanCloud runtime

The adapter is a self-contained classic JavaScript bundle. It uses the global fetch listener, `event.respondWith()`, `Request`, `Response`, `URL` and upstream `fetch`. ArvanCloud demonstrates the listener and proxy shape and documents uploading prebuilt scripts. The build and loopback harness use Node.js. The uploaded worker consists of web APIs and its embedded HTML and asset routes. [HTML example](https://docs.arvancloud.ir/fa/edge-computing/examples/return-html/) · [Origin proxy example](https://docs.arvancloud.ir/fa/edge-computing/examples/origin-proxy/) · [Dashboard upload](https://docs.arvancloud.ir/fa/edge-computing/dashboard/)

The actual account, runtime limits, upstream HEAD and manual redirect behavior, and CDN cache behavior await staging observations. The project chooses a distinct HTTPS Storage/CDN hostname so the asset origin and Edge entry can be tested independently. [HTTP methods example](https://docs.arvancloud.ir/fa/edge-computing/examples/cors-header-proxy/) · [Staging routes](https://docs.arvancloud.ir/fa/edge-computing/trigger/path/)
