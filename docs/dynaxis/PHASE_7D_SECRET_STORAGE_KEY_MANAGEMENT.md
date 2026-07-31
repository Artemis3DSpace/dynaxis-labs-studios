# Phase 7D - Secret Storage and Key Management Architecture

## Status

WP-7D-02 defines the secret storage and key-management architecture for Phase 7D ProviderConnection credentials. It is specification only.

This document does not implement runtime code, add database migrations, implement encryption/decryption functions, or complete provider services. Secret envelope runtime implementation belongs to WP-7D-03 and WP-7D-04.

## Secret Envelope Contract

### Separation Principle

ProviderConnection metadata and encrypted secret envelopes must be completely separated:

- **ProviderConnection records** store only metadata and secret references (`secretRef`, `secretVersion`, `keyRef`)  
- **Secret envelopes** store only encrypted payloads and cryptographic metadata
- **Raw secret material** must never appear in ProviderConnection tables, logs, API responses, or analytics

### Secret Envelope Fields

Each secret envelope contains:

- `envelopeId`: unique identifier for this encrypted envelope (UUID)
- `secretVersion`: monotonic version for rotation tracking  
- `keyRef`: reference to the encryption key used (production KMS key alias, local dev key id)
- `algorithm`: encryption algorithm used (required: AES-256-GCM or equivalent AEAD)
- `encryptedPayload`: authenticated encrypted secret material
- `authTag`: authentication tag from AEAD encryption
- `iv`: initialization vector / nonce
- `aad`: Additional Authenticated Data binding envelope to context
- `createdAt`: envelope creation timestamp
- `rotatedFromEnvelopeId`: previous envelope id when rotated (null for initial)

### Authenticated Encryption Requirements

- **Algorithm**: AES-256-GCM or equivalent Authenticated Encryption with Associated Data (AEAD)
- **Key size**: 256-bit minimum  
- **IV/Nonce**: 96-bit minimum, cryptographically random, unique per encryption
- **Authentication**: AEAD must authenticate both ciphertext and Additional Authenticated Data (AAD)

### Additional Authenticated Data (AAD) Binding

AAD must bind the envelope to its context:

```text
AAD = ownerType || ":" || ownerId || ":" || providerId || ":" || credentialKind || ":" || secretVersion
```

Where:
- `ownerType`: "user" or "workspace"  
- `ownerId`: `ownerUserId` or `ownerWorkspaceId` from ProviderConnection
- `providerId`: provider registry id (e.g., "muapi", "replicate")
- `credentialKind`: credential type (e.g., "api_key", "oauth_access_refresh_token")
- `secretVersion`: version number as string

This prevents:
- Cross-owner envelope attacks
- Cross-provider envelope attacks  
- Cross-credential-kind envelope attacks
- Envelope replay after rotation

## Key Management Architecture

### Production Key Management

**Requirements:**
- Cloud KMS (AWS KMS, Azure Key Vault, GCP Cloud KMS) or HSM-backed key storage
- Key rotation capability without envelope re-encryption (envelope keys vs master keys)
- Audit logging of all key operations
- Cross-region key replication for disaster recovery
- Role-based access control for key operations

**Key Hierarchy:**
```text
Master Key (KMS/HSM)
  -> Envelope Encryption Keys (derived or wrapped)
    -> Individual Secret Envelopes
```

**Key References:**
- `keyRef` format: `kms://region/key-alias/version` or equivalent
- Keys identified by alias, not raw key material
- Key versioning supported for seamless rotation

### Local Development Key Management

**Requirements:**
- File-based key storage with appropriate filesystem permissions (600)
- Environment variable override for key location
- Automatic key generation on first use
- Clear documentation that local keys are for development only

**Key Storage:**
- Default location: `~/.dynaxis/dev-keys/` or project-relative `.dynaxis/keys/`
- Key format: JSON with key id, created timestamp, algorithm
- Never commit keys to version control (`.gitignore` protection)

**Fallback Behavior:**
- If no key exists, generate new 256-bit key automatically
- Log key generation to help developers understand setup
- Fail clearly if key directory is not writable

### Test Environment Key Management

**Requirements:**
- Deterministic test keys for reproducible test runs
- No real credential material in test envelopes
- Clear test key identification to prevent production usage

**Test Keys:**
- Static test keys derived from known seeds
- `keyRef` format: `test://algorithm/key-id`
- Test envelopes contain fake credential material only

## Persistence Rules for WP-7D-03

### What WP-7D-03 MAY Persist in ProviderConnection Tables

- `secretRef`: opaque reference to secret envelope (UUID or similar)
- `secretVersion`: monotonic version number for tracking rotations
- `keyRef`: reference to encryption key used (for key management)
- `credentialFingerprint`: non-authenticating, non-reversible digest
- `lastRotatedAt`: timestamp when secret was last rotated
- `rotationRequiredAt`: timestamp after which use must fail until rotation
- `envelopeCreatedAt`: timestamp when current envelope was created
- `rotationInProgress`: boolean flag during active rotation
- `secretStatus`: envelope-specific status ("active", "rotation_required", "corrupted", "missing")

