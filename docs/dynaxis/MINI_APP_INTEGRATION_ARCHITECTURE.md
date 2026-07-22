# Dynaxis Labs Studios — Mini App Integration Architecture

**Status:** Implemented baseline (Phase 4) — see also `PHASE_4_MINI_APP_FRAMEWORK.md`  
**Principle:** One platform + many modules

This document supersedes the Phase 1 proposal where it conflicts with the shipped framework.

---

## 1. Problem statement

`AppsStudio` presents external templates and catalogue placeholders. That catalogue cannot scale by embedding each SamurAIGPT app as an independent Next.js SaaS (duplicate auth, billing, storage).

---

## 2. Integration model (as built)

```text
Dynaxis Shell
  └── Apps
        ├── Catalogue (external / placeholders) — honest, not “installed”
        └── Mini App Registry
              └── Trusted first-party modules
                    └── Mini App Runtime → Projects / Assets / Generations / Jobs → MuAPI
```

A Mini App contributes domain UI/workflow and uses the platform SDK/runtime.

A Mini App must **not** contribute its own user DB, Stripe stack, MuAPI client fork, or asset store.

---

## 3. Manifest (implemented)

Typed Zod schema in `lib/dynaxis/mini-apps/manifest.js`.

Statuses: `integrated` | `available` | `catalogue` | `external` | `disabled` | `experimental`

Registration:

```js
miniAppRegistry.register(manifest);
// loader allowlist entryKey → () => import('…')
```

---

## 4. Platform runtime surface (implemented)

Modules receive `createMiniAppRuntime({ manifest, apiKey, … })` with permission checks.

Capabilities include project context, asset list/register, generation create (lifecycle), job get, and optional `invokeCapability` for headless use.

Modules do not receive raw SQL, Drizzle, or secrets.

---

## 5. Migration process

Documented in `MINI_APP_DEVELOPER_GUIDE.md`:

inspect → discard SaaS duplication → extract capability → connect Dynaxis services → validate.

---

## 6. Explicit non-goals (still)

- Remote marketplace / arbitrary plugins  
- Nested Next.js apps / iframes of Vercel demos  
- Mass import of 70+ repos in one phase  
- Skills / Supercomputer (contracts prepared via `capabilitySummary` + `invokeCapability`)

---

## 7. Relationship to core studios

Image/Video/Cinema/etc. remain Feature Registry studios.  
Workflow / Agent / Design Agent remain top-level features — not Mini Apps.
