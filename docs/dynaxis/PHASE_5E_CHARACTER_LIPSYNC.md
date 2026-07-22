# Phase 5E — Character-Aware Lip Sync & Performance Pipeline

**Status:** Complete (2026-07-22)  
**Builds on:** Phase 5C Character reuse · Phase 5D client/server hardening  
**Canonical Character docs:** `CHARACTER_SYSTEM.md`

This phase extends the **existing** Dynaxis Lip Sync Studio so persistent Characters
and Project Assets can participate in Lip Sync. It does **not** replace Lip Sync
Studio, create a Voice Identity system, invent a Performance entity, or introduce
another Lip Sync execution path.

---

## 1. Existing Lip Sync Studio audit

**Component:** `packages/studio/src/components/LipSyncStudio.jsx`  
**Executor:** `processLipSync` → `submitAndPoll` in `packages/studio/src/muapi.js`  
**Models:** `lipsyncModels` in `packages/studio/src/models.js`

### Pre-5E behaviour (confirmed)

| Area | Behaviour |
|------|-----------|
| Image mode | Portrait upload + audio → talking video |
| Video mode | Source video upload + audio → lipsync video |
| Uploads | MuAPI `upload_file` via `uploadFile` (image ≤10MB, video ≤50MB, audio ≤10MB) |
| History | Local `hg_lipsync_studio_persistent` + optional `historyItems` prop |
| Lifecycle | Already wrapped by Phase 3 `submitAndPoll` (Generation → Job → Asset) when shell sets project/feature context |
| Character | **None** |
| Project Assets | **None** — re-upload only |
| Provenance | No Character / input Asset IDs |

### Gaps addressed by Phase 5E

1. Optional Character selection + portrait reference for image mode  
2. Project image / video / audio Asset reuse  
3. Explicit Character association in video mode  
4. Character revision + input Asset provenance on Generations  
5. Clear source precedence (no competing silent sources)

---

## 2. Lip Sync model capability audit

| Model | Category | Prompt | Resolution | Seed |
|-------|----------|--------|------------|------|
| `infinitetalk-image-to-video` | image | yes | 480p/720p | no |
| `wan2.2-speech-to-video` | image | yes | 480p/720p | no |
| `ltx-2.3-lipsync` | image | yes | 480p/720p/1080p | yes |
| `ltx-2-19b-lipsync` | image | yes | 480p/720p/1080p | no |
| `sync-lipsync` | video | no | — | no |
| `latent-sync` | video | no | — | no |
| `creatify-lipsync` | video | no | — | no |
| `veed-lipsync` | video | no | — | no |
| `infinitetalk-video-to-video` | video | yes | 480p/720p | no |

Helper: `getLipSyncModelCapability(model)` in `lib/dynaxis/characters/lipsync-source.js`.  
No fabricated “universal Character Lip Sync” claims — continuity is reference-based only.

---

## 3. Architecture additions

### Source context (pure / client-safe)

`lib/dynaxis/characters/lipsync-source.js`

- `resolveLipSyncSourceContext(...)` — generation-safe snapshot  
- `resolveImageSource` / `resolveVideoSource` / `resolveAudioSource`  
- `selectLipSyncPortraitReference` — identity/portrait/generated roles  
- `buildLipSyncRequestParams` — MuAPI payload from context  
- Exports re-exported from `lib/dynaxis/characters/index.js` (client barrel)

### Shared Asset picker

`packages/studio/src/components/assets/AssetInputPicker.jsx`

- Filters Project Assets by `image` | `video` | `audio`  
- Returns Asset identity (`id`, `url`, …) via `createPlatformClient().listAssets`  
- Minimal UI matching CharacterPicker patterns — not a new Asset Library redesign

### Reused Character UI

- `CharacterPicker`  
- `CharacterReferencePicker` (image-mode portrait choice)

---

## 4. Source precedence (explicit)

### IMAGE mode

1. **Uploaded image** (wins)  
2. **Project image Asset**  
3. **Character reference** (`identity_reference` / `portrait_reference` / `generated_portrait`)

