# Dynaxis Mini App — Developer Guide

How to convert a standalone SamurAIGPT / MuAPI repository into a Dynaxis Labs Mini App.

**Prerequisite:** Phase 3 platform foundation + Phase 4 Mini App framework  
**Do not** embed the standalone Next.js app, iframe demos, or clone repos at runtime.

---

## What you are building

An internal Dynaxis module that:

- ships with the Dynaxis application (trusted first-party code);
- declares a typed **manifest**;
- receives a **permissioned runtime**;
- uses Projects → Generations → Jobs → Assets;
- separates **UI** from **capability** logic.

You are **not** shipping another SaaS with its own auth, Stripe, or database.

---

## Step 1 — Inspect the source repository

Identify and keep notes on:

| Keep (usually) | Discard (usually) |
|----------------|-------------------|
| Domain UI / workflow screens | Auth / signup / sessions |
| Prompt templates & model params | Stripe / subscriptions / pricing pages |
| Unique generation composition | Landing / marketing pages |
| Domain types & validation | Independent project/asset DBs |
| Useful asset roles (character, product, …) | Nested MuAPI credential UIs |
| | Standalone global navigation / shell |

---

## Step 2 — Create the module package

Mirror the template:

```text
packages/mini-apps/<your-app>/
  manifest.js          # typed manifest object
  capability.js        # headless domain logic
  YourMiniApp.js       # React UI (runtime prop)
  index.js             # { manifest, Component, invokeCapability }
```

Copy structure from `packages/mini-apps/example/`.

---

## Step 3 — Fill the manifest

Use reverse-dns ids: `dynaxis.headshot`.

Required fields include `permissions`, `entryKey`, `status`, `assetInputs` / `assetOutputs`, and `capabilitySummary`.

Set `status` to `integrated` or `available` only when the module is real and shippable. Use `experimental` during development (hidden from default Apps UI).

---

## Step 4 — Declare permissions (minimum needed)

Example for an image tool:

```js
permissions: [
  'project:read',
  'assets:read',
  'assets:write',
  'generation:create',
  'generation:read',
  'jobs:create',
  'jobs:read',
  'models:use',
]
```

Do not request `external:network` unless required. The runtime denies undeclared access.

---

## Step 5 — Implement capability.js first

Put generation planning / domain transforms here so Skills/Agents can later call `invokeCapability` without the React UI.

Example:

```js
export function buildHeadshotPlan({ portraitAsset, style }) { /* ... */ }

export async function invokeCapability(name, args, runtime) {
  if (name === 'plan') return buildHeadshotPlan(args);
  // ...
}
```

---

## Step 6 — Implement UI against the runtime only

```js
export default function HeadshotMiniApp({ runtime }) {
  const ctx = runtime.getProjectContext();
  // runtime.listAssets(), runtime.createGeneration(request), ...
}
```

**Do not** import Drizzle, `DATABASE_URL`, or raw `fetch('https://api.muapi.ai')`.

`runtime.createGeneration` starts Dynaxis lifecycle records and should execute through the host-provided MuAPI path.

---

## Step 7 — Register + allowlist the loader

1. Register the manifest in `lib/dynaxis/mini-apps/bootstrap.js`.  
2. Add `entryKey` → dynamic import in `lib/dynaxis/mini-apps/loader.js` `APPROVED_LOADERS`.

Unallowlisted modules **cannot** load. This is intentional.

---

## Step 8 — Validate

- Unit-test manifest + capability  
- Confirm Apps shows the module under **Dynaxis modules** (not catalogue)  
- Confirm outputs land on the active Project as Generation → Job → Asset  
- Confirm a thrown render error does not crash the shell  

---

## Generation request shape

```js
await runtime.createGeneration({
  modelId: '…',
  endpoint: '…',       // optional MuAPI path segment
  prompt: '…',
  parameters: { /* model-specific */ },
  referenceAssets: [
    { assetId: '…', role: 'character_reference' },
    // or { url: 'https://…', role: 'product_reference' }
  ],
  outputType: 'image', // image | video | audio | other
  projectId: null,     // defaults to active project
});
```

