# Light Hunt development status

**P01 · COMPLETE** — the browser shell renders a firefly in a responsive WebGL 2 scene. The clean build, static checks, three unit tests and seven browser tests passed on 22 November 2026. [Mobile viewport capture](evidence/p01-mobile.png)

**Next phase** — P02, the minimal ArvanCloud delivery proof, awaits a separate phase request. Its live probe also needs an authorized target. [P02 work package](Light_Hunt_Codex_Phased_Implementation_Plan_EN.md#p02--prove-the-smallest-arvancloud-delivery-path)

| Phase | State |
| --- | --- |
| P00 | `COMPLETE` |
| P01 | `COMPLETE` |
| P02–P15 | `NOT_STARTED` |

## P01 evidence

P01 starts at the [merged P00 baseline](https://github.com/vahid162/arvan-game/pull/1). Source and test revision `56dfd0f` contains the browser shell, the Three.js firefly and the tests. The [developer instructions](../README.md#developer-setup) reproduce the preview.

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