### VIDEO mode

1. **Uploaded video**  
2. **Project video Asset**

Character may still be **explicitly associated** for provenance without being the video file source.

### AUDIO (always)

1. **Uploaded audio**  
2. **Project audio Asset**

**Audio is an Asset — never a Voice Identity.** No voice cloning, embeddings, or `dynaxis_voices`.

Selecting a Project Asset or Character reference clears competing upload state for that slot so the active source stays unambiguous. Uploads clear competing Assets.

---

## 5. Character integration

- Optional — normal Lip Sync without Character remains fully functional.  
- Resolves Character + revision via shared `resolveCharacterContext` (CharacterPicker).  
- Image mode: selected portrait reference can be the image input.  
- Video mode: explicit Character selection records provenance on the **new** Generation.  
- Source video Asset metadata may carry prior Character IDs — used only when explicit; never face recognition.  
- Explicit Character selection overrides inherited video-Asset metadata.  
- Does **not** mutate Characters or rewrite historical Asset provenance.  
- Does **not** auto-promote Lip Sync outputs as Character identity references.  
- Project link behaviour reused from Phase 5C.

### Prompt policy

Only for models with `hasPrompt`. User prompt + optional **visual** Character description (`buildVisualDescription`). Never persona / systemPrompt / greeting / chat prompts.

---

## 6. Generation lifecycle & provenance

Flow (unchanged executor, extended context):

```text
Lip Sync Studio
  → resolveLipSyncSourceContext
  → publishCharacterGenerationContext (+ generationMetadata)
  → processLipSync → submitAndPoll
  → lifecycle.start (characterId, characterRevisionId, metadata)
  → MuAPI
  → lifecycle.complete → video Asset in active Project
```

Generation metadata (where applicable):

- `characterId` / `characterRevisionId` (first-class columns)  
- `referenceAssetIds` / `characterReferenceAssetId`  
- `sourceImageAssetId` / `sourceVideoAssetId` / `audioAssetId`  
- `sourceImageKind` / `sourceVideoKind` / `audioKind`  
- `continuity: 'reference-based'`  
- `featureId: 'lipsync-studio'`

No LipSyncJob, LipSyncResult, or Performance table.

Window bridge extended: `__dynaxisGenerationMetadata` (cleared with Character context).

---

## 7. History

- Lifecycle remains authoritative for Dynaxis Generation History / Assets.  
- Local gallery (`hg_lipsync_studio_persistent`) still feeds the existing UI when `historyItems` is not provided — compatibility preserved.  
- History entries now include Character IDs and Dynaxis generation/job IDs when available.  
- Gallery/result UX layout unchanged.

---

## 8. Client/server boundary (Phase 5D preserved)

New client code imports only:

- `lib/dynaxis/characters/consumer.js`  
- `lib/dynaxis/characters/lipsync-source.js`  
- `lib/dynaxis/client/platform-api.js`  
- `lib/dynaxis/client/project-context.js`

Boundary tests extended for LipSyncStudio + AssetInputPicker + lipsync-source graph.

---

## 9. Limitations / non-goals (honored)

- No Voice Identity / cloning / ElevenLabs personas  
- No Performance / Scene / Shot domain  
- No new Lip Sync Mini App or external lip-sync app import  
- No automatic Character identity from video appearance  
- No automatic promotion of Lip Sync videos as Character references  
- UI/UX locked — additive controls only

---

## 10. Tests

`tests/dynaxis-lipsync.test.mjs` — source precedence, Character portrait selection, video provenance inheritance/override, prompt safety, request params, metadata bridge.  
`tests/dynaxis-boundary.test.mjs` — extended for Lip Sync client paths.

---

## 11. Creative flows enabled

```text
Character Library → Character → Revision → portrait Asset
  → Lip Sync Studio + Audio Asset → Generation → Job → video Asset

Character → Video Studio → Character video Asset
  → Lip Sync Studio + Audio Asset → lip-synced video Asset
```

This is the start of a reusable Character performance pipeline using existing
Character / Asset / Generation / Job primitives only.
