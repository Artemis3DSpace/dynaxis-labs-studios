# Dynaxis Labs Studios - Generation Platform Architecture

**Status:** Planned provider-neutral architecture. Current MuAPI behavior remains supported.  
**Scope:** Creative generation architecture only; no provider kernel implemented in this task.

---

## 1. Boundary

Dynaxis owns Projects, Jobs, Assets, Generations, Characters, Products, Brands, Campaigns, Compositions, and provenance.

Providers execute capabilities. Providers do not own Dynaxis domain entities.

```text
Studio / Mini App / Skill / Agent / Workflow
        |
        v
Generation Gateway
        |
        v
Dynaxis Job Engine
        |
        v
Capability Resolver / Provider Router
        |
        v
Provider Adapter
        |
        v
External Provider
        |
        v
status / webhook / completion event
        |
        v
Dynaxis Job Engine
        |
        v
Asset registration
```

Generation Gateway establishes the canonical Dynaxis Generation and Job request before any external provider execution. The Dynaxis Job Engine owns durable execution; providers are downstream adapters and never precede or own the Dynaxis Job lifecycle.

---

## 2. Implemented Now

- `dynaxis_generations`, `dynaxis_jobs`, `dynaxis_assets`, and generation-assets link table.
- Lifecycle routes: start, provider-id, complete, fail.
- MuAPI provider adapter with submit/retrieve/status/output normalization.
- Studio `submitAndPoll` lifecycle integration.
- Mini App generation executor for integrated modules.
- Asset blob store for rendered Composition exports.
- Domain provenance for Character, Product, Brand, and Campaign generations.
- Local inference support in Electron as an operational desktop capability, not yet a unified provider in the web lifecycle.

---

## 3. Planned Concepts

### Capability Registry

Describes what can be generated independent of provider:

- text-to-image;
- image-to-image;
- text-to-video;
- image-to-video;
- video-to-video;
- lip sync;
- audio;
- background removal;
- concept generation;
- copy generation;
- model-specific constraints and input budgets.

It should be seeded from `packages/studio/src/models.js` but become Dynaxis-managed metadata with versioning, entitlement, cost, and compatibility.

### Generation Gateway

The gateway is the canonical submit/status/cancel interface. It accepts Dynaxis generation requests and resolves:

- active Project;
- domain provenance;
- capability;
- provider and provider model;
- input Assets;
- policy/permission checks;
- cost estimate or credit hold;
- canonical Generation and Job creation before provider dispatch;
- durable handoff to the Dynaxis Job Engine.

### Dynaxis Job Engine

The Job Engine owns durable execution state. It receives a canonical Dynaxis Job, routes it through provider-independent policy, records dispatch attempts, consumes provider status/webhook/completion events, and triggers Asset registration.

The Job Engine must be upstream of provider execution. Provider job ids are metadata on a Dynaxis Job, not the lifecycle authority.

### Provider Registry

Provider metadata includes:

- provider id and display name;
- supported capabilities;
- model mappings;
- credential requirements;
- rate limits and timeout policy;
- webhook support;
- cancellation support;
- output normalization;
- legal/licensing notes.

### Provider Adapters

Adapters translate between Dynaxis requests and provider payloads.

Current adapter:

- MuAPI.

Planned adapters:

- Higgsfield;
- Fal;
- Replicate;
- local inference;
- future provider-specific systems.

Adapters may persist provider job ids and provider metadata, but must not shape canonical Dynaxis Projects, Jobs, Assets, or Characters.

---

## 4. Jobs, Queues, Webhooks, Events

### Implemented now

Jobs are durable metadata records. Execution is still mostly client submit/poll through MuAPI.

### Planned

A server job/event engine should add:

- queue-backed dispatch;
- retries and backoff;
- webhook receivers;
- cancellation;
- fan-out events;
- audit timeline;
- idempotency;
- provider outage policy;
- long-running status streams.

Provider webhooks should update Dynaxis Jobs. They should not call product-specific webhooks per domain.

Server-owned execution depends on identity/permissions and Provider Connections / Secrets. A provider API key must not be treated as the user identity for durable server jobs.

---

## 5. Provider Connections / Secrets

### Implemented now

Users currently supply a MuAPI key through the existing app settings/local storage path. Platform ownership is derived from a hashed key for current rows.

### Planned

Provider Connections are explicit Dynaxis-owned records for credentials and account metadata. A connection belongs to a Dynaxis user or organization and is authorized through Dynaxis permissions.

Future connection types may include:

- MuAPI connection;
- Higgsfield connection;
- Fal connection;
- Replicate connection;
- local/private provider connection.

Provider Connections must be available before server-owned async execution can safely dispatch jobs on behalf of a user or organization.

---

## 6. Assets

### Implemented now

Generated outputs are registered as Dynaxis Assets. Media may remain at MuAPI/CDN URLs or managed blob-store URLs depending on source.

### Planned

The Asset system should add:

- provider-neutral input/output roles;
- retention policy;
- virus/safety scan policy;
- derived asset lineage;
- signed delivery;
- project graph edges;
- repository/deployment artifact support for Build/Engineer.

---

## 7. Character Identity Providers

### Implemented now

Characters are Dynaxis entities with revisions and reference Assets. Continuity is reference-based.

### Planned

Provider identities attach under Character identity profiles:

```text
Character
  -> references
  -> revisions
  -> voice
  -> identityProfiles
       -> dynaxis_reference_identity
       -> higgsfield_soul_id
       -> future_provider_identity
```

Soul ID or any provider-specific identity must not become the canonical Character entity.

---

## 8. Deferred

- Provider kernel implementation.
- Higgsfield SDK.
- Provider Connections / Secrets implementation.
- Queue workers.
- Webhooks.
- Capability Registry database.
- Billing/credit holds.
- First-party model admin.
- Character identity profile tables.
