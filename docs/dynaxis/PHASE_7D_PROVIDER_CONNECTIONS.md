# Phase 7D - ProviderConnection Contract And Threat Model

## Status

WP-7D-01 defines the ProviderConnection domain contract and threat model for
Phase 7D. It is specification only.

This document does not implement runtime code, add database migrations, change
provider adapters, edit production APIs, or complete secret storage. Secret
envelope and key-management details belong to WP-7D-02.

## Boundary

Provider Connections are Dynaxis-owned records that bind provider credential
metadata to a Dynaxis user or Workspace.

They are not Dynaxis identity.

Provider credentials, model accounts, provider account metadata, and worker
adapters are never authentication principals or authorization subjects. A MuAPI,
Higgsfield, Fal, Replicate, local inference, storage, model, OAuth, service
account, or webhook credential must never become a Better Auth user, Better
Auth member, Dynaxis Workspace, Dynaxis Project member, AuthContext principal,
or policy actor.

The authority flow is:

```text
Better Auth user/session or supported Dynaxis principal
  -> AuthContext
  -> Dynaxis authorization policy
  -> ProviderConnection operation permission
  -> server-only connection service
  -> secret unwrap boundary
  -> provider adapter invocation
```

The provider flow is deliberately downstream:

```text
Dynaxis Generation or Job
  -> Capability / Provider resolution
  -> authorized ProviderConnection use
  -> server-only credential materialization
  -> Provider Adapter
  -> External Provider
```

Providers execute capabilities. Dynaxis owns Projects, Jobs, Generations,
Assets, provenance, verification gates, policy decisions, and audit history.

## Domain Shape

The canonical domain entity is `ProviderConnection`.

Future persistence should use stable field names close to this contract. WP-7D-03
may choose exact table and column names, but it must preserve the semantics
below.

### Identity And Ownership Fields

- `id`: Dynaxis ProviderConnection identifier. Opaque UUID or equivalent.
- `providerId`: provider registry id, using the Phase 7B provider id vocabulary.
  Examples include `muapi`, `higgsfield`, `fal`, `replicate`, and
  `local-private`.
- `ownerType`: exactly one of `user` or `workspace`.
- `ownerUserId`: Better Auth `auth.user.id` when `ownerType` is `user`.
- `ownerWorkspaceId`: Better Auth `auth.organization.id` when `ownerType` is
  `workspace`.
- `createdByUserId`: Better Auth user that created the connection. Required for
  human-created connections.
- `lastUpdatedByUserId`: Better Auth user that last changed non-secret metadata
  or initiated credential rotation.
- `revokedByUserId`: Better Auth user that revoked the connection, when
  applicable.

Ownership invariants:

- exactly one owner target is active;
- `ownerType: user` requires `ownerUserId` and forbids `ownerWorkspaceId`;
- `ownerType: workspace` requires `ownerWorkspaceId` and forbids
  `ownerUserId`;
- `createdByUserId`, `lastUpdatedByUserId`, and `revokedByUserId` are audit
  actors, not owners;
- provider account ids, emails, usernames, organizations, tenants, workspaces,
  projects, teams, or subscription ids are metadata only and never grant
  Dynaxis authority.

### Credential Fields

- `credentialKind`: credential family. Initial vocabulary:
  - `api_key`
  - `bearer_token`
  - `oauth_access_refresh_token`
  - `oauth_client_secret`
  - `service_account_json`
  - `webhook_secret`
  - `local_runtime_reference`
  - `no_secret_required`
- `secretRef`: server-only reference to the encrypted secret envelope owned by
  WP-7D-02. It is not returned to browsers or provider adapters directly.
- `secretVersion`: monotonic version or opaque version id for rotation and audit.
- `credentialFingerprint`: non-secret digest or suffix for operator
  recognition. It must be irreversible and non-authenticating.
- `expiresAt`: provider credential expiry when known.
- `lastRotatedAt`: time the active secret version became current.
- `rotationRequiredAt`: time after which use must fail with a rotation-required
  error unless an explicit break-glass policy is later defined.

