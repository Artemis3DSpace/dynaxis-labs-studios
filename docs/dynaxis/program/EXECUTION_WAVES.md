# Dynaxis Execution Waves

Execution waves are derived from corrected Work Package dependencies and migration-owner serialization. READY specification packages may run now because they edit documentation only. Runtime implementation opens only after dependency integration, branch isolation, and migration ownership checks. No wave lists more than one migration owner as simultaneously executable.

## Wave A - Ready Specification Work That Can Run Now

- Packages: WP-7E-01, WP-7E-02, WP-7E-03, WP-7F-01, WP-7G-01, WP-7H-01, WP-7I-01, WP-8A-01, WP-8C-01, WP-8F-01, WP-8G-01, WP-8H-01, WP-9-01
- Specification packages: WP-7E-01, WP-7E-02, WP-7E-03, WP-7F-01, WP-7G-01, WP-7H-01, WP-7I-01, WP-8A-01, WP-8C-01, WP-8F-01, WP-8G-01, WP-8H-01, WP-9-01
- Implementation packages: -
- Review / integration gates: -
- Migration owner constraints: -
- Rule: documentation/programme/specification edits only; no runtime files, schemas, APIs, product UI, or migrations.

## Wave B - Completed Implementation and Review Work

- Packages: WP-7C-04, WP-7C-05, WP-7C-06, WP-7C-07, WP-7C-08, WP-7C-09, WP-7C-10, WP-7C-11, WP-7C-12
- Specification packages: WP-7C-08
- Implementation packages: WP-7C-04, WP-7C-05, WP-7C-06, WP-7C-09, WP-7C-10, WP-7C-12
- Review / integration gates: WP-7C-07, WP-7C-11
- Migration owner constraints: complete
- Rule: integrated through `phase-7c/identity-organizations-permissions`, `phase-7c/project-membership`, `phase-7c/project-membership-service`, `phase-7c/project-membership-review`, `phase-7c/authorization-spec`, `phase-7c/authorization-workspace-policy`, `phase-7c/project-policy-resource-inheritance`, `phase-7c/authorization-regression-review`, and `phase-7c/auth-context-contract`; branch and implementation history are preserved.

## Wave C - Ready Follow-On Specification Work

- Specification packages: WP-8B-01, WP-8D-01, WP-8E-01
- Implementation packages: -
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-01, WP-8D-01, WP-8E-01
- Serialization note: no Phase 7C migration owner is active in this wave.

## Wave D - Completed Phase 7C Review Work

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7C-11
- Migration owner constraints: complete
- Packages that may run after dependency and conflict checks: -

## Wave E - Completed Phase 7C AuthContext Work

- Specification packages: -
- Implementation packages: WP-7C-12, WP-7C-13
- Review / integration gates: -
- Migration owner constraints: complete
- Packages that may run after dependencies and conflict checks: -

## Wave F - Completed Phase 7C Route Migration Work

- Specification packages: -
- Implementation packages: WP-7C-14, WP-7C-15, WP-7C-16, WP-7C-17
- Review / integration gates: -
- Migration owner constraints: complete
- Rule: integrated from `integration/phase-7c-route-migration-wave` through source branches `phase-7c/route-migration-projects-assets`, `phase-7c/route-migration-generations-jobs`, `phase-7c/route-migration-characters-products-brands-campaigns`, and `phase-7c/route-migration-design-mini-app`.

## Wave G - Completed Phase 7C TanStack Query Foundation Work

- Specification packages: -
- Implementation packages: WP-7C-18
- Review / integration gates: -
- Migration owner constraints: complete
- Rule: integrated from `phase-7c/tanstack-query-foundation`; query key registry and client foundation only.

## Later Wave 6 - Completed Phase 7C Client Session Work

- Specification packages: -
- Implementation packages: WP-7C-19
- Review / integration gates: -
- Migration owner constraints: complete
- Rule: integrated from `phase-7c/client-session-workspace-switching`; client session/workspace switching foundation only.

## Later Wave 7 - Completed Phase 7C Project Queries Work

- Specification packages: -
- Implementation packages: WP-7C-20
- Review / integration gates: -
- Migration owner constraints: complete
- Rule: integrated from `phase-7c/project-queries-studio-migration`; project query hooks and minimal Studio migration only.

