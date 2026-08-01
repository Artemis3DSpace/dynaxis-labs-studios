# Phase 18 - Collaboration and Workspace Workflows (Roadmap Scaffold)

> Scaffold only. This phase file defines planning structure and does not implement collaboration runtime features.

## 1. Purpose

Design collaborative workflows for teams working within shared Dynaxis projects, with clear ownership, permission, review, and handoff behavior across design/build/engineer activities.

## 2. What It Builds

- Workspace collaboration models for roles, assignments, and approvals.
- Multi-user workflow primitives for review, handoff, and status transitions.
- Shared activity and coordination patterns tied to project graph context.

## 3. Dependencies

- Phase 7C membership and authorization boundaries.
- Agent/work-package contracts from Phase 7I and orchestration foundations.
- Enterprise governance controls for policy and admin oversight.
- Audit/observability systems for collaboration traceability.

## 4. Forbidden Shortcuts

- No collaboration state changes without permission checks.
- No hidden side-channel workflows outside project/audit systems.
- No cross-workspace collaboration links without explicit sharing policy.

## 5. Likely Packages

- Collaboration workflow and state model package.
- Assignment/approval/handoff package.
- Shared activity feed and notification package.
- Conflict resolution and merge policy package.

## 6. Likely Migration Owners

- Owner for collaboration workflow persistence.
- Owner for assignment/review event data if split for scale.
- Migration serialization must avoid overlap with active enterprise/commercial owners.

## 7. Likely UI Areas

- Workspace activity timelines and assignment views.
- Review and approval inboxes.
- Project-level collaboration boards and status surfaces.

## 8. Likely API/Runtime Areas

- `app/api/dynaxis/collaboration/**`, `workspaces/**`.
- `lib/dynaxis/collaboration/**` workflow and assignment services.
- Runtime hooks into work-package transitions and audit events.

## 9. Test Strategy

- Permission and role-scope tests for collaboration actions.
- Workflow transition tests for approvals, rejects, and reassignment.
- Concurrency tests for simultaneous edits/handovers.
- Audit integrity tests for action traceability.

## 10. Security Risks

- Unauthorized access to project context through collaboration artefacts.
- Role confusion leading to improper approval authority.
- Notification-channel leakage of sensitive project data.
- Incomplete audit attribution on delegated actions.

## 11. Parallelisation Notes

- UX flows and notification planning can run in parallel.
- Core workflow persistence must serialize under one migration owner.
- Integration with orchestration and governance can parallelize after contracts stabilize.

## 12. What Must Wait for Earlier Phases

- Must wait for stable membership/authz behavior from earlier phases.
- Must wait for enterprise policy controls governing shared workflows.
- Must wait for orchestration/work-package maturity where agent delegation participates.