The ProviderConnection record stores only metadata and encrypted-secret
references. Raw credential material must not be stored in ProviderConnection
metadata, logs, API responses, analytics, job payloads, provider registry
descriptors, or audit event properties.

`secretRef` presence is credential-kind specific:

- `api_key`, `bearer_token`, `oauth_access_refresh_token`,
  `oauth_client_secret`, `service_account_json`, and `webhook_secret` require a
  non-null `secretRef` before the connection can become `active`.
- `no_secret_required` requires `secretRef: null`, `secretVersion: null`, and no
  credential fingerprint. It is valid only when the provider registry declares
  that the selected capability can be used without Dynaxis-held credential
  material. Use still requires normal Dynaxis authorization and provider/capability
  eligibility checks; no envelope placeholder is created.
- `local_runtime_reference` defaults to `secretRef: null` and represents an
  opaque reference to a server-allowlisted local/private runtime, not a secret.
  If a local runtime also needs credential material, that credential must be
  modeled with one of the secret-bearing credential kinds and a non-null
  `secretRef`. Local runtime use must validate runtime allowlisting, host
  availability, owner context, and dispatch context before provider execution.

### Display Metadata

Display metadata is intentionally non-authoritative and may be partially
redacted.

- `label`: user/workspace supplied display name.
- `providerDisplayName`: display name from the provider registry snapshot.
- `providerAccountId`: provider account id, tenant id, username, email, or
  equivalent account reference, if the provider safely exposes it.
- `providerAccountLabel`: friendly account or organization label, if available.
- `providerAccountAvatarUrl`: optional provider-hosted avatar URL when safe to
  store and display.
- `providerRegion`: optional provider region or deployment locality.
- `metadataVerifiedAt`: time provider metadata was last verified.
- `metadataSource`: `user_supplied`, `provider_verified`, or `system_inferred`.

Metadata rules:

- provider account metadata is not proof of ownership;
- provider account metadata must not be used as a Dynaxis principal id;
- provider account metadata must be treated as user-visible but privacy-sensitive;
- metadata refresh failure must not expose the underlying credential.

### Status Fields

`status` is the connection lifecycle state. Initial vocabulary:

- `pending_verification`: metadata exists but credential validation has not
  completed.
- `active`: allowed for authorized server-side use.
- `disabled`: retained but unavailable for use.
- `rotation_required`: retained but blocked until rotated.
- `revoked`: intentionally revoked and unavailable for use.
- `provider_error`: provider validation or health failure blocks or degrades use.
- `deleted`: soft-deleted tombstone when audit retention requires it.

Status invariants:

- only `active` connections may be used for provider execution;
- `pending_verification` may be created and read by authorized administrators,
  but cannot be used for jobs;
- `disabled`, `rotation_required`, `revoked`, and `deleted` must fail closed;
- provider outage or quota errors do not automatically revoke the connection;
- revocation is explicit and audited.

### Scope And Capability Fields

- `requestedScopes`: scopes requested during credential creation or OAuth
  consent.
- `grantedScopes`: scopes verified from the provider or accepted from the
  submitted credential.
- `allowedCapabilities`: Dynaxis capability ids this connection may satisfy.
- `allowedProviderModels`: optional provider model ids or model families allowed
  for this connection.
- `defaultForWorkspace`: optional boolean for workspace-level routing.
- `defaultForUser`: optional boolean for user-owned routing.

Scope rules:

- Dynaxis scopes are not provider scopes. The contract must record both when
  both exist.
- Provider scopes never grant Dynaxis permissions.
- A connection may be eligible for a capability only when the provider registry,
  connection status, granted scopes, and Dynaxis authorization all agree.
- Model-account access remains provider metadata and never becomes identity.

### Audit Fields

- `createdAt`
- `updatedAt`
- `lastUsedAt`
- `lastUseJobId`
- `lastUseGenerationId`
- `lastHealthCheckedAt`
- `lastHealthStatus`
- `revokedAt`
- `deletedAt`
- `auditCorrelationId`

Audit events must be append-only and should record:

- connection creation;
- verification success or failure;
- metadata update;
- status change;
- authorized use attempt;
- denied use attempt;
- secret rotation start and completion;
- revocation;
- deletion or tombstoning;
- provider metadata refresh.