## Later Wave 8 - Completed Phase 7C Identity Hardening Work

- Specification packages: -
- Implementation packages: WP-7C-21
- Review / integration gates: -
- Migration owner constraints: -
- Rule: integrated from `phase-7c/identity-signup-provisioning-recovery-hardening`; personal workspace provisioning/recovery hardening only. Rate-limit and abuse hardening remain for WP-7C-22.

## Later Wave 9 - Completed Phase 7C Session Security Work

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7C-22
- Migration owner constraints: -
- Rule: integrated from `phase-7c/session-rate-limit-abuse-security-tests`; session rate-limit, abuse, and security test coverage only. No production code changes.

## Later Wave 10 - Completed Phase 7C Identity Integration Gate

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7C-23
- Migration owner constraints: -
- Rule: integrated from `phase-7c/identity-integration-gate`; Phase 7C identity work complete. Phase 7D is ready to begin.

## Later Wave 11 - Completed Phase 7D ProviderConnection Contract Specification

- Specification packages: WP-7D-01
- Implementation packages: -
- Review / integration gates: -
- Migration owner constraints: -
- Rule: integrated from `phase-7d/providerconnection-contract-threat-model`; ProviderConnection contract and threat model specification only.

## Later Wave 12 - Completed Phase 7D Secret Storage and Key Management Architecture

- Specification packages: WP-7D-02
- Implementation packages: -
- Review / integration gates: -
- Migration owner constraints: -
- Rule: integrated from `phase-7d/secret-storage-key-management-architecture`; secret storage and key-management architecture specification only. WP-7D-03 Provider Connection Schema and Migration is the next ready Phase 7D implementation work.

## Later Wave 13 - Completed Phase 7D Provider Connection Schema and Migration

- Specification packages: -
- Implementation packages: WP-7D-03
- Review / integration gates: -
- Migration owner constraints: complete
- Rule: integrated from `phase-7d/provider-connection-schema-migration`. WP-7D-03 Provider Connection Schema and Migration is **completed**; migration `0015` (`0015_phase_7d_3_provider_connections.sql`) is integrated on main, adding `dynaxis_provider_connections` and `dynaxis_provider_secret_envelopes`. No Phase 7D migration owner is active.
- Scope note: storage shape only. No encryption/decryption runtime, unwrap, AAD runtime validation, key generation, KMS/local/test key runtime, provider adapter materialization, provider services, OAuth, or UI was introduced. No ProviderConnection runtime implementation has started.

## Later Wave 14 - Completed Phase 7D Provider Connection Services and Permissions

- Specification packages: -
- Implementation packages: WP-7D-04, WP-8F-02
- Review / integration gates: -
- Migration owner constraints: WP-8F-02
- Rule: WP-7D-04 integrated from `phase-7d/provider-connection-services-permissions`. It delivers the server-only ProviderConnection service layer, the seven `provider_connection.*` permission checks, AES-256-GCM envelope encryption/decryption with AAD binding, the key-management boundary, the unwrap/materialization boundary, fail-closed runtime behavior, and runtime audit logging.
- Scope note: WP-7D-04 added no schema and no migration; it builds on the integrated `0015` shape. No OAuth flow, no Studio UI, and no provider-specific adapter implementation.
- Serialization note: no Phase 7D migration owner is active. WP-8F-02 remains the migration owner for its own phase line and is unaffected.

## Later Wave 15 - Completed Phase 7D MuAPI Credential Migration

- Specification packages: -
- Implementation packages: WP-7D-05
- Review / integration gates: -
- Migration owner constraints: -
- Rule: WP-7D-05 MuAPI Credential Migration and Provider Resolver is **completed** and integrated from `phase-7d/muapi-credential-migration-provider-resolver`. The Provider Resolver and the MuAPI credential migration path are integrated, and MuAPI credential use now routes through the ProviderConnection runtime boundary.
- Boundary note: provider adapters remain pure — `lib/dynaxis/providers/**` was not modified and imports neither ProviderConnection nor secret internals. Selection gates on `provider_connection.read`, so an unauthorized caller cannot expose `secretRef`/`keyRef`.
- Legacy note: legacy `x-api-key` remains a compatibility principal only. It does not become a ProviderConnection credential and grants no ProviderConnection authority.
- Scope note: no OAuth, no UI, no schema, and no migration were added; no existing route was rewired.
- Serialization note: no Phase 7D migration owner is active. WP-7D-07 remains backlog until WP-7D-06 is integrated.

