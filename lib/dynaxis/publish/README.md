# Dynaxis Publish / Export Boundary (Phase 8H Scaffold)

This directory provides a pure contract scaffold for publish/export boundaries in Phase 8H.

## Scope

- Contract-only constants, Zod schemas, validators, and redaction helpers.
- Placeholder contracts for publish targets, deployment boundary, and artifact manifest.
- Boundary rules to keep publish/export domain isolated from forbidden paths and secret-like data.

## Explicit Non-Goals

- No deployment implementation.
- No publishing implementation.
- No export execution or export jobs.
- No filesystem writes.
- No ProviderConnection or secrets-module integration.
- No GitHub/Vercel/Railway/Fly/Netlify integration.
- No package publishing.
- No persistence, migrations, or schema changes.

## Notes

Later phases may connect these publish/export boundaries to Build Runtime, Template Library, Composer, and App IR contracts, while preserving these non-goals at scaffold stage.
