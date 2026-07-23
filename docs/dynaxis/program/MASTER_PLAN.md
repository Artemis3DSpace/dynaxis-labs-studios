# Dynaxis Master Engineering Programme

`docs/dynaxis/ROADMAP_V2.md` is the canonical architectural roadmap.

This document does not replace `ROADMAP_V2.md`.

- `ROADMAP_V2.md` = architectural roadmap.
- `MASTER_PLAN.md` = engineering execution programme.

The programme translates the roadmap into isolated, dependency-aware Work Packages for Codex, Claude Code, and Cursor. No agent may use this plan as permission to implement unassigned future roadmap work.

## Execution Order

1. 7C Identity / Organizations / Permissions
2. 7D Provider Connections / Secrets
3. 7E Job / Event Engine
4. 7F Project Graph + Memory
5. 7G Capability / Model Registry
6. 7H Character Identity
7. 7I Agent / Engineering Contracts
8. 8A App Factory Core
9. 8B Build Runtime
10. 8C Composer
11. 8D Responsive Design / Auto Layout
12. 8E Skills
13. 8F Developer Platform
14. 8G Extension / Plugin Platform
15. 8H Marketplace
16. 9 Supercomputer
17. 10 Production Platform / Commercial Hardening

## Programme Control

Each phase is decomposed into Work Packages under `docs/dynaxis/program/work-packages/`.

Work Packages must define:

- explicit dependencies;
- allowed and forbidden paths;
- required deliverables;
- contracts that must not change;
- validation requirements;
- migration ownership status;
- stop conditions.

Implementation branches and worktrees are created per Work Package. Integration happens through reviewed GitHub branches and pull requests, with the user as final merge authority.
