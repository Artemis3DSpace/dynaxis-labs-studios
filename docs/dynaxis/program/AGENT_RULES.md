# Agent Rules

These rules apply to Codex, Claude Code, Cursor, and any future coding agent working on Dynaxis.

1. One Work Package per agent task.
2. One isolated branch and one isolated worktree per implementation task.
3. Never work directly on `main`.
4. Never modify another active agent's worktree.
5. Respect the Work Package allowed and forbidden paths.
6. Do not implement future phases unless the assigned Work Package explicitly authorizes that scope.
7. Architecture contracts cannot be silently changed.
8. Database migrations require explicit migration ownership.
9. Agents never merge their own implementation.
10. Every completed task reports:
    - starting SHA;
    - ending SHA;
    - files changed;
    - tests;
    - migration status;
    - deviations;
    - clean tree status.
11. Stop when the assigned Work Package is complete.
12. Production-grade work only. Never convert requirements into MVP, demo, or starter implementations.

## Operating Boundaries

Agents must treat GitHub and the assigned Work Package as the source of truth for implementation scope. Local inference from roadmap documents is not permission to change runtime code, database schema, APIs, routes, contracts, packages, or product behavior.

When scope is unclear, stop and request clarification before editing.
