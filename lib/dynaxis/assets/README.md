# Dynaxis Asset Library / Media Registry Scaffold

This package is a **scaffold-only** contract layer for the Asset Library and Media Registry domain.

Included:

- constants for asset/media categories and usage contexts
- Zod schemas for asset metadata, media metadata, references, usage, license, provenance, and collections
- validation helpers returning normalized issues
- public projection helper with redaction of secret-like content

Not included:

- upload handlers or storage APIs
- S3/R2 integration
- filesystem writes
- media processing, transcoding, or thumbnail generation
- persistence, schema, drizzle, or migrations
- Composer/Template Library/Design System/App Factory implementation wiring
