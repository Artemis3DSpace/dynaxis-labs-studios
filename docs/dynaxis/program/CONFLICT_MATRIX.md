# Dynaxis Work Package Conflict Matrix

HARD means tasks must be serialized unless explicitly coordinated. SOFT means parallel work is possible with explicit file ownership and integration order. NONE means no expected direct file conflict.

| Shared Area | Conflict | Packages / Phases | Reason | Coordination Rule |
|---|---|---|---|---|
| `lib/dynaxis/db/schema.js` | HARD | 7C, 7D, 7E, 7F, 7G, 7H, 7I, 8A, 10 migration owners | Central Drizzle schema is a shared persistence contract. | Only one active migration owner on an integration line. |
| `lib/dynaxis/identity/schema.js` | HARD | WP-7C-04 through WP-7C-07 | Identity schema is actively owned by 7C.4 and project membership follows it. | Serialize until 7C.4 is integrated. |
| `lib/dynaxis/auth/**` | HARD | WP-7C-08 through WP-7C-23, 7D permissions, 8F API auth | AuthContext and authorization contracts are cross-cutting. | Auth packages must land before dependent route/client work. |
| `drizzle/**` | HARD | Every `migration_owner: true` package | Migration file numbering is branch-state dependent. | Resolve migration number only when package starts from its integration branch. |
| `package.json` | SOFT | 7C TanStack Query, 7E queues, 8F SDK/CLI, testing tools | Dependency additions can collide but are reviewable. | Coordinate dependency/version additions and lockfile updates. |
| Central provider/capability registries | HARD | 7D, 7G, 8H | Registry ownership determines provider/model/package authority. | 7G registry contracts precede Marketplace distribution. |
| Shared application layouts and Studio shell | SOFT | 7C client migration, 7D UI, 7G admin, 8C/8D/8H UI | Multiple UI phases touch Studio navigation and shells. | Cursor-owned UI packages should avoid simultaneous shell rewrites. |
| App IR | HARD | 8A, 8B, 8D, 9 | App IR is canonical Build architecture. | 8A App IR specification and validation land first. |
| Composer / Composition shared code | SOFT | 8C Composer, 8D responsive design, existing Creative Editor | Composer and Auto Layout both touch composition-adjacent code. | Keep timeline/render graph separate from layout IR. |
| `packages/mini-apps/character-studio/**` | SOFT | 7H Character Identity, 7C route migration, 8C integrations | UI and API integration may overlap. | Sequence route migration before identity profile UI. |
| Documentation-only Work Packages | NONE | Specification and review packages | No runtime code changes expected. | May run in parallel if dependencies are documentation-safe. |
