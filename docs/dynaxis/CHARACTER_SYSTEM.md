# Dynaxis Character System

**Status:** Phase 5B (canonical)  
**Continuity strategy:** **Reference-based Character Continuity**

This document is the architecture contract for persistent Dynaxis Characters.

---

## What a Character is

A **Character** is a persistent, owner-scoped creative entity.

It is **not**:

| Concept | Why it is different |
|---------|---------------------|
| Asset | Assets are media files/URLs. Characters *reference* Assets. |
| Generation | Generations are one-shot model runs. Characters survive many Generations. |
| Agent | Agent Studio is autonomous tooling. Character chat is persona conversation only. |
| Mini App | Character Studio is one consumer of the Character domain. |

---

## Ownership model

```text
Owner (owner_ref)
  └─ Character Library
       └─ Character
            ├─ Character Revisions (versioned profile snapshots)
            ├─ Character ↔ Assets (identity / style / generated portraits)
            ├─ Character ↔ Projects (many-to-many links, no cloning)
            └─ Conversations → Messages
```

Characters are **not** trapped inside a single Project.  
Projects **link** Characters; they do not own them exclusively.

---

## Reference-based Continuity

Dynaxis does **not** claim proprietary identity training, LoRA, DreamBooth, face embeddings, or Soul-ID in Phase 5B.

Continuity is achieved by:

1. Persistent Character profile (persona, backstory, system prompt, greeting)
2. Multiple reference Assets (`identity_reference`, `portrait_reference`, `style_reference`)
3. Stable Character revisions for reproducible provenance
4. Consistent generation parameters (aspect, resolution, model)
5. Image-guided edit path (`nano-banana-pro-edit`) when references exist

Future identity-training layers may be added later as a separate architecture.

---

## Schema (PostgreSQL / Drizzle)

| Table | Purpose |
|-------|---------|
| `dynaxis_characters` | Character profile |
| `dynaxis_character_revisions` | Immutable profile+asset snapshots |
| `dynaxis_character_assets` | Character ↔ Asset roles |
| `dynaxis_project_characters` | Project ↔ Character links |
| `dynaxis_character_conversations` | Chat threads |
| `dynaxis_character_messages` | Ordered messages |
| `dynaxis_generations.character_id` / `character_revision_id` | Generation provenance |

Migration: `drizzle/0001_dynaxis_characters.sql`

---

## Services & APIs

- Service: `lib/dynaxis/services/characters.js`
- Chat: `lib/dynaxis/services/character-chat.js`
- LLM adapter: `lib/dynaxis/providers/llm.js` (MuAPI `any-llm-models`, sync — not Jobs)
- HTTP: `/api/dynaxis/characters/*`, `/api/dynaxis/character-conversations/*`

Mini App permissions: `characters:read`, `characters:write` (least privilege; not granted by default).

---

## First consumer

**AI Character Studio** Mini App — `dynaxis.character-studio`  
See `PHASE_5B_CHARACTER_STUDIO.md`.

---

## Character Consumer layer (reuse across Studios)

Studios never query Character tables directly. They consume Characters through a
shared, generation-safe abstraction: `lib/dynaxis/characters/`.

| Export | Purpose |
|--------|---------|
| `resolveCharacterContext(client, id, opts)` | Fetch Character (+ optional pinned revision) and build a `CharacterVisualContext`; optionally link Character to the active Project |
| `selectCharacterReferences(assets, opts)` | Deterministic reference selection by role priority, user selection, and model input budget |
| `buildVisualDescription(character, revision)` | Visual-only prompt text (name/description/persona) — **excludes** `systemPrompt`/greeting/chat prompts |
| `buildCharacterVisualContext(...)` | Runtime projection (ids, references, continuity) — not a DB entity |
| `getVideoImageCapability(model, state)` | Whether a video model/mode accepts reference images; drives graceful fallback |
| `resolveLipSyncSourceContext(...)` | Lip Sync image/video/audio source precedence + Character provenance snapshot |
| `publish/read/clearCharacterGenerationContext` | Bridge Character provenance (+ optional generation metadata) to studio `submitAndPoll` lifecycle |

**Continuity is reference-based.** Consumers never mutate Characters; explicit
Character edits (new revisions) happen only in Character Studio. Studio outputs
may be *promoted* back to a Character as new reference Assets on user action.

**Provenance:** every Character-aware generation records `characterId` +
`characterRevisionId` (and reference asset IDs in metadata) on
`dynaxis_generations` via the existing lifecycle — no new tables.

## Consumers

| Studio | Character usage |
|--------|-----------------|
| AI Character Studio (`dynaxis.character-studio`) | Create / edit / chat (authoring) |
| AI Influencer Studio | Reference-guided image edit (`nano-banana-pro-edit`), promote output → Character |
| Video Studio | Character source for I2V / motion-control V2V / Seedance Extend; text-only fallback for T2V-only models |
| Lip Sync Studio | Optional Character portrait (image mode) + explicit Character association (video mode); Project image/video/audio Asset reuse |
| Marketing Studio | Optional Character as presenter/avatar for marketing video (Phase 6B); preset avatars remain non-Character media |
| Campaign Studio | Optional Character revision pins as Campaign participants (Phase 6D) |

See `PHASE_5C_CHARACTER_REUSE.md`, `PHASE_5E_CHARACTER_LIPSYNC.md`, `PHASE_6B_MARKETING_INTEGRATION.md`, and `CAMPAIGN_SYSTEM.md`.
