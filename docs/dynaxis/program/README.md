# Dynaxis Engineering Program Control

This directory is the repository-native control surface for Dynaxis engineering work across Codex, Claude Code, and Cursor.

GitHub remains the source of truth. This programme layer exists to keep implementation work small, isolated, dependency-aware, and reviewable. It does not replace the architectural roadmap, and it does not authorize any agent to begin future roadmap implementation autonomously.

Core documents:

- `MASTER_PLAN.md` defines the engineering execution programme and references the canonical roadmap.
- `CURRENT_WORK.md` records the current active programme state.
- `CURRENT_ROADMAP_PIXOVID_MUAPI.md` records the current product-direction checkpoint for Pixovid/MuAPI creative-provider alignment.
- `DEPENDENCY_GRAPH.md` records execution dependencies and parallelization boundaries.
- `WORK_PACKAGE_SCHEMA.md` defines the required Work Package format.
- `AGENT_RULES.md` defines agent operating rules.
- `INTEGRATION_RULES.md` defines review and integration rules.
- `work-packages/` holds phase-scoped Work Package files.

Every implementation task must be assigned through exactly one Work Package before work begins.
