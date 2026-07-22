# Dynaxis Labs Studios — Integration Roadmap

**Status:** Planning + phase tracking  
**Phase 1–5A:** Complete  
**Phase 5B:** Complete — `PHASE_5B_CHARACTER_STUDIO.md` · `CHARACTER_SYSTEM.md`  
**Phase 5C:** Complete — `PHASE_5C_CHARACTER_REUSE.md`  
**Phase 5D:** Complete — `PHASE_5D_RUNTIME_HARDENING.md` (runtime & server/client boundary hardening; no product features)  
**Phase 5E:** Complete — `PHASE_5E_CHARACTER_LIPSYNC.md`  
**Phase 6A:** Complete — `PHASE_6A_PRODUCT_SYSTEM.md` · `PRODUCT_SYSTEM.md`  
**Phase 6B:** Complete — `PHASE_6B_MARKETING_INTEGRATION.md`  
**Phase 6C:** Complete — `PHASE_6C_BRAND_SYSTEM.md` · `BRAND_SYSTEM.md`  
**Phase 6D:** Complete — `PHASE_6D_CAMPAIGN_SYSTEM.md` · `CAMPAIGN_SYSTEM.md`  
**Phase 6E:** Complete — `PHASE_6E_CREATIVE_EDITOR.md` · `COMPOSITION_SYSTEM.md`  
**Phase 6E.1:** Complete — `PHASE_6E1_EDITOR_PRODUCTION_CLOSURE.md`  
**Phase 6F:** Complete — `PHASE_6F_DESIGN_LIBRARY.md` · `DESIGN_LIBRARY.md`  
**Phase 6G:** Complete — `PHASE_6G_DESIGN_AGENT_BRIDGE.md` · `DESIGN_AGENT_ARCHITECTURE.md`  
**Phase 6H:** Complete — `PHASE_6H_DESIGN_COMPONENTS.md` · `DESIGN_COMPONENTS.md`  
**Phase 6I:** Complete — `PHASE_6I_DESIGN_SYSTEMS.md` · `DESIGN_SYSTEMS.md`  
**Phase 6J+ / 7–8:** Not started — do not begin until explicitly instructed

---

## Phase 1 — Repository audit and architectural baseline

**Goal:** Understand the forked platform precisely; document architecture, risks, licences, branding inventory, and mini-app strategy.

**Deliverables:**

- `docs/dynaxis/REPOSITORY_AUDIT.md`  
- `docs/dynaxis/CURRENT_ARCHITECTURE.md`  
- `docs/dynaxis/TARGET_ARCHITECTURE.md`  
- `docs/dynaxis/MINI_APP_INTEGRATION_ARCHITECTURE.md`  
- `docs/dynaxis/PLATFORM_SERVICES_AUDIT.md`  
- `docs/dynaxis/BRANDING_MIGRATION.md`  
- `docs/dynaxis/LICENSING_AUDIT.md`  
- `docs/dynaxis/INTEGRATION_ROADMAP.md`  

**Exit criteria:** Architecture understood; no speculative rewrites; advanced systems preserved in plan.

---

## Phase 2 — Dynaxis Labs branding and platform shell

**Status:** Complete (2026-07-21)

**Delivered:**

- Dynaxis Labs Studios product identity and shell chrome  
- Feature registry + Create/Build/Apps/Connect navigation  
- `lib/dynaxis/` product config, session helper, platform contracts  
- Legacy Higgsfield banner removed  
- Safe branding pass (web + Electron display names)  
- Apps catalogue honesty (not presented as installed modules)  
- MCP/CLI added to web shell Connect section  

**Deferred packaging items:** `appId`, npm package name, deb command name, local-AI data dirs — see `PHASE_2_IMPLEMENTATION.md`  

**Out of scope (unchanged):** Mini-app integrations, platform DB, Dynaxis OS  

---

## Phase 3 — Shared platform services

**Status:** Complete (2026-07-21)

**Delivered:**

- PostgreSQL + Drizzle platform data layer  
- Projects (incl. Default Project)  
- Unified Asset metadata catalogue  
- Generation History (`dynaxis_generations`) with hg_* import/compat  
- Jobs / lifecycle façade wrapping studio `submitAndPoll`  
- MuAPIProvider adapter  
- `/api/dynaxis/*` APIs + project context in shell  

**Explicitly deferred:** Identity/IdP, workspaces, billing/credits ledger, object storage, Workflow/Agent/Design Agent lifecycle adoption, mini-apps  

**Detail:** `PHASE_3_PLATFORM_FOUNDATION.md`

---

