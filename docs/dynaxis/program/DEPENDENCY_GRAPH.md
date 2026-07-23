# Dynaxis Dependency Graph

The roadmap is not purely linear. Some phases are sequential gates, while later specification work can run ahead of runtime implementation when explicitly marked specification-only.

## Core Dependencies

```text
7C -> 7D -> 7E

7E -> 7F

7F + 7D + 7B -> 7G

7G + Character domain -> 7H

7F + 7E + Identity -> 7I

7F + 7I + Identity -> 8A

8A + 7I -> 8B

7E + 7F + 7G + existing Composition domain -> 8C

8A + existing Design System -> 8D

7G + 7I + 7E + permissions -> 8E

Identity + 7E + 7G + App Factory contracts -> 8F

8F + 8E + 8A + permissions -> 8G

8F + 8G + registries + identity -> 8H

7F + 7I + 8E + 7E -> 9

Completed platform -> 10
```

## Parallelization Boundaries

Eventually parallelizable after their dependencies are integrated:

- 7H Character Identity can progress alongside 7I once 7G and the Character domain contracts are stable.
- 8B Build Runtime and 8D Responsive Design / Auto Layout can progress in parallel after 8A and relevant contracts are integrated.
- 8C Composer can progress in parallel with 8D after 7E, 7F, 7G, and the existing Composition domain are stable.
- 8E Skills and 8F Developer Platform can progress in parallel after their shared identity, event, registry, and contract dependencies are integrated.
- 8G Extension / Plugin Platform and 8H Marketplace become candidates for parallel specification work once 8F contracts are stable, but runtime implementation remains dependency-gated.
- Phase 10 hardening spans the completed platform and should be decomposed into parallel security, reliability, packaging, billing, documentation, and operations Work Packages only after the platform scope is integrated.

Specification-only Work Packages may be created ahead of runtime dependencies when they are explicitly marked as specification-only and do not modify product runtime code.
