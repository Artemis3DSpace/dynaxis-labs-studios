# Phase 5A — AI Headshot Mini App Integration

**Status:** Complete (2026-07-21)  
**Mini App ID:** `dynaxis.headshot`  
**Upstream:** [SamurAIGPT/ai-headshot-generator](https://github.com/SamurAIGPT/ai-headshot-generator) (MIT)

This is the first production Dynaxis Mini App migration and the reference pattern for future Phase 5 integrations.

---

## 1. Source repository

Inspected (not nested, not iframe, not repo merge):

- Workflow: upload/reference portrait → choose style category + aspect ratio → MuAPI `photo-pack` → multi-image pack
- Provider: `POST /api/v1/photo-pack` with `{ image_url, category, aspect_ratio }`
- Style categories and aspect ratios are provider presets (not freeform prompt engineering)
- Standalone SaaS also included NextAuth/Google, Stripe, credits, Prisma `creations` history, landing/pricing — **not migrated**

---

## 2. MIGRATE / ADAPT / DISCARD

### MIGRATE

| Item | Destination |
|------|-------------|
| Style categories list | `packages/mini-apps/headshot/presets.js` |
| Aspect ratio options | `presets.js` |
| photo-pack parameter shape | `capability.js` → generation request |
| Multi-output pack UX + download | `HeadshotMiniApp.js` |
| Domain workflow framing | Headshot UI + capability summary |
| MIT attribution | Manifest `attribution` + this doc |

### ADAPT

| Standalone | Dynaxis |
|------------|---------|
| Direct MuAPI client / webhook | Mini App runtime → `executeMiniAppMuapiGeneration` → `executeMuapiPrediction` |
| Local upload → CDN URL only | Upload via studio `uploadFile` + register Dynaxis Asset (`portrait_reference`) |
| Prisma creations history | Dynaxis Generation + Assets + Job lifecycle |
| Implicit project | Active Dynaxis Project (Default Project OK) |
| Template Apps catalogue card | Superseded by integrated module card (`filterCatalogueTemplates`) |

### DISCARD

- NextAuth / Google login  
- Stripe / subscriptions / credit packs / pricing UI  
- Landing / marketing pages / standalone navbar  
- Prisma schema / independent DB  
- Webhook-primary generation path as product surface  
- Standalone shell / branding  
- Duplicate MuAPI credential handling outside Dynaxis Settings  

---

## 3. Mini App architecture

```text
packages/mini-apps/headshot/
  manifest.js      # dynaxis.headshot, status: integrated
  presets.js       # categories, aspect ratios, endpoint
  capability.js    # validate / build / generateHeadshot / invokeCapability
  HeadshotMiniApp.js  # Dynaxis-styled UI
  index.js         # Component + capability exports
```

Registration:

- `lib/dynaxis/mini-apps/bootstrap.js` — registers manifest  
- `lib/dynaxis/mini-apps/loader.js` — allowlisted lazy import  

Host:

- Apps → Dynaxis modules → `MiniAppHost` → permissioned runtime + error boundary  

---

## 4. Manifest & permissions

**ID:** `dynaxis.headshot`  
**Status:** `integrated`  
**Permissions (least privilege):**

- `project:read`
- `assets:read` / `assets:write`
- `generation:create` / `generation:read`
- `jobs:create` / `jobs:read`
- `models:use`

**Not granted:** `external:network`, `project:write`

**Asset input:** `image` + role `portrait_reference`  
**Outputs:** `image` (multi-asset pack supported)

---

## 5. Project / Asset / Generation / Job

| Concern | Behaviour |
|---------|-----------|
| Project | Uses active Dynaxis Project context; no Headshot project system |
| Input | Upload or reuse project image Asset; semantic role `portrait_reference` |
| Generation | `runtime.createGeneration` → lifecycle start → MuAPI executor → complete/fail |
| Job | Dynaxis Job record; no Headshot polling loop |
| Results | Each output URL registered as Dynaxis Asset; CDN URLs retained |
| History | Dynaxis Generation History with `miniAppId` provenance |
| Auth/Billing | None — Dynaxis owns later |

Executor: `lib/dynaxis/mini-apps/execute-generation.js` uses `executeMuapiPrediction` (`trackLifecycle: false`) so lifecycle is not doubled with studio `submitAndPoll`.

---

## 6. Capability / domain layer

Headless-friendly API:

- `validateHeadshotRequest`
- `buildHeadshotGenerationRequest`
- `generateHeadshot(runtime, input)`
- `invokeCapability(name, args, runtime)` — `generateHeadshot`, `listCategories`, `listAspectRatios`, `buildPlan`, `validate`

UI calls the same capability path Skills/Agents will use later.

---

## 7. Apps UI & catalogue dedupe

- Integrated card under **Dynaxis modules** (Open module → in-app host)
- External template **AI Headshot Studio** hidden when `dynaxis.headshot` is integrated (`packages/studio/src/catalogue-dedupe.js`)
- Upstream repo attribution retained in manifest; GitHub source not deleted from docs

---

## 8. UI/UX

Dynaxis shell surfaces, typography, and colours preserved.  
No standalone SaaS chrome, pricing header, or account sidebar.  
Domain workflow retained: style grid, aspect ratios, reference guidance, multi-result pack + download.

---

## 9. Phase 4 framework changes required by real integration

| Change | Why |
|--------|-----|
| Semantic role `portrait_reference` | Headshot reference input semantics without Character entity |
| `executeMuapiPrediction` + Mini App executor | Avoid double Generation/Job when runtime owns lifecycle |
| `collectUrls` multi-shape outputs | photo-pack returns multiple URLs |
| Catalogue dedupe helper | Prevent duplicate Headshot product cards |
| Default `executeGeneration` in `MiniAppHost` | Production modules need a wired MuAPI path |

No speculative Character/identity system was added.

---

## 10. Security

- No upstream secrets / Stripe keys migrated  
- No `external:network` permission  
- Provider credentials remain Dynaxis Settings → MuAPI proxies  
- Permission gates deny escalation without declared grants  
- Failures sanitize messages; no raw secret exposure  

---

## 11. Licence / attribution

- Upstream licence: **MIT** (SamurAIGPT/ai-headshot-generator)  
- Reused/adapted: category list, aspect ratios, photo-pack params, pack download UX patterns  
- Discarded: auth, billing, Prisma history, marketing shell  
- User-facing product name: **AI Headshot** (Dynaxis module)

---

## 12. Tests

`tests/dynaxis-headshot.test.mjs` — manifest, registry visibility, catalogue dedupe, validation, request mapping, mocked multi-output generation, provider failure, permission denial, capability invoke.

MuAPI is mocked; no paid credits consumed.

---

## 13. Phase 5B preview (not implemented)

AI Character Studio will need beyond Headshot:

- Persistent **Character** entity (not only `portrait_reference` Asset)
- Multiple character reference Assets + identity metadata
- Backstory / persona continuity across generations
- Reuse across Projects / image-to-video
- Stronger continuity than single-shot photo-pack

Do not build these in Phase 5A.
