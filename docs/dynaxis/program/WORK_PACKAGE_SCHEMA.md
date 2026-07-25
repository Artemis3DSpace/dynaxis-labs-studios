# Work Package Schema

Every Work Package is a Markdown file with machine-readable YAML front matter followed by the required sections below.

## Front Matter

```yaml
---
id: WP-7E-01
phase: 7E
title: Example
status: backlog
agent: unassigned
base_sha: null
branch: null
worktree: null
depends_on: []
blocks: []
migration_owner: false
---
```

## Required Fields

- `id`: stable Work Package identifier, formatted as `WP-<phase>-<number>`.
- `phase`: roadmap phase, such as `7C`, `8A`, `9`, or `10`.
- `title`: short human-readable title.
- `status`: one of `backlog`, `ready`, `in_progress`, `review`, `blocked`, `done`.
- `agent`: one of `unassigned`, `codex`, `claude`, `cursor`.
- `base_sha`: starting commit SHA, or `null` before assignment.
- `branch`: isolated implementation branch, or `null` before assignment.
- `worktree`: isolated implementation worktree path, or `null` before assignment.
- `depends_on`: list of Work Package IDs that must be integrated first.
- `blocks`: list of Work Package IDs blocked by this package.
- `migration_owner`: `true` only when this package has explicit migration-number ownership.

## Required Sections

Each Work Package must include these sections in order:

```markdown
# Objective

# Context

# Dependencies

# Allowed Paths

# Forbidden Paths

# Required Deliverables

# Contracts That Must Not Change

# Acceptance Criteria

# Validation

# Commit

# Stop Condition
```

## Status Values

- `backlog`: defined but not ready to begin.
- `ready`: dependencies are satisfied and the package can be assigned.
- `in_progress`: assigned and actively being worked.
- `review`: implementation is complete and awaiting review or integration.
- `blocked`: blocked by dependency, decision, conflict, or failed validation.
- `done`: reviewed and integrated.

## Agent Values

- `unassigned`
- `codex`
- `claude`
- `cursor`

## Control Rule

A Work Package is not executable unless its dependency state, allowed paths, forbidden paths, validation requirements, and migration ownership status are explicit.
