# Dynaxis Workspace Intelligence Scaffold (Phase 7H)

This directory is a scaffold-only contract surface for workspace intelligence.

Includes only:

- activity event contracts for workspace/project activity
- signal classification and insight candidate contracts
- workspace summary and recommendation placeholders
- privacy boundary and redaction contract helpers
- validation result contract helpers

Out of scope in this scaffold:

- no event ingestion pipeline
- no persistence layer and no migrations
- no workers or notifications
- no AI summarisation or model routing

Future phases may connect this contract surface to Project Graph, Jobs, Agents,
and Build Runtime once those implementations are in scope.
