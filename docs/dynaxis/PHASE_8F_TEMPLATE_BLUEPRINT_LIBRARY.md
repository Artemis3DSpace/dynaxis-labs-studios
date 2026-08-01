# Phase 8F Template / Blueprint Library Scaffold

This phase branch introduces scaffold-only domain contracts for template and
blueprint library metadata.

## Scope in this branch

Contract definitions and pure validators are provided in
`lib/dynaxis/template-library/**` with tests in
`tests/dynaxis-template-library-*.test.mjs`.

Included:

- template metadata contracts
- blueprint package metadata contracts
- app-pack and compatibility references
- license/usage metadata contracts
- searchable library index and filter contracts

## Explicit non-goals

- this is scaffold only
- no marketplace is implemented
- no persistence or migration is included
- no package publishing is included
- no app generation, repository generation, or deployment behavior is included

## Forward integration notes

Later phases may connect template-library contracts to App IR, Build Runtime,
Design System, and Layout modules once implementation work packages are
assigned.
