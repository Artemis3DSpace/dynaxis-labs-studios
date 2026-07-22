# Phase 5C — Character Reuse Across Dynaxis Studios

**Status:** Complete (2026-07-21)  
**Canonical Character docs:** `CHARACTER_SYSTEM.md`  
**Builds on:** Phase 5B (`PHASE_5B_CHARACTER_STUDIO.md`)

---

## 1. Goal & scope

Make the persistent **Dynaxis Character** system (Phase 5B) reusable by existing
first-class Studios — **AI Influencer Studio** and **Video Studio** — without
losing identity, references, or provenance, and without redesigning the approved
Studio UI/UX.

**In scope**

- Shared Character Consumer contract usable by any Studio
- Deterministic reference selection within each model's input budget
- Character integration in AI Influencer Studio (image) and Video Studio (video)
- Generation provenance (`characterId` + `characterRevisionId`)
- Minimal shared selection UI

**Explicitly NOT in scope (non-goals)**

- No new external Mini App; no `SamurAIGPT/AI-Influencer-Generator` integration
- No replacement of existing Studio interfaces
- No Supercomputer / Skills / Dynaxis OS / additional Mini Apps
- No Lip Sync integration, no Voice identity
- No Character↔Agent merge
- No identity training (LoRA/embeddings); no universal (non-reference) video continuity

---

## 2. Design principles

1. **Persistent identity, per-generation styling.** A Character is durable
   identity + references + provenance. Studio controls (pose, lighting, style,
   aspect, duration) are *per-generation styling* and never edit the Character.
2. **Reference-based continuity.** Identity travels as reference Assets +
   a visual description — not model training. We never claim universal video
   continuity beyond what references provide.
3. **No direct DB access.** Studios consume Characters only through the Character
   Service/API via a shared consumer layer.
4. **Explicit edits only.** New Character revisions are created solely in
   Character Studio (authoring) or by explicit user promotion — never as a side
   effect of a Studio generation.
5. **Provenance always.** Every Character-aware generation resolves and records a
   specific revision.

---

## 3. Character Consumer layer

New module: `lib/dynaxis/characters/` (client-safe, re-exported from
`lib/dynaxis/index.js`).

### 3.1 `consumer.js`

| Export | Responsibility |
|--------|----------------|
| `resolveCharacterContext(client, characterId, opts)` | Fetch Character + assets, optionally pin a revision, select references, optionally link to active Project, return `{ character, revision, visual, provenance }` |
| `selectCharacterReferences(assets, opts)` | Deterministic selection: honours explicit `selectedAssetIds`, else ranks by `IDENTITY_ROLE_PRIORITY` + primary + sort order; clamps to `maxImages` |
| `normaliseCharacterAssetLinks(links)` | Flatten API link rows → `{assetId,url,role,isPrimary,sortOrder,type}`, image-only, primary-first |
| `buildVisualDescription(character, revision)` | Visual-only prompt text (name, description, persona). **Excludes** `systemPrompt`/greeting/backstory — chat prompts never leak into visual gen |
| `buildCharacterVisualContext(...)` | Runtime `CharacterVisualContext` projection (ids, references, continuity) — not a DB entity |
| `publishCharacterGenerationContext(ctx)` | Write `characterId` / `characterRevisionId` / `referenceAssetIds` to `window` for studio `submitAndPoll` |
| `readCharacterGenerationContext()` / `clearCharacterGenerationContext()` | Read / clear the window bridge |

`CharacterVisualContext` (runtime shape):

```text
{ characterId, characterRevisionId, name, category, visualDescription,
  primaryAssetId, references[], referenceUrls[], referenceAssetIds[],
  allAssets[], continuity: 'reference-based', pinnedRevision }
```

### 3.2 `video-capabilities.js`

`getVideoImageCapability(model, { imageMode, v2vMode })` → whether the active
video model/mode accepts reference images (`supportsImageReference`, `maxImages`,
`imageField`, `usesList`, `mode`, `unsupportedReason`). Drives graceful fallback
so we never promise continuity a model cannot deliver.

### 3.3 Shared UI

- `packages/studio/src/components/character/CharacterPicker.jsx` — optional
  Character selector; resolves context and links to the active Project on select.
- `packages/studio/src/components/character/CharacterReferencePicker.jsx` —
  choose which reference Assets feed a generation (bounded by `maxImages`).

---

## 4. AI Influencer Studio integration

- Optional `CharacterPicker` + `CharacterReferencePicker` in the builder header;
  all existing influencer controls preserved. Character usage is **never forced**.
- Prompt assembly prepends the Character `visualDescription` (visual-only).
- When references exist and a Character is selected → `generateI2I` with
  `nano-banana-pro-edit` (`images_list`, ≤5). Otherwise the existing
  `generateImage` / `INFLUENCER_MODEL` path is unchanged.
- **Promote to Character:** a user action registers the generated image as an
  Asset and promotes it as an `identity_reference` on the Character (strengthens
  future continuity). This is the only path that changes a Character, and only on
  explicit user action.
- Provenance (`characterId`, `characterRevisionId`, reference asset IDs) is
  published before generation via the window bridge.

Config vs identity: influencer trait controls are per-generation styling; they do
**not** create Character revisions.

---

## 5. Video Studio integration

- Optional `CharacterPicker` + `CharacterReferencePicker` above the prompt; normal
  T2V is unchanged when no Character is selected.
- `getVideoImageCapability` determines how the Character is applied for the active
  model/mode:
  - **I2V** — Character reference becomes the start-frame/reference image when the
    user hasn't uploaded one (generated Character portraits are valid sources).
  - **Motion-control V2V** — Character reference supplies the required image.
  - **Seedance Extend** — Character references map into `images_list`.
  - **T2V-only models** — no image support: a clear notice is shown and the
    Character's visual description still guides the text-driven generation.
- Uploaded images always take priority over Character references.
- Provenance is published through the same lifecycle; video outputs remain normal
  Dynaxis Assets.

---

## 6. Provenance (end-to-end)

`packages/studio/src/muapi.js` (`readDynaxisContext` + `submitAndPoll`) forwards
Character IDs to `/api/dynaxis/lifecycle/start`, which persists them on
`dynaxis_generations` (`character_id`, `character_revision_id`) plus
`referenceAssetIds` in metadata. No new tables; existing
Generation/Job/Asset + MuAPI adapter infrastructure is reused unchanged.

---

## 7. Safety & edge cases

- **Revision changes while a Studio is open:** each generation re-resolves from
  the resolved context; the window bridge is cleared on Studio unmount so
  unrelated generations are never mis-attributed.
- **Owner-level Character → active Project:** selecting a Character links it to
  the current Project (non-fatal if linking fails).
- **Model input limits:** references are always clamped to `maxImages`.
- **No chat leakage:** only visual fields feed image/video prompts.

---

## 8. Tests

`tests/dynaxis-character-reuse.test.mjs` (19 tests, all mocked — no MuAPI/LLM
credits):

- reference normalisation, deterministic selection, budget clamping, user override
- visual description excludes chat/system prompts
- `resolveCharacterContext`: provenance, revision pinning, project linking, error paths
- video capability matrix (null / T2V / single-I2V / multi-I2V / Extend)
- provenance publish / read / clear via a mocked `window`

Regression: full `test:dynaxis` suite (73 tests) passes.

---

## 9. Future (deferred)

Lip Sync (consume Character references), Voice identity, identity training
layers, and richer Character Library UX remain future phases. Character and Agent
concepts remain separate.
