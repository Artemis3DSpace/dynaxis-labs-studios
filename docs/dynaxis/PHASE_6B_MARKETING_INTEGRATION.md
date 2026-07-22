# Phase 6B — Product- and Character-aware Marketing Studio

**Status:** Complete  
**Date:** 2026-07-22  
**Studio:** `packages/studio/src/components/MarketingStudio.jsx` (not a Mini App)

---

## 1. Existing Marketing Studio audit

### Behaviour before Phase 6B

| Concern | Behaviour |
|---------|-----------|
| Product input | Single uploaded URL (`productImage`) |
| Avatar input | Upload URL **or** predefined CDN avatar preset |
| Additional refs | Up to 6 uploaded URLs |
| Format | UGC video presets (`video_files`) |
| Script | Free-text `prompt` |
| Ratio / res / duration | Local `params` |
| Persistence | `hg_marketing_studio_persistent` (draft + `localHistory`) |
| Generation | `generateMarketingStudioAd` → `submitAndPoll` → Seedance VIP omni-reference |
| Lifecycle | Already via `submitAndPoll`, but Product/Character IDs were always null |
| History | Local gallery cards only; Dynaxis Generation existed without studio provenance |

### Confirmed gaps (addressed)

- No Product / Character / Project Asset pickers
- No combined image-budget validation against model truth (**9** images)
- No deterministic slot ordering beyond incidental array concat
- No Product/Character revision provenance on Generations
- `collectLocalHistoryEntries` missed `localHistory` key (fixed)

---

## 2. Model / input audit

| Field | Value |
|-------|--------|
| Endpoints | `seedance-2-vip-omni-reference` (720p), `sd-2-vip-omni-reference-1080p` (1080p) |
| Max images | **9** (`@image1`…`@image9`) — verified against MuAPI / Seedance omni docs |
| Max additional (UI) | 6 (legacy soft-cap, still enforced) |
| Video refs | Format preset URL in `video_files` (unchanged) |
| Resolution | Selects endpoint only; not sent as body field (unchanged) |

---

## 3–6. Product / Character / Asset integration

- **Optional** `ProductPicker` + `ProductReferencePicker`
- **Optional** `CharacterPicker` + `CharacterReferencePicker`
- **Optional** `AssetInputPicker` for product, avatar, and extra references
- Manual uploads and avatar presets **preserved**
- Collapsible “Library” strip — layout/gallery/controls unchanged

Project linking uses existing Product/Character consumer `linkToProject` behaviour (no clones).

---

## 7–12. Precedence, ordering, limits

### Product image precedence

1. Manual upload  
2. Project image Asset  
3. Persistent Product references  

### Avatar precedence (one identity)

1. Manual upload  
2. Project image Asset  
3. Character reference  
4. Predefined Marketing avatar preset  

Selecting a source clears competing sources for that slot.

### Deterministic image order

1. Primary Product reference  
2. Additional Product references  
3. Character/avatar  
4. Additional creative references  

Deduped by URL (first wins). Slot roles recorded in Generation metadata.

### Combined budget

All categories share `MARKETING_MAX_IMAGES = 9`. Overflow throws `TOO_MANY_REFERENCES`.

---

## 13–15. Provenance

| Source | Recorded |
|--------|----------|
| Product | `productId`, `productRevisionId`, Product reference Asset IDs |
| Character | `characterId`, `characterRevisionId`, Character reference Asset ID |
| Preset avatar | `avatarPreset.{id,name,url}` in metadata — **no fabricated Character ID** |
| Format | `formatId` / `formatName` |
| Ordered inputs | `orderedInputAssetIds`, `imageSlots` |

Published via `publishMarketingGenerationContext` before `generateMarketingStudioAd` so `submitAndPoll` lifecycle receives first-class Product/Character fields.

Marketing styling (script tone, clothing direction, etc.) stays in the user prompt / Generation parameters — **does not** create Product or Character revisions.

---

## 16–19. Lifecycle, Jobs, Assets, History

Flow unchanged architecturally:

`Marketing Studio` → source context → `generateMarketingStudioAd` → `submitAndPoll` → Generation + Job → MuAPI → video Asset → Dynaxis history.

Local draft state (`prompt`, `params`, uploads) remains in `hg_marketing_studio_persistent`. Gallery entries now carry Dynaxis IDs when available. `localHistory` is readable by history import.

No MarketingJob / MarketingResult tables. No provider payload leaks of Dynaxis IDs.

---

## 20–22. Boundaries, security, UI

- Helper: `lib/dynaxis/marketing/source-context.js` (client-safe)
- Exported from `@/lib/dynaxis/client`
- Boundary tests include marketing module
- Ownership enforced by existing Product/Character/Asset APIs
- UI/UX locked: same shell, gallery, format/avatar/ratio/res/duration controls

---

## 23. Tests

`tests/dynaxis-marketing.test.mjs` — precedence, ordering, budget, Product/Character provenance, preset non-fabrication, publish bridge, no Product mutation via upload precedence.

---

## 24. Explicit non-goals

Brand · Campaign · Open Pomelli · publishing · Skills · Supercomputer · Dynaxis OS · converting Marketing to a Mini App.

---

## 25. Recommended Phase 6C

- Optional Brand domain scaffold (Brand → Products) without Brand DNA / Pomelli  
- Optional generic MuAPI webhook → Job completion  
- Optional Marketing history panel reading Dynaxis Generations filtered by `featureId=marketing-studio`  
- Do **not** merge Product Studio into Marketing