## Phase 4 — Mini App module framework

**Status:** Complete (2026-07-21)

**Delivered:**

- Typed Mini App manifest (Zod)  
- Mini App registry + lifecycle statuses  
- Allowlisted lazy loading  
- Permissioned Mini App runtime (Projects/Assets/Generations/Jobs)  
- Error boundary + MiniAppHost  
- Internal example template (`packages/mini-apps/example`, experimental)  
- Apps UI honesty: catalogue vs integrated modules  
- Developer guide + migration strategy  

**Detail:** `PHASE_4_MINI_APP_FRAMEWORK.md`, `MINI_APP_DEVELOPER_GUIDE.md`

**Explicitly deferred:** SamurAIGPT mass import, marketplace, remote plugins, Skills, Supercomputer  

---

## Phase 5 — First mini-app integrations

### Phase 5A — AI Headshot (complete)

**Status:** Complete (2026-07-21)

**Delivered:**

- Production Mini App `dynaxis.headshot` under `packages/mini-apps/headshot/`  
- Domain capability `generateHeadshot` separate from UI  
- Dynaxis Project / Asset / Generation / Job lifecycle (no standalone auth/billing/history)  
- Apps “Dynaxis modules” card + catalogue dedupe for external Headshot template  
- Framework gaps closed: `portrait_reference`, Mini App MuAPI executor, multi-output URL collection  
- Docs: `PHASE_5A_AI_HEADSHOT.md`

**Explicitly deferred:** Character entity, other SamurAIGPT apps, Skills/Agents callers, object storage

### Phase 5B — Character System + Character Studio (complete)

**Status:** Complete (2026-07-21)

**Delivered:**

- Persistent Character domain (`dynaxis_characters`, revisions, assets, project links, conversations)
- Reference-based continuity (no identity training)
- Character Studio Mini App `dynaxis.character-studio`
- LLM adapter for persona chat
- Catalogue dedupe for external Character Studio card
- Docs: `PHASE_5B_CHARACTER_STUDIO.md`, `CHARACTER_SYSTEM.md`

**Explicitly deferred:** LoRA/embeddings, Character video pipelines, Skills/Agents callers, Supercomputer, Dynaxis OS

### Phase 5C — Character reuse across Studios (complete)

**Status:** Complete (2026-07-21)

**Delivered:**

- Shared Character Consumer contract (`lib/dynaxis/characters/`): `resolveCharacterContext`, deterministic `selectCharacterReferences`, `buildVisualDescription`, `CharacterVisualContext` projection
- Video model capability checks (`getVideoImageCapability`) — no false continuity claims
- Shared UI: `CharacterPicker`, `CharacterReferencePicker`
- AI Influencer Studio: optional Character selection, reference-guided edits (`nano-banana-pro-edit`), promote-output-to-Character, provenance
- Video Studio: optional Character source for I2V / motion-control V2V / Seedance Extend; graceful text-only fallback for T2V-only models
- Generation provenance (`characterId`, `characterRevisionId`, reference assets) via existing Dynaxis lifecycle
- Tests: `tests/dynaxis-character-reuse.test.mjs`
- Docs: `PHASE_5C_CHARACTER_REUSE.md`

**Explicitly deferred:** Lip Sync, Voice identity, Character↔Agent merge, identity training (LoRA/embeddings), universal (non-reference) video continuity.

### Phase 5D — Runtime stability & server/client boundary (complete)

**Status:** Complete (2026-07-21) — see `PHASE_5D_RUNTIME_HARDENING.md`

### Phase 5E — Character-aware Lip Sync (complete)

**Status:** Complete (2026-07-22)

**Delivered:**

- Optional Character selection in existing Lip Sync Studio (UI preserved)
- Character portrait references for image Lip Sync (`identity_reference` / `portrait_reference` / `generated_portrait`)
- Project Asset reuse for image / video / audio via shared `AssetInputPicker`
- Explicit source precedence (upload > Asset > Character reference)
- `resolveLipSyncSourceContext` + model capability helpers
- Character revision + input Asset provenance via existing lifecycle metadata
- Lip Sync outputs remain normal Dynaxis video Assets (no auto Character promotion)
- Tests: `tests/dynaxis-lipsync.test.mjs`
- Docs: `PHASE_5E_CHARACTER_LIPSYNC.md`

**Explicitly deferred:** Voice Identity, Performance entity, voice cloning, automatic identity inference.

### Phase 5F+ (not started)

Suggested next candidates (subject to product priority + licence review):