Audit events must include Dynaxis actor, Workspace context where applicable,
operation, outcome, reason code, provider id, connection id, and correlation id.
They must not include raw secret values, provider bearer tokens, refresh tokens,
authorization codes, webhook signing secrets, full API keys, or decrypted
payloads.

## Permission Boundary

ProviderConnection permissions are a Phase 7D domain vocabulary. WP-7D-04 should
wire them into the canonical authorization evaluator after WP-7D-03 persistence
exists.

| Permission | Subject | Resource | Required Context | Roles | Default Deny |
| --- | --- | --- | --- | --- | --- |
| `provider_connection.create` | `human` | connection create input | User or Workspace | user self for user-owned; Workspace owner/admin for workspace-owned | non-human actor, missing Workspace membership, insufficient role, unsupported provider, disallowed credential kind |
| `provider_connection.read` | `human` | connection metadata | User or Workspace | owning user; Workspace owner/admin/member/viewer for workspace-owned metadata | no ownership, no Workspace membership, deleted tombstone without audit permission |
| `provider_connection.use` | `human`, explicit future `service` | active connection | Workspace and Project when used for a Project Job; User or Workspace for direct validation | Project owner/admin/editor for Project-scoped generation/job use; Workspace owner/admin/member for workspace validation; owning user for user-owned validation | inactive status, missing Project authorization, unsupported capability/model, missing secret, provider disabled |
| `provider_connection.rotate` | `human` | connection secret version | User or Workspace | owning user; Workspace owner/admin for workspace-owned | inactive owner, insufficient role, connection deleted, unsupported credential kind |
| `provider_connection.revoke` | `human` | active, disabled, or rotation-required connection | User or Workspace | owning user for user-owned; Workspace owner/admin for workspace-owned | insufficient role, connection already deleted, provider-side revocation uncertainty without auditable outcome |
| `provider_connection.delete` | `human` | connection | User or Workspace | owning user; Workspace owner/admin for workspace-owned | active Jobs require retention policy, insufficient role, final required provider default without replacement |
| `provider_connection.audit.read` | `human` | connection audit events | Workspace or user audit scope | owning user for own connection; Workspace owner/admin for workspace-owned | no ownership, no Workspace admin role, audit retention restriction |

Permission invariants:

- server-side authorization is authoritative;
- browsers never receive raw credential material;
- `provider_connection.use` authorizes use of an already-created connection, not
  access to the decrypted secret;
- a Job or Generation operation must also satisfy its own `job.*` or
  `generation.*` permission;
- Project-scoped use requires the target Project to inherit canonical Workspace
  ownership and the caller to hold the required Project role;
- Workspace role alone does not automatically grant Project execution;
- a user-owned connection may be used for Project-scoped dispatch only as a
  same-user credential: the requesting Better Auth user must equal
  `ownerUserId`, must be authorized for the target Project operation, and the
  Job/dispatch record must carry that originating user id and connection id for
  later server continuation. Matching is by caller user plus Project
  authorization, not by personal Workspace, target Project Workspace, provider
  account metadata, or automatic Workspace default selection;
- workspace-owned connections may be selected for Project-scoped dispatch only
  when the connection's `ownerWorkspaceId` matches the Project's canonical
  Workspace and the caller is authorized for the Project operation;
- legacy `x-api-key` compatibility does not grant new ProviderConnection
  creation, rotation, revocation, deletion, or secret-read authority;
- revoke and delete are separate operations. Revoke makes the connection
  unusable and records whether provider-side credential revocation was attempted
  and confirmed. Delete removes the connection from ordinary listings or creates
  a tombstone according to retention rules, but must not erase required audit
  evidence. Rotate cannot reactivate a revoked or deleted connection unless a
  later reviewed work package defines an explicit restoration policy;
- internal service use must be allowlisted and correlated to a previously
  authorized Dynaxis Job, dispatch attempt, or verification flow.

## Server Service Boundary

Future runtime should expose a server-only ProviderConnection service with these
logical operations:

