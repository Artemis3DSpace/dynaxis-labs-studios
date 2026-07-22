# Phase 5B — Persistent Character System + AI Character Studio

**Status:** Complete (2026-07-21)  
**Mini App ID:** `dynaxis.character-studio`  
**Canonical Character docs:** `CHARACTER_SYSTEM.md`  
**Upstream:** [SamurAIGPT/ai-character-studio](https://github.com/SamurAIGPT/ai-character-studio) (MIT)

---

## 1. Source repository inspection

Inspected clone: `_inspect/ai-character-studio`.

**Critical finding:** README markets Character.ai-style creation; shipped code is largely a **generic MuAPI image SaaS template** (`common-saas-template`) with:

- Active path: `ImageTemplate` + `nano-banana-pro` / `nano-banana-pro-edit`
- `images_list` (max 5), aspect ratios, resolutions `1k|2k|4k`
- Prisma `Creation` fields `name`, `greeting`, `systemPrompt`, `category` — **never written by app code**
- Orphaned `/api/chat` (Gemini via `any-llm-models`) — **no UI callers**
- Full NextAuth / Stripe / credits / pricing shell

Dynaxis therefore **builds** the Character domain natively while **adapting** verified MuAPI visual + LLM endpoints.

---

## 2. MIGRATE / ADAPT / DISCARD

### MIGRATE

| Item | Destination |
|------|-------------|
| nano-banana-pro / nano-banana-pro-edit endpoints | `presets.js` + capability |
| Aspect ratio enum | `presets.js` |
| Resolution 1k/2k/4k | `presets.js` |
| Multi-reference images (≤5) | capability + UI |
| Visual system prompt prefix | `CHARACTER_VISUAL_SYSTEM_PREFIX` |
| LLM shape (`any-llm-models`, gemini-2.5-flash) | `providers/llm.js` |
| MIT attribution | Manifest + docs |

### ADAPT

| Standalone | Dynaxis |
|------------|---------|
| Prisma Creation “character” stubs | `dynaxis_characters` + revisions |
| Upload / CDN URLs | Dynaxis Assets + character_assets |
| Direct MuAPI poll | Mini App runtime → lifecycle → `executeMuapiPrediction` |
| Direct chat route | Character chat service → LLM adapter |
| AppInstance / project-less history | Owner Character Library + Project links |
| Credentials | Dynaxis Settings MuAPI key |

### DISCARD

NextAuth, Google OAuth, Stripe, credit packs, pricing UI, standalone Navbar/Footer, AppInstance export, Prisma User/credits schema, webhook-primary product flow, duplicate MuAPI key handling.

---

## 3. Character domain architecture

See `CHARACTER_SYSTEM.md`.

```text
Owner → Character Library → Character → Revisions
                         ↘ Character ↔ Assets
                         ↘ Character ↔ Projects (M:N)
Character → Generation (characterId + characterRevisionId) → Job → Assets
Character → Conversation → Messages → LLM adapter
```

---

## 4–7. Schema, Assets, Projects, Revisions

Implemented in `drizzle/0001_dynaxis_characters.sql` + Drizzle `schema.js`.

- Characters: owner-scoped profile fields (name, description, backstory, persona, system_prompt, greeting, category, status, config, metadata)
- `dynaxis_character_assets`: roles include `identity_reference`, `generated_portrait`, plus existing semantic roles
- `dynaxis_project_characters`: link without cloning
- Revisions: snapshot profile + asset refs; Generations pin `character_revision_id`

---

## 8. Continuity strategy

**Reference-based Character Continuity** — documented honestly.  
No LoRA / embeddings / fine-tuning in this phase.

---

## 9–11. Manifest, permissions, capability layer

**Manifest:** `packages/mini-apps/character-studio/manifest.js`

**Permissions:** project:read, assets:read/write, generation:create/read, jobs:create/read, models:use, **characters:read/write**. No `external:network`.

**Headless capabilities:** `createCharacter`, `updateCharacter`, `generateCharacterPortrait`, `refineCharacterPortrait`, `chatWithCharacter`, `promoteReference` via `invokeCapability`.

---

## 12–16. Visual generation, MuAPI, provenance, promotion

- T2I: `nano-banana-pro`; with refs: `nano-banana-pro-edit` + `images_list`
- Lifecycle + Jobs via Mini App runtime
- Outputs → Dynaxis Assets → linked as `generated_portrait`
- Promote workflow marks Asset as `identity_reference` (no image duplication)

---

## 17–18. Conversations + LLM adapter

- Tables: conversations + messages
- Sync MuAPI `any-llm-models` via `lib/dynaxis/providers/llm.js`
- System prompt from Character revision; greeting seeded on conversation start
- Distinct from Agent Studio (no tools / autonomy)

---

## 19–20. Apps UI + UX

- Integrated under Dynaxis modules
- Catalogue card “AI Character Studio” suppressed via `filterCatalogueTemplates`
- Dynaxis surfaces only — no SaaS shell

---

## 21. Security

- All Character/conversation APIs require owner_ref match
- Asset links require owned Assets
- LLM/provider errors sanitized; no secrets in client
- Character permissions not auto-granted to other Mini Apps

---

## 22–23. Tests & builds

- `tests/dynaxis-characters.test.mjs` — continuity, multi-project, revisions, chat, permissions, catalogue dedupe
- Full `npm run test:dynaxis` suite

---

## 24. Framework changes required

| Change | Why |
|--------|-----|
| `characters:read/write` permissions | Character Studio access control |
| Semantic roles `identity_reference`, `generated_portrait` | Character asset semantics |
| Generation `characterId` / `characterRevisionId` | Provenance |
| Runtime Character + chat methods | Mini App SDK surface |
| LLM provider adapter | Sync chat ≠ image Jobs |
| Catalogue dedupe for Character Studio | Avoid duplicate Apps cards |
| Manifest capability `characters` | Availability contract |

Headshot remains unchanged as a separate domain.

---

## 25. Remaining risks

- Character chat LLM quality depends on MuAPI `any-llm-models` availability
- Upstream source lacked a real Character workflow — Dynaxis domain is new surface area
- Cross-project Asset visibility still project-scoped for media rows (Character links Assets by id; Assets remain in originating Project)
- No video continuity yet (intentionally deferred)

---

## 26. Recommended next phase

**Phase 5C / 6 candidates (do not start until instructed):**

1. Cross-studio Character picker (Image / Video / Influencer reuse)
2. Character → image-to-video continuity (still reference-based)
3. Optional richer Character Library shell UI (backend already exists)
4. Next Mini App migration only after Character reuse patterns stabilize