### What WP-7D-03 MUST NEVER Persist

**Raw Secret Material (FORBIDDEN):**
- API keys (full or partial beyond fingerprint)
- Bearer tokens
- OAuth access tokens  
- OAuth refresh tokens
- OAuth client secrets
- Service account JSON (full or fields)
- Webhook signing secrets
- Authorization codes
- Any decrypted credential payload

**Locations Where Raw Secrets Are FORBIDDEN:**
- ProviderConnection table columns
- Database indexes
- Application logs (structured or unstructured)
- Job/Generation payloads
- Provider registry metadata
- Audit event properties (except envelope operations)
- Error messages returned to browsers
- API response bodies (except envelope references)
- Cache entries
- Test fixtures (except clearly marked fake data)
- Database dumps and backups of metadata tables
- Analytics events and metrics
- Debug output and stack traces

## Failure Modes and Fail-Closed Behavior

### Missing Key Failures

**Scenario**: `keyRef` points to non-existent or inaccessible key

**Behavior:**
- Secret unwrap operations must fail immediately
- Error logged with correlation id, not key details
- ProviderConnection marked as `secretStatus: "missing"`
- Provider dispatch blocked until key recovery or rotation
- No fallback to weaker encryption or plaintext storage

### Corrupted Ciphertext Failures

**Scenario**: Envelope ciphertext fails authentication or decryption

**Behavior:**
- Unwrap operations must fail immediately  
- Error logged with envelope id and correlation id
- ProviderConnection marked as `secretStatus: "corrupted"`
- Provider dispatch blocked until secret rotation
- No retry attempts with same corrupted data

### Wrong Workspace/Owner Failures

**Scenario**: AAD binding validation fails during unwrap

**Behavior:**
- Unwrap operations must fail immediately
- Security event logged with attempted and actual owner context
- ProviderConnection use denied regardless of other permissions
- No escalation or override mechanism
- Indicates potential security compromise requiring investigation

## Browser/API Redaction Rules

### Browser Client Rules

**Never return to browsers:**
- `secretRef` (envelope references)
- `keyRef` (key references)  
- Raw secret material
- Envelope metadata (creation time, rotation history)
- Decrypted credential payloads
- Key management status

**May return to browsers:**
- ProviderConnection metadata (without secret references)
- Connection status ("active", "disabled", "rotation_required")
- `credentialFingerprint` (non-authenticating display only)
- Last rotation timestamp (for UI display)
- Provider account metadata (if privacy-safe)

## Provider Adapter Boundary

### What Provider Adapters Receive

**Provider adapters receive only:**
- Plaintext credential material for immediate use
- Provider-specific credential format (API key string, OAuth tokens, etc.)
- Credential scope/permission context
- Expiration information (if applicable)

**Provider adapters must NOT:**
- Store received credentials beyond request lifetime
- Log received credentials  
- Cache credentials across requests
- Access envelope operations or key management
- Decrypt envelopes themselves
- Retain credentials after provider call completion

## Handoff Contracts

### WP-7D-03 Schema and Migration Handoff

**WP-7D-03 must implement:**
- ProviderConnection table columns per persistence rules above
- Secret envelope storage (separate from metadata)
- Key reference storage and validation
- AAD binding validation during unwrap operations
- Fail-closed behavior for all secret operation failures
- Migration tests proving no raw secret persistence

**WP-7D-03 must NOT implement:**
- Encryption/decryption runtime logic (deferred to WP-7D-04)
- Key generation or rotation services (deferred to WP-7D-04)  
- Provider adapter integration (deferred to WP-7D-04)

### WP-7D-04 Provider Connection Services Handoff  

**WP-7D-04 must implement:**
- Secret envelope encryption/decryption services
- Key management integration (production KMS, local dev, test)
- ProviderConnection CRUD operations with secret lifecycle
- Authorization integration per WP-7D-01 permission boundary
- Provider adapter secret materialization boundary
- Audit logging for all secret operations

### WP-7D-05 MuAPI Credential Migration Handoff

**WP-7D-05 must preserve:**
- All secret storage architecture requirements during migration
- No weakening of existing credential security
- Clear separation from identity/authorization concerns

### WP-7D-06 Connection Health/Rotation UI Handoff

**WP-7D-06 must enforce:**
- Browser redaction rules (no secret references in UI)
- Authorization requirements for credential operations
- Audit history display without secret exposure

### WP-7E Provider/Job Execution Handoff

**WP-7E must preserve:**
- Worker/job dispatch boundary (no direct secret access)
- Provider adapter materialization boundary  
- Audit correlation for credential usage tracking