- `createConnection(input, authContext)`
- `readConnectionMetadata(connectionId, authContext)`
- `listConnections(scope, authContext)`
- `verifyConnection(connectionId, authContext)`
- `useConnectionForDispatch(connectionId, dispatchContext)`
- `rotateConnectionSecret(connectionId, rotationInput, authContext)`
- `revokeConnection(connectionId, authContext)`
- `deleteConnection(connectionId, authContext)`
- `readConnectionAudit(connectionId, authContext)`

`dispatchContext` must include:

- normalized service or human-originated AuthContext;
- authorized Workspace id;
- Project id when dispatch is Project-scoped;
- Job id or Generation id when execution is job-backed;
- provider id;
- capability id;
- model id when selected;
- correlation id.

Secret materialization is allowed only inside `useConnectionForDispatch()` or an
equivalent server-only dispatch primitive after:

1. the AuthContext principal is accepted;
2. the operation has passed Dynaxis authorization;
3. the connection owner matches the operation context;
4. the connection status is `active`;
5. provider id, capability, model, and scope constraints match;
6. the secret envelope can be unwrapped by WP-7D-02 key-management rules;
7. an audit event can be written or queued.

Provider adapters receive provider-specific credential input from this boundary.
They must not retrieve or decrypt secrets themselves.

## Threat Model

### Assets Protected

- raw provider credentials and refresh tokens;
- encrypted secret envelopes and key identifiers;
- ProviderConnection ownership metadata;
- provider account metadata;
- provider scopes, provider model entitlements, quota/account state;
- Dynaxis Job, Generation, Project, and audit correlation metadata;
- revocation and rotation history.

### Trust Boundaries

- Browser/UI to Dynaxis server API.
- Dynaxis server API to authorization evaluator.
- ProviderConnection service to secret envelope service.
- Secret envelope service to KMS or local development key provider.
- Job dispatcher to provider adapter.
- Provider adapter to external provider API.
- Provider webhook or metadata refresh response back to Dynaxis.

### Storage Threats

- raw secret accidentally persisted in metadata, logs, job payloads, fixtures, or
  analytics;
- encrypted secret envelope copied across Workspace or user owners;
- database reader with metadata access infers sensitive provider account state;
- stale secret versions remain usable after rotation;
- deletion removes audit evidence needed for incident response.

Required mitigations:

- store raw credential material only in encrypted envelopes governed by WP-7D-02;
- bind envelope metadata to ProviderConnection id, owner, provider id,
  credential kind, and version;
- enforce owner-context checks before unwrap;
- keep tombstones or audit events for deletion where retention requires them;
- never expose `secretRef` or envelope internals to browser clients.

### Use Threats

- compromised UI calls a connection on a Project the user cannot edit;
- provider credential is treated as identity and bypasses Dynaxis policy;
- worker adapter directly reads secrets;
- provider model account metadata grants access to Dynaxis resources;
- connection is used for an unsupported capability or model;
- concurrent status change races with dispatch.

Required mitigations:

- require both ProviderConnection permission and resource permission for
  Project-scoped work;
- evaluate connection status and owner inside the same server use boundary that
  unwraps the secret;
- pass credentials only to provider adapters for the active dispatch attempt;
- record dispatch attempt, connection id, provider id, and correlation id without
  secret values;
- fail closed when status, ownership, provider, capability, model, or scope
  checks cannot be proven.

### Rotation Threats

- old credential remains usable after rotation;
- rotation writes the new secret but does not update connection version;
- in-flight Jobs use a half-rotated connection;
- failed rotation leaks credential material through validation errors.

Required mitigations:

- rotation is versioned and audited;
- active version is switched only after the new credential is stored and
  validated according to the provider policy;
- failed rotation leaves the previous active version unchanged unless explicit
  revocation occurs;
- validation errors are sanitized;
- long-running dispatch attempts record the secret version they used without
  recording the secret.

### Revocation And Deletion Threats

- revoked connection is still accepted by queued workers;
- deletion hides evidence of unauthorized use;
- provider-side revocation is assumed but not actually confirmed;
- default routing continues to select a deleted connection.