---

## Honesty rules

| Kind | How Dynaxis presents it |
|------|-------------------------|
| Integrated Mini App | “Dynaxis modules” / Open module |
| External template | Catalogue + GitHub/Demo links |
| Placeholder | Request access — not installed |
| Superseded template | Hidden when matching integrated module exists (`filterCatalogueTemplates`) |

Never iframe Vercel demos as “installed modules”.

---

## Reference integration — AI Headshot (Phase 5A)

**Canonical example:** `packages/mini-apps/headshot/` · docs: `PHASE_5A_AI_HEADSHOT.md`

## Reference integration — Character Studio (Phase 5B)

**Canonical Character domain:** `docs/dynaxis/CHARACTER_SYSTEM.md`  
**Mini App:** `packages/mini-apps/character-studio/` · docs: `PHASE_5B_CHARACTER_STUDIO.md`

Additional patterns beyond Headshot:

1. Owner-scoped domain entities (Characters) with Project M:N links  
2. Revisions for reproducible provenance  
3. Multi-reference Assets + promote-to-reference workflow  
4. Sync LLM adapter for persona chat (not Jobs)  
5. New Mini App permissions only when required (`characters:read/write`)

## Reference integration — Product Studio (Phase 6A)

**Canonical Product domain:** `docs/dynaxis/PRODUCT_SYSTEM.md`  
**Mini App:** `packages/mini-apps/product-studio/` · docs: `PHASE_6A_PRODUCT_SYSTEM.md`

Additional patterns:

1. Second owner-scoped creative entity (Products) parallel to Characters — not a clone  
2. Multi-reference photography (model maxImages, currently 14 for `nano-banana-2-edit`)  
3. Scene presets as **Generation styling**, not Product mutation  
4. Explicit promote of `generated_product_scene` → `product_reference`  
5. Product Consumer + shared ProductPicker / ProductReferencePicker for future Studios  
6. Permissions `products:read/write`; requiredCapabilities includes `products`
7. Optional Brand link (`brands:read/write`) without making Brand mandatory

## Reference integration — Brand Studio (Phase 6C)

**Canonical Brand domain:** `docs/dynaxis/BRAND_SYSTEM.md`  
**Mini App:** `packages/mini-apps/brand-studio/` · docs: `PHASE_6C_BRAND_SYSTEM.md`

Additional patterns:

1. Brand DNA as typed fields + JSONB collections — not opaque blobs  
2. Immutable Brand revisions for generation provenance  
3. Website analysis only via secured server endpoint — never grant Mini Apps `external:network` for SSRF-sensitive scraping  
4. Manual Brand creation remains first-class when Playwright is unavailable  
5. Brand Consumer + shared BrandPicker for Product / Marketing Studios  
6. Permissions `brands:read/write`; requiredCapabilities includes `brands`

## Reference integration — Campaign Studio (Phase 6D)

**Canonical Campaign domain:** `docs/dynaxis/CAMPAIGN_SYSTEM.md`  
**Mini App:** `packages/mini-apps/campaign-studio/` · docs: `PHASE_6D_CAMPAIGN_SYSTEM.md`

Additional patterns:

1. Project-scoped Campaign with **required** Brand revision pin; optional Product/Character pins  
2. Exactly four Zod-validated concepts; explicit format selection before image spend  
3. Copy-then-image deliverables; service returns `generationRequest` only (no raw MuAPI)  
4. Partial batch success + retry failed deliverables  
5. Campaign Consumer + client-safe goals/formats/copy/references modules  
6. Permissions `campaigns:read/write`; requiredCapabilities includes `campaigns`  
7. Feature flags `noCanvas` / `noPublishing` — do not sneak publishing into the Mini App