- Voice Identity domain (if product requires persistent speakers)  
- Nano Banana template UX (if not already covered by Image Studio)  
- AI Clipping (align with existing Clipping Studio — avoid duplicate products)  
- Performance / Scene entity only when Cinema multi-step pipelines require it

Each integration must use platform SDK services and drop duplicate auth/billing.



---

## Phase 6 — Product system + remaining mini-app migration

### Phase 6A — Persistent Product System + Product Studio (complete)

**Delivered:**

- Owner-scoped Product domain (revisions, multi-ref Assets, Project M:N)
- Product Consumer + ProductPicker / ProductReferencePicker
- Integrated Mini App `dynaxis.product-studio` (MIT-adapted from amazon-product-studio)
- Seven scene presets; `nano-banana-2-edit` via Dynaxis lifecycle (max 14 refs)
- Explicit promote-to-reference; scene styling does not mutate Product
- Catalogue dedupe for Amazon Product Studio interest cards
- Docs: `PHASE_6A_PRODUCT_SYSTEM.md` · `PRODUCT_SYSTEM.md`
- Tests: `tests/dynaxis-products.test.mjs`

**Explicitly deferred:** Brand DNA, Open Pomelli, Marketing Product rewrite, Amazon marketplace APIs.

### Phase 6B — Product- and Character-aware Marketing Studio (complete)

**Delivered:**

- Optional Product / Character / Project Asset selection in existing Marketing Studio
- Preserved uploads, avatar presets, format/ratio/res/duration, gallery UI
- `resolveMarketingSourceContext` — precedence, deterministic ordering, combined max-9 image budget
- Product + Character revision provenance via existing lifecycle (`submitAndPoll`)
- Preset-avatar metadata without fabricated Character IDs
- Local draft compatibility; `localHistory` import fix
- Docs: `PHASE_6B_MARKETING_INTEGRATION.md`
- Tests: `tests/dynaxis-marketing.test.mjs`

**Explicitly deferred:** Brand, Campaign, Open Pomelli, publishing.

### Phase 6C — Persistent Brand System + Brand DNA (complete)

- Persistent Brands, revisions, Brand↔Asset / Product / Project links
- Secure website Brand DNA analysis (SSRF-hardened) + manual create/edit
- Mini App `dynaxis.brand-studio`
- Optional Brand consumers in Product Studio + Marketing Studio
- Generation provenance: `brandId` / `brandRevisionId`
- Docs: `PHASE_6C_BRAND_SYSTEM.md`, `BRAND_SYSTEM.md`

**Explicitly deferred (at 6C):** Campaigns, canvas editor, social publishing, Pomelli campaign migration.

### Phase 6D — Campaign System + Multi-Format Creative Sets (complete)

- Persistent Campaigns (project-scoped) with required Brand revision pins
- Optional Product/Character revision links; immutable Campaign revisions
- Exactly four concepts; format registry; copy-then-image deliverables
- Mini App `dynaxis.campaign-studio`
- Generation provenance: `campaignId` / `campaignRevisionId`
- Docs: `PHASE_6D_CAMPAIGN_SYSTEM.md`, `CAMPAIGN_SYSTEM.md`

**Explicitly deferred:** canvas editor, social publishing, calendars, scheduling, video deliverable execution.

### Phase 6E — Non-Destructive Creative Editor (complete)

- Persistent Composition domain + revisions + exports + asset derivations
- Zod Composition Document v1 (text/image layers)
- Mini App `dynaxis.creative-editor` (`react-rnd` + server Resvg PNG export)
- Campaign Deliverable → Edit → Composition → `final_asset_id`
- Docs: `PHASE_6E_CREATIVE_EDITOR.md`, `COMPOSITION_SYSTEM.md`

### Phase 6E.1 — Creative Editor Production Closure (complete)

- Generic Asset Blob Store (memory / filesystem / S3-compatible)
- PNG export no longer persists data URLs in PostgreSQL
- Real Resvg integration test + PNG validation/checksum
- Clean-background wired through host Generation → Job → Asset → apply
- Docs: `PHASE_6E1_EDITOR_PRODUCTION_CLOSURE.md`

**Explicitly deferred in 6E.1:** video editing, collaboration, template marketplace, publishing.

### Phase 6F — Design Library + Templates + Adaptation (complete)

- Persistent Design Templates + immutable revisions (`0006_dynaxis_design_templates`)
- Semantic slots + binding precedence (Brand/Product/Character/Campaign)
- Design Library Mini App (`dynaxis.design-library`)
- Creative Editor: Save as Template, Template mode, Adapt aspect
- Campaign optional Template path (existing no-template path preserved)
- Deterministic multi-aspect adaptation + batch + warnings
- Host executor integration test for Creative Editor Generation path
- Docs: `PHASE_6F_DESIGN_LIBRARY.md`, `DESIGN_LIBRARY.md`

