# Phase 6E.1 — Creative Editor Production Closure

**Status:** Complete  
**Canonical:** `COMPOSITION_SYSTEM.md`  
**Parent:** `PHASE_6E_CREATIVE_EDITOR.md`

---

## Incomplete Phase 6E items closed

| Gap | Resolution |
|-----|------------|
| PNG export persisted as `data:` URL in PostgreSQL | Asset Blob Store + S3/memory/filesystem adapters |
| Clean-background prepare-only (no UI/host wiring) | Creative Editor button → prepare → `createGeneration` → apply after Asset |
| “Smoke test” used mocked rasterisation | Real `@resvg/resvg-js` integration test added; mocks retained as unit tests |

---

## Previous data-URL path

`exportComposition` → `pngToDataUrl(png)` → `registerAsset({ url: dataUrl })` stored multi-MB base64 in `dynaxis_assets.url`. Removed from the production export path. Legacy data: URLs remain readable for embedding existing fixtures only.

---

## Asset Blob Store

Server-only generic boundary (`lib/dynaxis/storage/`):

| Provider | When | Notes |
|----------|------|-------|
| `memory` | tests (`DYNAXIS_ASSET_STORAGE=memory` / test driver) | Non-production |
| `filesystem` | local dev default | `.dynaxis-blob-store/` |
| `s3` | production | S3-compatible via `@aws-sdk/client-s3` |

Ops: `put`, `get`, `getMetadata`, `delete`. Object keys: `prefix/assets/{owner}/{project}/{uuid}.png` (no path traversal).

Production missing bucket/credentials → `ASSET_STORAGE_UNAVAILABLE` (503). **No silent data-URL fallback.**

---

## Configuration

See `.env.example`:

- `DYNAXIS_ASSET_STORAGE` — `memory` | `filesystem` | `s3`
- `DYNAXIS_S3_BUCKET`, `DYNAXIS_S3_REGION`, `DYNAXIS_S3_ENDPOINT`
- `DYNAXIS_S3_ACCESS_KEY_ID`, `DYNAXIS_S3_SECRET_ACCESS_KEY`
- `DYNAXIS_ASSET_PUBLIC_BASE_URL` — optional CDN base (public objects)
- `DYNAXIS_S3_PREFIX`, `DYNAXIS_S3_FORCE_PATH_STYLE`
- `DYNAXIS_ASSET_FS_ROOT` — filesystem adapter root

Without public base URL, managed objects use `dynaxis-blob://{provider}/{key}` and authenticated delivery at `GET /api/dynaxis/assets/:id/content`.

---

## PNG validation

`validateRenderedPng`: signature, non-empty, max bytes (25 MiB), max pixels, optional canvas dimension match, SHA-256 checksum stored in Asset + Export metadata.

---

## Clean-background lifecycle

1. UI **Clean background** → `prepareCleanBackground`  
2. Host `createGeneration(generationRequest)` (MuAPI via existing executor)  
3. On success + Asset ID → `applyBackground` (only then)  
4. Failure preserves draft; duplicate submissions blocked while active  
5. Previous background Asset retained  

---

## Tests

| Suite | Role |
|-------|------|
| `dynaxis-compositions.test.mjs` | Unit: mocked rasterize + memory blob store |
| `dynaxis-storage-export.test.mjs` | Real Resvg; blob store; S3 mock; clean-bg apply rules |
| `dynaxis-boundary.test.mjs` | Excludes `storage/*` from client graph |

---

## Explicitly not done

Phase 6F publishing/calendar · video · collaboration · templates · Skills · Supercomputer · Dynaxis OS.
