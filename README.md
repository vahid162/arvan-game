# Light Hunt

Light Hunt is a single-player browser game in development. The player guides a firefly through dark tunnels, steers toward lights and brings them back to a guardian. Each of the three missions restores more of the same forest. Players will open an HTTPS link on a phone or desktop.

## Developer setup

Git is sufficient to inspect the P00 baseline. From a fresh working directory, run

```sh
git clone https://github.com/vahid162/arvan-game.git
cd arvan-game
git status --short --branch
git log -1 --oneline
git ls-files
```

Start with the [current phase and verification record](docs/STATUS.md). The baseline contains the design and development handoff. P01 introduces the first runnable browser shell, dependency lockfile, and build and test commands.

| To find | Read |
| --- | --- |
| Game rules, first-release scope and requirement IDs G01–G33 | [Game specification](docs/Light_Hunt_Complete_Game_Scenario_EN.md) |
| Phase deliverables, prerequisites and acceptance checks T01–T60 | [Phased implementation plan](docs/Light_Hunt_Codex_Phased_Implementation_Plan_EN.md) |
| Browser and Edge responsibilities and tool versions chosen for P01 | [Architecture](docs/ARCHITECTURE.md) |
| Instructions for development agents | [Repository instructions](AGENTS.md) |