**Explicitly deferred:** Design Agent sync, linked Components, marketplace, Figma/PSD import, external design registries, Skills, Supercomputer.

### Phase 6G — Design Agent → Composition Bridge (complete)

- PATH B: Design Agent Studio is a Composition controller (no Konva document authority)
- Typed Design Operations + atomic batches + optimistic concurrency
- LLM plans via Dynaxis provider boundary; no Design Agent localStorage.token / MuAPI balance auth
- Generation → Asset → attach ops; Templates/adaptation reused
- Colour-only Template thumbnails confirmed working
- Docs: `PHASE_6G_DESIGN_AGENT_BRIDGE.md`, `DESIGN_AGENT_ARCHITECTURE.md`

**Explicitly deferred:** linked Components, marketplace, Skills, Supercomputer, dual-canvas sync.

### Phase 6H — Design Components + Component Library (complete)

- Persistent Design Components + immutable revisions (`0007_dynaxis_design_components`)
- Composition `component_instance` layers with revision pinning + controlled overrides
- Shared resolver for Editor / Agent / Resvg; explicit update + detach
- Design Library Templates | Components; Creative Editor component mode
- Template slot → Component property mapping; Campaign path preserved
- Design Agent Component discovery + typed ops (no master write by default)
- Legacy: removed unused Studio `design-agent` dependency; token mirror retained for unrelated MuAPI surfaces
- Docs: `PHASE_6H_DESIGN_COMPONENTS.md`, `DESIGN_COMPONENTS.md`

**Explicitly deferred:** Auto Layout, nested Components, React/code components, marketplace, Skills, Supercomputer.

### Phase 6I — Design Systems + Tokens + Modes + Component Variants (complete)

- Persistent Design Systems + immutable revisions (Token Document)
- Colour/number/string/boolean tokens, aliases, modes, bindings
- Brand seed (copy); Composition/Template/Component revision pins
- Component Sets with independent sparse variant axes + switch conflicts
- Design Agent token/mode/variant ops via controlled discovery
- Docs: `PHASE_6I_DESIGN_SYSTEMS.md`, `DESIGN_SYSTEMS.md`

**Explicitly deferred:** Auto Layout / responsive constraints → Phase 6J; React/code components; marketplace; Skills; Supercomputer.

### Phase 6J (recommended next — not started)

- Auto Layout / layout stacks / hugging / fill / gap
- Responsive constraint behaviour (distinct from Design System modes)

### Phase 6J+ (later)

- Optional Design Agent conversation persistence (Composition remains SoT)
- Optional richer in-studio Generation UX for Design Agent image intents
- Optional batch “update selected instances” tooling
- Optional publishing adapters / calendar
- Optional mode → variant mapping automation
- Convert remaining viable catalogue apps to modules  
- Keep external-only tools as documented integrations  
- Remove misleading dummy “Demo/GitHub” affordances that open interest modals only  

---

## Phase 7 — Skills system

**Goal:** Bring Generative Media Skills-style capabilities into Dynaxis as a first-class product surface (not only outbound GitHub links).

- Skill packs bound to Dynaxis models/jobs  
- Agent-accessible skill runner  
- Versioning and permissions  

---

## Phase 8 — Agent orchestration / Supercomputer layer

**Goal:** Higher-order orchestration across studios, workflows, agents, and skills.

**Constraint:** Do not prototype Supercomputer concepts inside Phase 2–4 work. Keep this phase explicit and later.

---

## Cross-phase constraints (standing)

- Do not remove Vibe Workflow, Agents, Design Agent, Cinema, local inference, Electron, MCP surfaces, or model integrations to simplify.  
- Do not embed Dynaxis OS into this repository during Studios phases.  
- Do not perform broad dependency upgrades as a substitute for architecture work.  
- Do not ship fake/mock platform services in place of real ones.  
- Preserve the approved Dynaxis Labs Studios UI/UX unless explicitly instructed otherwise.

---

## Dependency between phases

```text
Phase 1 (done)
  → Phase 2 branding/shell (done)
    → Phase 3 platform services (done)
      → Phase 4 module framework (done)
        → Phase 5 first modules
          → Phase 6 remaining modules
            → Phase 7 skills
              → Phase 8 orchestration
```

Skipping Phase 3 before Phase 5 recreates the catalogue/SaaS fragmentation problem.

