# Dynaxis Scaffold Domain Inventory

This document is the authoritative record of **scaffold / domain contract** code
that exists on `main` but is **not** runtime implementation and is **not** owned
by a completed Work Package.

It exists because Waves 1-4 landed thirteen contract-only domains under
`lib/dynaxis/**` without changing `docs/dynaxis/program/**`. The catalogue in
`WORK_PACKAGES.md` therefore did not describe `main`. This inventory closes that
gap without inventing Work Package completions.

## Baseline this inventory describes

| Field | Value |
|---|---|
| `origin/main` | `204e5ff051ea7306c4133cbe64f3f7ac561cb239` |
| Test baseline | **664/664 passing** |
| Migrations on main | `0008` - `0015` (unchanged by Waves 1-4) |
| Runtime implementation complete | **Phases 7C and 7D only** |

## Reading this document

Four states are used throughout the programme docs. They are not interchangeable.

| State | Meaning |
|---|---|
| **spec only** | A specification Work Package exists or is `ready`. No code. |
| **scaffold present** | Domain contracts exist under `lib/dynaxis/**`: schemas, frozen constants, validators, pure helpers. No I/O, no persistence, no runtime behaviour. |
| **implemented runtime** | A Work Package is `done` and its runtime behaviour is live on `main`. Only Phases 7C and 7D qualify. |
| **requires future work-package ownership** | Scaffold exists but no Work Package in `WORK_PACKAGES.md` owns it. |

A scaffold being present **never** implies persistence, workers, provider use,
app generation, publishing, deployment, or storage is implemented. In every case
below: **runtime not implemented, no schema/migration.**

## Scaffold domains aligned to existing catalogue phases

These eight scaffolds match the phase meaning already in `WORK_PACKAGES.md`.
They are scaffold-only; the named Work Package still owns the runtime and
remains `ready` or `backlog`.

| ID | Domain | Path | Tests | Catalogue phase | Runtime owner (not started) | Persistence owner |
|---|---|---|---|---|---|---|
| SD-01 | Job / Event Engine | `lib/dynaxis/jobs/**` | 2 | 7E Server Job / Event Engine | WP-7E-05, WP-7E-06 | **WP-7E-04** |
| SD-02 | Project Graph + Memory | `lib/dynaxis/project-graph/**` | 1 | 7F Project Graph + Memory | WP-7F-04 - WP-7F-06 | **WP-7F-02**, WP-7F-03 |
| SD-03 | Capability / Model Registry | `lib/dynaxis/capabilities/**` | 1 | 7G Capability / Model Registry | WP-7G-03, WP-7G-04 | **WP-7G-02** |
| SD-04 | Agent / Engineering Contracts | `lib/dynaxis/agents/**` | 1 | 7I Agent / Engineering Contracts | WP-7I-03, WP-7I-04 | **WP-7I-02** |
| SD-05 | App Factory Core / App IR | `lib/dynaxis/app-factory/**` | 2 | 8A App Factory Core | WP-8A-06 | **WP-8A-02** - **WP-8A-05** |
| SD-06 | Build Runtime | `lib/dynaxis/build-runtime/**` | 3 | 8B Build Runtime | WP-8B-02 - WP-8B-06 | none (no migration owner in 8B) |
| SD-07 | Composer | `lib/dynaxis/composer/**` | 2 | 8C Composer | WP-8C-03 - WP-8C-06 | **WP-8C-02** |
| SD-08 | Responsive / Auto Layout | `lib/dynaxis/layout/**` | 3 | 8D Responsive Design / Auto Layout | WP-8D-04, WP-8D-05 | **WP-8D-02**, **WP-8D-03** |

SD-06 has the largest persistence surface in its contracts but **no migration
owner exists in Phase 8B**. Its storage seams route through WP-8A-07 and
WP-7E-10. Do not open a migration for SD-06 without first assigning an owner.

## Orphan scaffold domains - phase-letter collision

Waves 3-4 delivered five domains whose **document titles** reuse phase letters
that `WORK_PACKAGES.md` already assigns to different subject matter.

**The catalogue meanings of 7H, 8E, 8F, 8G, and 8H are unchanged and remain
authoritative.** The collision is in scaffold document titles and directory
naming only. No Work Package was renamed, retyped, reassigned, or removed.

| Letter | Catalogue meaning (authoritative, unchanged) | Scaffold document title that collides |
|---|---|---|
| 7H | Character Identity Profiles | "Phase 7H - Workspace Intelligence Domain Scaffold" |
| 8E | Skills | "Phase 8E Design System / Component Library Scaffold" |
| 8F | Developer Platform | "Phase 8F Template / Blueprint Library Scaffold" |
| 8G | Extension / Plugin Platform | "Phase 8G Asset Library / Media Registry Scaffold" |
| 8H | Marketplace | "Phase 8H Publish / Export Boundary Scaffold" |

