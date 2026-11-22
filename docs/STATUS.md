# Light Hunt development status

**P01 · IN_PROGRESS** — the browser shell and test foundation are implemented. Clean-checkout verification and the mobile capture are in progress. [P01 work package](Light_Hunt_Codex_Phased_Implementation_Plan_EN.md#p01--create-the-install-free-browser-shell-and-test-foundation)

| Phase | State |
| --- | --- |
| P00 | `COMPLETE` |
| P01 | `IN_PROGRESS` |
| P02–P15 | `NOT_STARTED` |

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