## Later Wave 16 - Completed Phase 7D Connection Health Rotation UI and Audit

- Specification packages: -
- Implementation packages: WP-7D-06
- Review / integration gates: -
- Migration owner constraints: -
- Rule: WP-7D-06 Connection Health Rotation UI and Audit is **completed** and integrated from `phase-7d/connection-health-rotation-ui-audit`. The connection health surface, the rotation/revoke/delete action boundaries, safe audit visibility, the ProviderConnection API routes under `app/api/dynaxis/provider-connections/**`, and a minimal Studio ProviderConnection panel are all integrated.
- Redaction note: every browser/API projection is allowlist-based. The public audit projection strips `secretVersion`, `secretStatus`, and `previousSecretStatus`; the Studio client fail-closed forbidden-field guard remains active. No `secretRef`, `keyRef`, envelope metadata, IV, authTag, AAD, ciphertext, or plaintext reaches a browser.
- Audit note: the server-side audit sink remains in-memory and keeps server forensic metadata. No durable audit persistence was added.
- Scope note: no OAuth implementation, no schema, no migration, and no provider adapter changes. `lib/dynaxis/providers/**` remains pure and imports neither ProviderConnection nor secret internals.
- Serialization note: no Phase 7D migration owner is active.

## Later Wave 17 - Ready Phase 7D Provider Connection Security Review

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7D-07
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7D-07
- Dependency note: WP-7D-07 depends on WP-7D-03 through WP-7D-06 (all integrated) and is now the next ready Phase 7D task. It is **ready but not started**; no branch exists.
- Scope note: WP-7D-07 is the Phase 7D security review gate and should work through the recorded Phase 7D follow-ups in `CURRENT_WORK.md`.

## Later Wave 18

- Specification packages: -
- Implementation packages: WP-7E-04
- Review / integration gates: -
- Migration owner constraints: WP-7E-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 19

- Specification packages: -
- Implementation packages: WP-7E-05
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-05

## Later Wave 20

- Specification packages: -
- Implementation packages: WP-7E-06
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-06

## Later Wave 21

- Specification packages: -
- Implementation packages: WP-7E-07
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-07

## Later Wave 22

- Specification packages: -
- Implementation packages: WP-7E-08
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-08

## Later Wave 23

- Specification packages: -
- Implementation packages: WP-7E-09
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-09

## Later Wave 24

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7E-10
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-10

## Later Wave 25

- Specification packages: -
- Implementation packages: WP-7F-02
- Review / integration gates: -
- Migration owner constraints: WP-7F-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 26

- Specification packages: -
- Implementation packages: WP-7F-03
- Review / integration gates: -
- Migration owner constraints: WP-7F-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 27

- Specification packages: -
- Implementation packages: WP-7F-04, WP-8F-03
- Review / integration gates: -
- Migration owner constraints: WP-8F-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-04, WP-8F-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 28

- Specification packages: -
- Implementation packages: WP-7F-05, WP-7F-06, WP-8F-04
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-05, WP-7F-06, WP-8F-04

## Later Wave 29

- Specification packages: -
- Implementation packages: WP-8F-05
- Review / integration gates: WP-7F-07
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-07, WP-8F-05

## Later Wave 30

- Specification packages: -
- Implementation packages: WP-7G-02
- Review / integration gates: WP-8F-06
- Migration owner constraints: WP-7G-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7G-02, WP-8F-06
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 31

- Specification packages: -
- Implementation packages: WP-7G-03, WP-7I-02, WP-10-03
- Review / integration gates: -
- Migration owner constraints: WP-7I-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7G-03, WP-7I-02, WP-10-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 32

- Specification packages: -
- Implementation packages: WP-7G-04, WP-7I-03, WP-7I-04, WP-10-01
- Review / integration gates: -
- Migration owner constraints: WP-10-01
- Packages that may run simultaneously after dependencies and conflict checks: WP-7G-04, WP-7I-03, WP-7I-04, WP-10-01
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 33