## Reference integration — Creative Editor (Phase 6E)

**Canonical Composition domain:** `docs/dynaxis/COMPOSITION_SYSTEM.md`  
**Mini App:** `packages/mini-apps/creative-editor/` · docs: `PHASE_6E_CREATIVE_EDITOR.md`

Additional patterns:

1. Composition is not an Asset — document JSON + revision snapshots  
2. Shared `compositions/layout.js` for client preview and server SVG  
3. Export via Resvg server-only; register PNG as normal Asset with derivations  
4. `documentVersion` optimistic concurrency on draft saves  
5. Campaign Deliverable `final_asset_id` without overwriting `asset_id`  
6. Permissions `compositions:read/write`; `react-rnd` for drag/resize only

## Reference integration — Design Library (Phase 6F)

**Canonical Template domain:** `docs/dynaxis/DESIGN_LIBRARY.md`  
**Mini App:** `packages/mini-apps/design-library/` · docs: `PHASE_6F_DESIGN_LIBRARY.md`

Additional patterns:

1. Templates are not Compositions — immutable revisions + slots compile into Composition Documents  
2. Client-safe `templates/document.js`, `binding.js`, `adapt.js`; server-only `services/templates.js`  
3. Permissions `templates:read/write` mean **Design Templates** (not React/Prompt templates)  
4. Creative Editor authors slots / Save as Template; Design Library lists and instantiates  
5. Adaptation creates new Compositions with warnings — do not claim perfect auto-layout  
6. Do not integrate Design Agent / CreativeCanvas document models in the same phase

## Reference — Design Agent bridge (Phase 6G)

**Canonical:** `docs/dynaxis/DESIGN_AGENT_ARCHITECTURE.md`  
**Studio:** `packages/studio/src/components/DesignAgentStudio.jsx` (Composition controller; PATH B)

1. Composition Document is the only SoT — never persist Konva JSON  
2. Typed Design Operations + atomic batches + documentVersion concurrency  
3. LLM via server provider boundary; no Design Agent localStorage.token auth  
4. Imagery: Generation → Job → Asset → attach op  
5. Handoff to Creative Editor with the same Composition ID  

## Reference — Design Components (Phase 6H)

**Canonical:** `docs/dynaxis/DESIGN_COMPONENTS.md` · `PHASE_6H_DESIGN_COMPONENTS.md`

1. Visual Composition Components ≠ React/npm components  
2. Permissions `components:read/write`; Design Library + Creative Editor consume them  
3. Instances pin exact Component revisions; never silently load latest  
4. Client-safe `components/document.js`, `properties.js`, `resolver.js`; server-only `services/components.js`  
5. Design Agent discovers Components via controlled list — reject hallucinated IDs  

## Reference — Design Systems (Phase 6I)

**Canonical:** `docs/dynaxis/DESIGN_SYSTEMS.md` · `PHASE_6I_DESIGN_SYSTEMS.md`

1. Brand ≠ Design System; seed from Brand is COPY only  
2. Permissions `designSystems:read/write`, `componentSets:read/write`  
3. Client-safe token/variant modules; server-only Design System / Component Set services  
4. Design Agent may bind tokens / switch modes / switch variants — no Design System master write by default  
5. Do not build Auto Layout or React/code components in Mini Apps  

Pattern to copy for future Mini Apps:

1. Inspect upstream → MIGRATE / ADAPT / DISCARD inventory  
2. `manifest.js` + `presets` / domain config  
3. `capability.js` with headless `generateX` + `invokeCapability`  
4. Dynaxis-styled UI only (no SaaS shell)  
5. Register in `bootstrap.js` + allowlist in `loader.js`  
6. Route generation through runtime + `executeMiniAppMuapiGeneration`  
7. Dedupe Apps catalogue if an external template represented the same app  
8. Tests with mocked MuAPI  

Do not call raw MuAPI from the module; do not migrate auth/billing/history.


