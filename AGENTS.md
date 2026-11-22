# Working on Light Hunt

This repository uses AI Development Governance 1.4.0.

1. On first entry, inspect the branch, index and working tree. Read the [README](README.md), all current project documentation under `docs/` and any instructions closer to the files you will edit. On return, check what changed since the recorded evidence and preserve concurrent work.
2. Start at [current status](docs/STATUS.md). Work only on the phase the owner requested, or resume an unfinished authorized phase. P00 is the initial setup. A completed phase is a stopping point until the owner selects the next phase or explicitly authorizes a range.
3. Use the [game specification](docs/Light_Hunt_Complete_Game_Scenario_EN.md) for product rules and the [phase plan](docs/Light_Hunt_Codex_Phased_Implementation_Plan_EN.md) for dependencies and acceptance checks. The target is install-free HTTPS play in one continuous world. Changes to scope or game rules belong to the owner.
4. Follow the [architecture decisions](docs/ARCHITECTURE.md). Keep deterministic rules independent of Three.js, DOM input and storage. The browser handles play and local progress. Edge handles HTTP delivery. Keep credentials out of browser assets and Git.
5. Use the [developer commands](README.md#developer-setup) available for the current phase. For each new behavior, add a test or reproducible case, run the affected checks and inspect the result. Record the revision, commands, results and outstanding gates in the status file when handing off a phase. Physical-phone and live-Edge checks need evidence from those targets.
6. Inspect hooks and CI before actions with remote effects. A phase request covers its local development and checks. Merges, releases, deployments (including staging), spending, and changes to domains, access or live data require authority for the specific target and effect.