The five delivered domains appear **nowhere** in `WORK_PACKAGES.md`, and their
phase documents cite **no** `WP-*` identifier. They are therefore recorded here
with provisional inventory identifiers and no Work Package status.

| ID | Domain | Path | Tests | Colliding doc label | Catalogue status |
|---|---|---|---|---|---|
| SD-09 | Workspace Intelligence | `lib/dynaxis/workspace-intelligence/**` | 3 | "7H" | **requires future work-package ownership** |
| SD-10 | Design System / Component Library | `lib/dynaxis/design-system/**` | 3 | "8E" | **requires future work-package ownership** |
| SD-11 | Template / Blueprint Library | `lib/dynaxis/template-library/**` | 3 | "8F" | **requires future work-package ownership** |
| SD-12 | Asset Library / Media Registry | `lib/dynaxis/assets/**` | 3 | "8G" | **requires future work-package ownership** |
| SD-13 | Publish / Export Boundary | `lib/dynaxis/publish/**` | 3 | "8H" | **requires future work-package ownership** |

`SD-` identifiers are **inventory identifiers, not Work Package identifiers**.
They are deliberately outside the `WP-(7[C-I]|8[A-H]|9|10)-\d{2,}` pattern that
`scripts/dynaxis-program-status.mjs` validates, and they carry no status, no
agent, and no dependency edges. They exist so agents can refer to this code
unambiguously until real Work Packages are allocated.

### Resolution rule for SD-09 - SD-13

1. Do **not** reinterpret 7H, 8E, 8F, 8G, or 8H to mean the scaffold subject.
2. Do **not** delete or rewrite the five scaffold phase documents. The code is
   on `main`, passes tests, and is referenced by 15 test files.
3. A future programme decision must allocate these five domains their own phase
   letters or Work Package IDs, then rename the phase documents to match. Until
   that decision lands, this inventory is the only authoritative mapping.
4. Until ownership is allocated: **contract edits only.** No persistence, no
   runtime, no schema, no migration for SD-09 - SD-13.

## What must not be touched yet

| Constraint | Reason |
|---|---|
| **ProviderConnection use from worker dispatch** | Phase 7D residual risk **R1**. Enforced in code: `lib/dynaxis/jobs/contracts.js` sets `WORKER_PROVIDER_CONNECTION_POLICY.status = 'blocked'` and `assertWorkerProviderConnectionBlocked()` throws `501` unconditionally. **WP-7E-06 stays blocked** until an explicit, tested service-principal allowlist exists. |
| Durable audit persistence | Residual risk **R3**. Audit sink is in-memory; needs a migration owner. |
| Production KMS | Residual risk **R4**. Adapter fails closed until configured. |
| Schema / migrations for any SD domain | Only the named persistence Work Packages above may open a migration, one owner at a time per `CONFLICT_MATRIX.md`. |
| SD-09 - SD-13 runtime | No owning Work Package exists. |

Residual risks **R2**, **R5**, and **R6** remain accepted and fail-closed; see
`CURRENT_WORK.md` and
`handoffs/wp-7d-07-provider-connection-security-review.md`.

## Integration history

| Wave | `main` after | Tests | Domains landed |
|---|---|---|---|
| Wave 1 | `39ba97531c1eb7a33835bcd30a0d75a2ee68f30a` | 570/570 | SD-01 jobs, SD-05 app-factory, SD-07 composer |
| Wave 2 | `839590d8753a23ae04132199f502d026c7331190` | 603/603 | SD-02 project-graph, SD-03 capabilities, SD-04 agents, SD-06 build-runtime, SD-08 layout |
| Wave 3 | `00c17ec07b793ea2781efb2f549314cd12b74560` | 638/638 | SD-09 workspace-intelligence, SD-10 design-system, SD-11 template-library |
| Wave 4 | `204e5ff051ea7306c4133cbe64f3f7ac561cb239` | 664/664 | SD-12 assets, SD-13 publish |

`f4885e63c9e3babc8e74e79dadad50bdb9681c77` sits between Waves 1 and 2 and is a
test-environment fix (`tests/setup/server-only-loader.mjs`), not a scaffold.

Every wave added **zero** files under `drizzle/**`, `lib/dynaxis/provider-connections/**`,
`lib/dynaxis/secrets/**`, `app/api/dynaxis/provider-connections/**`, or
`packages/studio/src/provider-connections/**`, and changed neither `package.json`
nor `package-lock.json`.
