# Dynaxis Labs Studios — Target Architecture

**Status:** Proposed production architecture (documentation only — not implemented in Phase 1)  
**Product:** Dynaxis Labs Studios  
**Out of scope for this repository phase:** Dynaxis OS, Supercomputer layer (Phase 8), speculative greenfield rewrites

---

## 1. Product boundary

**Dynaxis Labs Studios** is the production AI creative platform that will evolve from this fork.

It must ultimately contain:

- AI Image Studio  
- AI Video Studio  
- Cinema Studio  
- Audio Studio  
- Lip Sync  
- AI Clipping  
- Vibe Motion  
- Marketing Studio  
- AI Influencer capabilities  
- Workflow Studio  
- Agent Studio  
- Design Agent  
- Mini Apps (as internal modules)  
- Skills  
- Projects  
- Assets  
- Generation history  
- Model discovery  
- MCP and external integrations  

**Not in this repo’s near-term implementation:** Dynaxis OS as a separate control plane product.

---

## 2. Architectural principle

```text
ONE PLATFORM + MANY MODULES
```

Not:

```text
70 SEPARATE NEXT.JS APPLICATIONS
```

Studios and mini-apps are **modules** that consume shared Dynaxis platform services. They do not each reinvent auth, billing, storage, jobs, or navigation.

---

## 3. Target layered architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│ Presentation                                                     │
│  Dynaxis Shell (nav, projects switcher, account, credits)        │
│  Studio modules · Mini-app modules · Skills UI · Admin           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Module SDK / contracts
┌───────────────────────────────▼─────────────────────────────────┐
│ Application services                                             │
│  Projects · Assets · History · Model catalogue · Permissions     │
│  Job orchestration · Notifications · Webhooks                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│ Platform core                                                    │
│  Identity · Orgs/workspaces · Billing/credits · Audit logging    │
│  Config · Feature flags · Telemetry                              │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│ Model gateway                                                    │
│  MuAPI adapter (primary) · Local inference adapter · Future APIs │
│  Unified submit/poll/status · Cost estimation                    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│ Infrastructure                                                   │
│  Object storage · DB · Queue · Secrets · Observability           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Preserve and elevate existing advanced systems

These remain first-class Dynaxis capabilities (do not remove or downgrade):

| Existing system | Target role |
|-----------------|-------------|
| Vibe Workflow / Workflow Studio | Production pipeline builder module |
| Agent Studio / Open-Poe agents | Conversational agent module |
| Design Agent | Autonomous creative planning/execution module |
| Cinema Studio | High-end cinematic generation module |
| Local inference + Electron | Offline/hybrid desktop capability |
| MCP/CLI integrations | External developer surface; later Skills bridge |
| `packages/studio` model catalogue | Seed for Dynaxis model registry |

Target state should **wrap and standardize** these systems behind shared services, not rewrite them for preference.

---

## 5. Platform services (target)

| Service | Responsibility |
|---------|----------------|
| **Identity** | Users, sessions, API keys (Dynaxis-issued and/or linked MuAPI keys) |
| **Organisations / workspaces** | Multi-seat access, roles |
| **Projects** | Group assets, generations, workflows, apps |
| **Asset library** | Canonical media objects with provenance |
| **Generation history** | Cross-studio job timeline |
| **Model catalogue** | Curated models, capabilities, pricing metadata |
| **Model gateway** | Single client for submit/status/cancel/cost |
| **Jobs** | Async execution, retries, timeouts, fan-out |
| **Storage** | Upload, virus scan policy, retention |
| **Billing / credits** | Dynaxis ledger; may settle via MuAPI or other providers |
| **Permissions** | RBAC across projects/modules |
| **Logging / telemetry** | Structured audit + product analytics |
| **Error handling** | Normalized error taxonomy for UI + API |

Migration rule: introduce Dynaxis services **alongside** MuAPI dependency first; do not hard-cut generation capability.

---

## 6. Module model (studios + mini apps)

Every module declares:

- `id`, `title`, `category`, `version`  
- required permissions  
- navigation contribution  
- optional routes  
- capabilities consumed (`generation.image`, `assets.read`, etc.)  
- UI entry (lazy-loaded React component)  

Core studios become modules with privileged status. Mini apps become the same kind of module with narrower domain UI.

See `MINI_APP_INTEGRATION_ARCHITECTURE.md` for the contract detail.

---

## 7. Web vs desktop target

| Surface | Target |
|---------|--------|
| **Web** | Primary Dynaxis Labs Studios product (Next.js shell + modules) |
| **Desktop** | Same module contracts where feasible; retain local inference; converge UI onto shared React modules over time |

Phase guidance: **do not** force Electron rewrite in Phase 2. Branding and shell first; UI convergence later once shared services exist.

---

## 8. Data ownership target

| Data class | Target owner |
|------------|--------------|
| Users/orgs/projects | Dynaxis DB |
| Assets + generation history | Dynaxis DB + object storage |
| Workflow graphs / agent defs | Prefer Dynaxis with optional MuAPI sync during transition |
| Model metadata | Dynaxis registry (seeded from current `models.js`) |
| Provider job IDs | Dynaxis jobs table referencing MuAPI/local IDs |
| Credits | Dynaxis ledger |

---

## 9. Explicit non-goals (near term)

- Replacing MuAPI wholesale before gateway abstraction exists  
- Embedding 70 independent SaaS apps as git submodules of full Next apps  
- Building Dynaxis OS inside this repo  
- Removing Electron/local inference to “simplify”  
- Broad dependency upgrades as an architecture substitute  

---

## 10. Success criteria for “production-grade”

Dynaxis Labs Studios is production-grade when:

1. A user can authenticate to **Dynaxis** (not only paste a third-party key into localStorage).  
2. Generations across studios appear in one **project-scoped history**.  
3. Assets are reusable across studios/modules without copy-paste of CDN URLs.  
4. Credits/billing are accountable at the Dynaxis account/org level.  
5. New mini apps can ship as modules without cloning the platform.  
6. Workflow, Agents, Design Agent, Cinema, and local inference remain available and supported.