Required mitigations:

- revoked, disabled, rotation-required, and deleted states fail closed in the
  use boundary;
- queued workers must re-check connection status immediately before provider
  dispatch;
- revocation records whether provider-side revocation was attempted and whether
  it succeeded;
- default routing must ignore non-active connections;
- deletion should tombstone when audit retention, active Jobs, or incident
  analysis require it.

### Logging And Audit Threats

- raw credential appears in structured logs, errors, traces, telemetry, or
  provider payload captures;
- provider account email or tenant id is overexposed;
- denied attempts are not visible to security review;
- logs are enough to reconstruct a credential.

Required mitigations:

- log only connection id, provider id, owner context, credential kind,
  fingerprint, status, reason code, and correlation id;
- redact provider account metadata by default in broad audit/search views;
- record denied use, failed unwrap, rotation failure, and revocation failure;
- sanitize provider error payloads before persistence;
- never log full tokens, full API keys, refresh tokens, authorization codes,
  webhook secrets, service account JSON, or decrypted envelope payloads.

### Provider Account Metadata Threats

- provider metadata is mistaken for verified Dynaxis ownership;
- provider tenant id collides with Dynaxis Workspace id semantics;
- metadata refresh changes display identity unexpectedly;
- provider account names expose personal data in Workspace views.

Required mitigations:

- keep provider metadata explicitly non-authoritative;
- namespace provider metadata under ProviderConnection, not AuthContext;
- record `metadataSource` and `metadataVerifiedAt`;
- treat provider account ids, usernames, emails, and tenant ids as
  privacy-sensitive display data;
- require Dynaxis authorization for metadata reads.

## Error Contract

WP-7D-03 and WP-7D-04 should preserve these logical error codes or direct
equivalents:

- `PROVIDER_CONNECTION_NOT_FOUND`
- `PROVIDER_CONNECTION_FORBIDDEN`
- `PROVIDER_CONNECTION_OWNER_MISMATCH`
- `PROVIDER_CONNECTION_UNSUPPORTED_PROVIDER`
- `PROVIDER_CONNECTION_UNSUPPORTED_CREDENTIAL_KIND`
- `PROVIDER_CONNECTION_INACTIVE`
- `PROVIDER_CONNECTION_ROTATION_REQUIRED`
- `PROVIDER_CONNECTION_REVOKED`
- `PROVIDER_CONNECTION_DELETED`
- `PROVIDER_CONNECTION_SCOPE_DENIED`
- `PROVIDER_CONNECTION_CAPABILITY_DENIED`
- `PROVIDER_CONNECTION_MODEL_DENIED`
- `PROVIDER_CONNECTION_SECRET_MISSING`
- `PROVIDER_CONNECTION_SECRET_UNAVAILABLE`
- `PROVIDER_CONNECTION_SECRET_CORRUPT`
- `PROVIDER_CONNECTION_PROVIDER_HEALTH_FAILED`
- `PROVIDER_CONNECTION_AUDIT_UNAVAILABLE`

Errors returned to clients must be sanitized and must not include raw provider
payloads or secret material.

## Handoff Contracts

WP-7D-02 must define the secret envelope and key-management architecture without
changing this domain boundary. It should specify how `secretRef`, `secretVersion`,
owner binding, rotation, corrupt ciphertext, missing keys, and KMS/local-dev
failure behavior work.

WP-7D-03 must create persistence for ProviderConnection metadata and encrypted
secret references, but it must not store raw credentials in metadata tables and
must include tests proving provider credentials never become identity or
authorization subjects.

WP-7D-04 must implement server-only services and permissions around this
contract. It must not let provider adapters, browsers, or worker adapters bypass
the ProviderConnection use boundary to retrieve credentials.

WP-7D-05 may migrate MuAPI credential behavior into ProviderConnection only
after WP-7D-04 is complete. Legacy `x-api-key` compatibility remains a server
compatibility principal; it is not a ProviderConnection credential and does not
grant new ProviderConnection authority.

WP-7E worker and Job packages must treat ProviderConnections as authorized
inputs to provider dispatch, not as Job owners or worker identities.
