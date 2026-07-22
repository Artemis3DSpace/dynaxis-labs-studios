# Dynaxis Labs Studios — Platform Services Audit

**Date:** 2026-07-21 (updated after Phase 3)  
**Method:** Implementation review  
**Classifications:** PRODUCTION READY · PARTIAL · DEMO/LOCAL ONLY · MISSING · **IMPLEMENTED** (Dynaxis-owned)

---

## Summary matrix

| Service | Classification | Evidence summary |
|---------|----------------|------------------|
| User accounts | MISSING | No Dynaxis user model; MuAPI key → `owner_ref` hash only |
| Authentication | PARTIAL | API-key gate + `x-api-key`; hashed ownership for platform rows |
| Organisations / workspaces | MISSING | Not present |
| Projects | **IMPLEMENTED** | PostgreSQL `dynaxis_projects` + Default Project + `/api/dynaxis/projects` |
| Asset library | **IMPLEMENTED** (metadata) | Unified `dynaxis_assets`; CDN/MuAPI URLs; richer library UI deferred |
| Generation history | **IMPLEMENTED** | `dynaxis_generations` SoT; `hg_*` import/compat retained |
| Model catalogue | PRODUCTION READY* | `packages/studio/src/models.js` |
| Model configuration | PARTIAL | Schema-driven inputs; no Dynaxis admin layer |
| API keys | PARTIAL | User MuAPI key in localStorage; session helper |
| MuAPI client | PRODUCTION READY* | `muapi.js` + Phase 3 `MuAPIProvider` adapter |
| Async jobs | **IMPLEMENTED** (metadata) | Persistent jobs + client poll; MuAPI executes |
| Queues | MISSING | No owned queue workers |
| Webhooks | MISSING | No Dynaxis webhook receiver |
| Storage | PARTIAL | Proxies + MuAPI URLs; no Dynaxis object store |
| Billing | DEMO/LOCAL ONLY† | External MuAPI; Apps Stripe text for templates |
| Credits | PARTIAL | MuAPI balance display; no Dynaxis ledger |
| Subscriptions | MISSING | Not implemented |
| Permissions / RBAC | MISSING | Owner_ref isolation only |
| Logging | PARTIAL | Ad-hoc; no structured platform logging |
| Telemetry | MISSING | — |
| Error handling | PARTIAL | Toasts + persisted sanitized job errors |
| Local inference | PRODUCTION READY* | Electron |
| Workflows | PRODUCTION READY* | Submodule; not yet on Dynaxis lifecycle |
| Agents | PRODUCTION READY* | Submodule; not yet on Dynaxis lifecycle |
| Design Agent | PRODUCTION READY* | Package intact; not yet on Dynaxis lifecycle |
| Apps / mini-app runtime | DEMO/LOCAL ONLY | Catalogue only |
| MCP/CLI in-product | DEMO/LOCAL ONLY | Docs/links UI |
| Electron desktop shell | PRODUCTION READY* | Packaging + local AI |

\* Upstream capability operational; Dynaxis first-party standards vary.  
† Dynaxis product billing missing.

See `PHASE_3_PLATFORM_FOUNDATION.md` for schema and API detail.


---

## Detailed assessments

### User accounts — MISSING

No signup, profile, password, OAuth, or user table in this repository. “User” is effectively whoever holds a MuAPI key.

### Authentication — PARTIAL

- Web: `ApiKeyModal` + `localStorage.muapi_key`  
- Requests: `x-api-key` header  
- Platform APIs hash the key to `owner_ref` (never store raw key)  
- Cookie sync retained for agent SSR only; proxies do not trust cookies  
- Not production multi-tenant SaaS identity  

### Organisations / workspaces — MISSING

No org model, invites, seats, or shared workspace entities.

### Projects — IMPLEMENTED

PostgreSQL `dynaxis_projects` with Default Project auto-resolution, create/list/update/archive APIs, and shell project context. See `PHASE_3_PLATFORM_FOUNDATION.md`.

### Asset library — IMPLEMENTED (metadata)

Unified `dynaxis_assets` catalogue with project/generation/job links. Media bytes remain at MuAPI/CDN URLs in Phase 3. Rich Asset Library UI deferred.

### Generation history — IMPLEMENTED

Durable `dynaxis_generations` as platform SoT. Per-studio `hg_*` localStorage retained for compatibility; import API dedupes via `migration_key`.

### Model catalogue — PRODUCTION READY (as client catalogue)

- `packages/studio/src/models.js` is large, generated from `models_dump.json`, used across studios  
- Electron re-exports the same SoT  
- Caveat: not a Dynaxis-managed registry service  

### Model configuration — PARTIAL

- Per-model `inputs` schemas drive UI controls  
- No Dynaxis admin UI / versioning / entitlement gating  

### API keys — PARTIAL

- User pastes MuAPI key  
- Multiple storage keys (`muapi_key`, `token`) create inconsistency  
- No Dynaxis-issued scoped keys  

### MuAPI client — PRODUCTION READY (as integration client)

Studio `muapi.js` covers image/video/i2i/i2v/v2v/lipsync/audio/marketing/recast/clipping/motion, uploads, balance, workflows, agents, costs, app interest. Phase 3 wraps `submitAndPoll` for lifecycle persistence and adds `MuAPIProvider` adapter.

Duplication with Electron `src/lib/muapi.js` is a maintenance risk but does not reduce current web capability.

### Async jobs — IMPLEMENTED (metadata)

Persistent `dynaxis_jobs` with provider prediction IDs and status transitions. Execution remains MuAPI client poll (no Dynaxis queue workers).

### Queues — MISSING

No Bull/SQS/etc. workers in this repo.

### Webhooks — MISSING

No inbound webhook handlers for job completion fan-out to Dynaxis clients.

### Storage — PARTIAL

Upload proxies and MuAPI file URLs. No first-party bucket abstraction or lifecycle policies.

### Billing — DEMO/LOCAL ONLY (for Dynaxis)

- Host shows MuAPI balance  
- Apps Studio copy markets Stripe-enabled **external templates**  
- No Dynaxis invoices/subscriptions/payment methods  

### Credits — PARTIAL

`getUserBalance` + UI display. No Dynaxis credit grants, holds, or per-project budgets.

### Subscriptions — MISSING

### Permissions — MISSING

### Logging — PARTIAL

Proxy console logs; no correlation IDs, log levels, or sink.

### Telemetry — MISSING

### Error handling — PARTIAL

Per-studio try/catch + toasts + `muapi:auth-required`. No shared error codes for modules.

### Local inference — PRODUCTION READY (desktop capability)

Electron local AI stack is real: binary download, model management, generation IPC, Wan2GP bridge, tests under `tests/`.

### Workflows / Agents / Design Agent — PRODUCTION READY (feature depth)

These are among the strongest systems in the repo and must be preserved. They still rely on MuAPI tenancy rather than Dynaxis tenancy.

### Apps / mini-app runtime — DEMO/LOCAL ONLY

Catalogue UX only. See Apps audit in `REPOSITORY_AUDIT.md`.

### MCP/CLI — DEMO/LOCAL ONLY (in-app)

In-app surfaces document external `muapi-cli`, MCP server, and Generative-Media-Skills. Not an embedded MCP runtime.

---

## Implications for Phase 3 (shared platform services)

Highest-priority gaps for a production Dynaxis platform:

1. Identity + session model  
2. Projects  
3. Unified assets + generation history  
4. Dynaxis job records wrapping MuAPI/local jobs  
5. Credits ledger (even if settlement remains MuAPI initially)  

Do **not** block on replacing MuAPI generation quality; wrap it.
