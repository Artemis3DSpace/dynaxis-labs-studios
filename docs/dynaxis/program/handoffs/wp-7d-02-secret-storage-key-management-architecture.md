# WP-7D-02 Handoff: Secret Storage and Key Management Architecture

## Overview

WP-7D-02 delivers the complete secret storage and key management architecture specification for Phase 7D ProviderConnection credentials. This specification defines the security boundaries, encryption requirements, and implementation contracts required before WP-7D-03 can safely add schema and migrations.

## Delivered Specification

**Primary Document**: `docs/dynaxis/PHASE_7D_SECRET_STORAGE_KEY_MANAGEMENT.md`

## Key Architectural Decisions

### Secret Envelope Separation
- **Decision**: Complete separation between ProviderConnection metadata and encrypted secret envelopes
- **Rationale**: Prevents accidental secret exposure in logs, database dumps, or API responses
- **Impact**: WP-7D-03 must implement separate storage for metadata vs secret envelopes

### Authenticated Encryption with AAD Binding
- **Decision**: Require AES-256-GCM with Additional Authenticated Data (AAD) binding to owner, provider, and credential context
- **Rationale**: Prevents cross-owner, cross-provider, and replay attacks even if envelope storage is compromised
- **Impact**: All envelope operations must validate AAD binding; no cross-context envelope reuse possible

### Fail-Closed Security Model
- **Decision**: All secret operation failures (missing keys, corrupted ciphertext, wrong context) must fail immediately without fallback
- **Rationale**: Ensures security failures don't degrade to insecure operation modes
- **Impact**: WP-7D-04 must implement robust error handling and monitoring for secret operation failures

## Security Boundaries Established

### What May Be Persisted (WP-7D-03)
- Secret references (`secretRef`, `secretVersion`, `keyRef`)
- Non-authenticating metadata (`credentialFingerprint`, timestamps)
- Envelope status and rotation tracking

### What Must Never Be Persisted
- Any raw secret material (API keys, tokens, client secrets, etc.)
- Secret material in logs, jobs, analytics, browser responses, or test fixtures
- Decrypted payloads or provider authorization codes

## Implementation Handoff Contracts

### WP-7D-03: Schema and Migration
**Must Implement:**
- ProviderConnection metadata columns per specification
- Separate secret envelope storage system
- AAD binding validation during unwrap operations
- Fail-closed behavior for all secret failures

**Must NOT Implement:**
- Encryption/decryption runtime (deferred to WP-7D-04)
- Key management services (deferred to WP-7D-04)
- Provider adapter integration (deferred to WP-7D-04)

### WP-7D-04: Services and Runtime
**Must Implement:**
- Complete secret envelope encryption/decryption services
- Key management integration (KMS, local dev, test)
- Authorization integration per WP-7D-01 boundaries
- Audit logging for all secret operations

## Validation Evidence

- Complete secret envelope contract specified
- Key management architecture covers all deployment environments
- Fail-closed security model defined for all failure modes
- Clear separation between metadata and secret storage
- Comprehensive audit requirements specified
- AEAD encryption with AES-256-GCM minimum
- AAD binding prevents cross-context attacks
- Raw secret material forbidden in all persistence layers
- Browser/API redaction rules prevent secret leakage
- Provider adapter boundary prevents credential retention

## Next Steps

1. **WP-7D-02 Review**: Architecture review and integration approval
2. **WP-7D-03 Ready**: Schema and migration implementation based on this specification
3. **Security Validation**: All subsequent WPs must validate against security requirements

This architecture specification provides the complete foundation for secure ProviderConnection credential management while maintaining clear separation from Dynaxis identity and authorization systems.
