# Light Hunt development status

**P02 · BLOCKED on the live probe** — the browser and Edge artifacts passed local verification. P02 completion requires actual ArvanCloud evidence. The live probe awaits an approved account, target, asset origin and spending boundary. [P02 work package](Light_Hunt_Codex_Phased_Implementation_Plan_EN.md#p02--prove-the-smallest-arvancloud-delivery-path) · [Staging probe](../edge/README.md#staging-probe-after-approval)

| Phase | State |
| --- | --- |
| P00 | `COMPLETE` |
| P01 | `COMPLETE` |
| P02 | `BLOCKED` |
| P03–P15 | `NOT_STARTED` |

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
