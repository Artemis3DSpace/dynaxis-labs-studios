# Handoff - Scaffold Waves 1-4 Programme Reconciliation

**Type:** documentation reconciliation. No runtime code, no schema, no migration.

**Base `main`:** `204e5ff051ea7306c4133cbe64f3f7ac561cb239`
**Test baseline:** 664/664 passing

## Why this handoff exists

Waves 1-4 integrated thirteen scaffold / domain contract areas under
`lib/dynaxis/**` and correctly changed **zero** files under
`docs/dynaxis/program/**` each time. The side effect: the programme catalogue
described a `main` that no longer existed.

Two concrete defects resulted.

1. **Thirteen contract domains had no owning Work Package record.** Nothing in
   `WORK_PACKAGES.md` acknowledged that `lib/dynaxis/jobs/**`,
   `lib/dynaxis/publish/**` and eleven siblings were on `main`.
2. **Five scaffold phase documents collide with authoritative phase letters.**
   Their titles reuse 7H, 8E, 8F, 8G, and 8H, which the catalogue assigns to
   Character Identity Profiles, Skills, Developer Platform, Extension / Plugin
   Platform, and Marketplace respectively. None of the five documents cites any
   `WP-*` identifier.

## Resolution

A new authoritative document, `docs/dynaxis/program/SCAFFOLD_INVENTORY.md`,
records all thirteen domains with inventory identifiers `SD-01` - `SD-13`.

**No existing Work Package was renamed, retyped, reassigned, completed, or
removed. No phase letter was reinterpreted.** The catalogue meanings of 7H, 8E,
8F, 8G, and 8H stand unchanged.

- **SD-01 - SD-08** align with existing catalogue phases (7E, 7F, 7G, 7I, 8A,
  8B, 8C, 8D). Recorded as scaffold-only; the named runtime and persistence
  Work Packages remain `ready` or `backlog`.
- **SD-09 - SD-13** are the five orphans. Recorded as **requires future
  work-package ownership**, with contract-edits-only until a programme decision
  allocates real phase letters or Work Package IDs.

`SD-` identifiers sit deliberately outside the
`WP-(7[C-I]|8[A-H]|9|10)-\d{2,}` pattern that
`scripts/dynaxis-program-status.mjs` enforces. They carry no status, no agent,
and no dependency edges, so `program:status` is unaffected.

## What did not change

- No Work Package status moved to `done`.
- No persistence, worker, provider-use, app-generation, publishing, deployment,
  or storage capability is recorded as complete.
- The only **implemented runtime** areas remain **Phases 7C and 7D**.
- Migrations remain `0008` - `0015`. No migration owner was claimed.

## Phase 7D residual risks - unchanged and still binding

| ID | Risk | Severity | Status |
|---|---|---|---|
| R1 | No service-principal allowlist | **Medium** | **Still blocks `WP-7E-06` ProviderConnection use.** Now additionally enforced in code by `assertWorkerProviderConnectionBlocked()` in `lib/dynaxis/jobs/contracts.js`, which throws `501` unconditionally. |
| R2 | Phase-7D-local permission vocabulary | Low | Accepted, fail-closed. |
| R3 | In-memory audit sink | **Medium** | Accepted; durable audit needs a migration owner. |
| R4 | Production KMS unwired | **Medium** | Accepted; adapter fails closed. |
| R5 | Route handlers not executed in tests | Low | Accepted. |
| R6 | Legacy `x-api-key` routes un-migrated | Low | Accepted; no ProviderConnection authority. |

## Guidance for the next agent

1. Read `SCAFFOLD_INVENTORY.md` before planning any Phase 7E-9 work. It is the
   only accurate map of scaffold vs spec vs implemented runtime.
2. Do not treat any `SD-` domain as implemented.
3. `WP-7E-04` Job Schema Migration and Persistence is the sole reachable
   migration owner. Its dependencies are `WP-7D-07` (done) plus `WP-7E-01` and
   `WP-7E-03`, both still `ready` specification packages. Note `WP-7E-01` has an
   unmerged branch, `phase-7e/job-state-machine-spec`; inspect it before
   redoing that work.
4. `WP-7E-05` and `WP-7E-06` stay closed. R1 is unresolved.
5. Allocating phase letters for SD-09 - SD-13 is a programme decision, not an
   implementation task.
