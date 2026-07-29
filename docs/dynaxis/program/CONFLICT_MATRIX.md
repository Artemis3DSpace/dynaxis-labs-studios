# Dynaxis Work Package Conflict Matrix

HARD means tasks must be serialized unless explicitly coordinated. SOFT means parallel work is possible with explicit file ownership and integration order. NONE means no expected direct file conflict. This matrix is based on narrowed Allowed Paths and shared_files metadata.

| Shared Area | Conflict | Packages / Phases | Reason | Coordination Rule |
|---|---|---|---|---|
| `lib/dynaxis/identity/schema.js`, `lib/dynaxis/db/schema.js`, `drizzle/**` | HARD | WP-7C-04, WP-7C-05, WP-7C-24 | 7C.4 workspace ownership and 7C.5 project membership schema migrations are integrated. WP-7C-24 is the active Phase 7C migration owner (migration `0014`), relaxing `owner_ref NOT NULL` on `dynaxis_projects` and `dynaxis_assets` only. | WP-7C-24 owns migration `0014` and `lib/dynaxis/db/{schema,store,memory-store}.js`; no other Phase 7C package may own a schema migration or edit those files until WP-7C-24 integrates. |
| Provider connection persistence and secrets | HARD | WP-7D-03 | ProviderConnection schema and encrypted-secret references are one persistence boundary. | No other 7D package owns schema migration. |
| Job Engine persistence | HARD | WP-7E-04 | Job attempts, events, leases, and idempotency tables form one durable execution schema. | Runtime queue/worker packages depend on WP-7E-04. |
| Project Graph and Memory persistence | HARD | WP-7F-02, WP-7F-03 | Graph edges land before memory/knowledge/decision records that cite graph nodes. | WP-7F-03 is serialized after WP-7F-02. |
| Capability / Model Registry persistence | HARD | WP-7G-02 | Registry schema owns capability, model, provider mapping, and version tables. | Resolver/admin packages depend on WP-7G-02. |
| Character Identity Profile persistence | HARD | WP-7H-02 | Identity profile tables attach provider identity to canonical Characters. | Adapter/UI packages depend on WP-7H-02. |
| Agent / Engineering contract persistence | HARD | WP-7I-02 | WorkPackage runtime contract schema precedes worker and verification contracts. | WP-7I-03 and WP-7I-04 depend on WP-7I-02. |
| App Factory persistence | HARD | WP-8A-02, WP-8A-03, WP-8A-04, WP-8A-05 | App IR, Software Components, Blueprints/Capabilities, and Repository model are separate but sequential schema owners. | Migration owners are explicitly serialized in dependency order. |
| Composer timeline persistence | HARD | WP-8C-02 | Timeline tracks/clips persistence is canonical for later Composer UI/render work. | WP-8C-03 through WP-8C-06 depend on WP-8C-02. |
| Layout IR persistence | HARD | WP-8D-02, WP-8D-03 | Stack/constraint primitives precede breakpoint/screen state schema. | WP-8D-03 depends on WP-8D-02. |
| Skills persistence | HARD | WP-8E-02 | Skill registry/package/version/permission persistence is a single initial migration owner. | Later Skills packages depend on WP-8E-02. |
| Developer Platform persistence | HARD | WP-8F-02, WP-8F-03 | Developer apps/credentials precede public webhook/log/usage storage. | WP-8F-03 depends on WP-8F-02. |
| Plugin installation persistence | HARD | WP-8G-04 | Install/upgrade/rollback lifecycle owns plugin installation state. | Runtime and signing packages land first; install schema lands in WP-8G-04. |
| Marketplace persistence | HARD | WP-8H-02, WP-8H-03, WP-8H-04 | Catalogue/publisher persistence precedes versions/installations, then licensing/entitlements. | Marketplace migration owners are serialized in dependency order. |
| Commercial platform persistence | HARD | WP-10-01, WP-10-02, WP-10-04, WP-10-05, WP-10-06 | Billing, marketplace purchasing, admin/support, audit/security, and compliance retention schemas are separate production lines. | Dependencies serialize migration owners where they share the integration line. |
| Studio shell and shared UI | SOFT | WP-7C-18 through WP-7C-20, WP-7D-06, WP-7G-05, WP-8C-03, WP-8D-04, WP-8F-05, WP-8H-02 | UI packages can overlap in `packages/studio/src/**`. | Assign one UI shell owner at a time or require explicit file-level coordination. |
| App IR contracts | HARD | WP-8A-01, WP-8A-02, WP-8D-05, WP-9-01 | App IR is a canonical Build contract consumed by layout and orchestration. | App IR specification and validation land before consumers. |
| Composer / Composition shared code | SOFT | WP-8C-02 through WP-8C-06, WP-8D-04 | Composer and design canvas work can touch Composition-adjacent code. | Keep Composer timeline/render graph separate from Layout IR. |
| Specification-only packages | NONE | READY specification Work Packages | Documentation-only work may run in parallel with ready identity implementation work. | Specs may inspect runtime code but edit only docs/programme files. WP-7C-08 and WP-7C-09 are complete. |