- Specification packages: -
- Implementation packages: WP-7G-05, WP-10-04
- Review / integration gates: WP-7I-05
- Migration owner constraints: WP-10-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-7G-05, WP-7I-05, WP-10-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 34

- Specification packages: -
- Implementation packages: WP-7H-02
- Review / integration gates: -
- Migration owner constraints: WP-7H-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7H-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 35

- Specification packages: -
- Implementation packages: WP-7H-03, WP-8A-02
- Review / integration gates: -
- Migration owner constraints: WP-8A-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7H-03, WP-8A-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 36

- Specification packages: -
- Implementation packages: WP-7H-04, WP-8A-03
- Review / integration gates: -
- Migration owner constraints: WP-8A-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-7H-04, WP-8A-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 37

- Specification packages: -
- Implementation packages: WP-7H-05, WP-8A-04
- Review / integration gates: -
- Migration owner constraints: WP-8A-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-7H-05, WP-8A-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 38

- Specification packages: -
- Implementation packages: WP-8A-05
- Review / integration gates: -
- Migration owner constraints: WP-8A-05
- Packages that may run simultaneously after dependencies and conflict checks: WP-8A-05
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 39

- Specification packages: -
- Implementation packages: WP-8A-06, WP-8C-02
- Review / integration gates: -
- Migration owner constraints: WP-8C-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-8A-06, WP-8C-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 40

- Specification packages: -
- Implementation packages: WP-8C-03, WP-8C-04, WP-8C-05, WP-8E-02
- Review / integration gates: WP-8A-07
- Migration owner constraints: WP-8E-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-8A-07, WP-8C-03, WP-8C-04, WP-8C-05, WP-8E-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 41

- Specification packages: -
- Implementation packages: WP-8B-02, WP-8C-06, WP-8D-02, WP-8E-03
- Review / integration gates: -
- Migration owner constraints: WP-8D-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-02, WP-8C-06, WP-8D-02, WP-8E-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 42

- Specification packages: -
- Implementation packages: WP-8B-03, WP-8D-03, WP-8E-04
- Review / integration gates: WP-8C-07
- Migration owner constraints: WP-8D-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-03, WP-8C-07, WP-8D-03, WP-8E-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 43

- Specification packages: -
- Implementation packages: WP-8B-04, WP-8D-04, WP-8D-05, WP-10-05
- Review / integration gates: WP-8E-05
- Migration owner constraints: WP-10-05
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-04, WP-8D-04, WP-8D-05, WP-8E-05, WP-10-05
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 44

- Specification packages: -
- Implementation packages: WP-8B-05, WP-8G-02, WP-9-02, WP-10-06
- Review / integration gates: WP-8D-06
- Migration owner constraints: WP-10-06
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-05, WP-8D-06, WP-8G-02, WP-9-02, WP-10-06
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 45

- Specification packages: -
- Implementation packages: WP-8B-06, WP-8G-03, WP-9-03, WP-10-07
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-06, WP-8G-03, WP-9-03, WP-10-07

## Later Wave 46

- Specification packages: -
- Implementation packages: WP-8G-04, WP-9-04, WP-10-08
- Review / integration gates: WP-8B-07
- Migration owner constraints: WP-8G-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-07, WP-8G-04, WP-9-04, WP-10-08
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 47

- Specification packages: -
- Implementation packages: WP-9-05
- Review / integration gates: WP-8G-05
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8G-05, WP-9-05

## Later Wave 48

- Specification packages: -
- Implementation packages: WP-8H-02, WP-9-06
- Review / integration gates: -
- Migration owner constraints: WP-8H-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-02, WP-9-06
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 49

- Specification packages: -
- Implementation packages: WP-8H-03
- Review / integration gates: WP-9-07
- Migration owner constraints: WP-8H-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-03, WP-9-07
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 50

- Specification packages: -
- Implementation packages: WP-8H-04
- Review / integration gates: -
- Migration owner constraints: WP-8H-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 51

- Specification packages: -
- Implementation packages: WP-8H-05
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-05

## Later Wave 52

- Specification packages: -
- Implementation packages: WP-8H-06
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-06

## Later Wave 53

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-8H-07
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-07

## Later Wave 54

- Specification packages: -
- Implementation packages: WP-10-02
- Review / integration gates: -
- Migration owner constraints: WP-10-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-10-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 55

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-10-09
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-10-09
