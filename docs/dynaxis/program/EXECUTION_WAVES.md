# Dynaxis Execution Waves

Execution waves are derived from corrected Work Package dependencies and migration-owner serialization. READY specification packages may run now because they edit documentation only. Runtime implementation opens only after dependency integration, branch isolation, and migration ownership checks. No wave lists more than one migration owner as simultaneously executable.

## Wave A - Ready Specification Work That Can Run Now

- Packages: WP-7D-01, WP-7D-02, WP-7E-01, WP-7E-02, WP-7E-03, WP-7F-01, WP-7G-01, WP-7H-01, WP-7I-01, WP-8A-01, WP-8C-01, WP-8F-01, WP-8G-01, WP-8H-01, WP-9-01
- Specification packages: WP-7D-01, WP-7D-02, WP-7E-01, WP-7E-02, WP-7E-03, WP-7F-01, WP-7G-01, WP-7H-01, WP-7I-01, WP-8A-01, WP-8C-01, WP-8F-01, WP-8G-01, WP-8H-01, WP-9-01
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

## Wave F - Phase 7C Route Migration Review

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7C-14, WP-7C-15, WP-7C-16, WP-7C-17
- Migration owner constraints: complete
- Integration branch: `integration/phase-7c-route-migration-wave`
- Rule: merged sequentially from `phase-7c/route-migration-projects-assets`, `phase-7c/route-migration-generations-jobs`, `phase-7c/route-migration-characters-products-brands-campaigns`, and `phase-7c/route-migration-design-mini-app`; awaiting review before main integration.

## Wave G - Ready Phase 7C Follow-On Work

- Specification packages: -
- Implementation packages: WP-7C-18
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run after dependencies and conflict checks: WP-7C-18
- Dependency note: WP-7C-18 depends on WP-7C-12 (integrated). Do not start until route migration review completes or is explicitly authorized from the integration branch.
- Migration owner constraints: WP-7C-24 (migration `0014`) is integrated; no Phase 7C migration owner is active.

## Later Wave 6

- Specification packages: -
- Implementation packages: WP-7C-19
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run after dependencies and conflict checks: WP-7C-19
- Dependency note: WP-7C-19 remains backlog until WP-7C-18 is integrated.

## Later Wave 7

- Specification packages: -
- Implementation packages: WP-7C-20
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7C-20

## Later Wave 8

- Specification packages: -
- Implementation packages: WP-7C-21
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7C-21

## Later Wave 9

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7C-22
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7C-22

## Later Wave 10

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7C-23
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7C-23

## Later Wave 11

- Specification packages: -
- Implementation packages: WP-7D-03
- Review / integration gates: -
- Migration owner constraints: WP-7D-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-7D-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 12

- Specification packages: -
- Implementation packages: WP-7D-04, WP-8F-02
- Review / integration gates: -
- Migration owner constraints: WP-8F-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7D-04, WP-8F-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 13

- Specification packages: -
- Implementation packages: WP-7D-05
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7D-05

## Later Wave 14

- Specification packages: -
- Implementation packages: WP-7D-06
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7D-06

## Later Wave 15

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7D-07
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7D-07

## Later Wave 16

- Specification packages: -
- Implementation packages: WP-7E-04
- Review / integration gates: -
- Migration owner constraints: WP-7E-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 17

- Specification packages: -
- Implementation packages: WP-7E-05
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-05

## Later Wave 18

- Specification packages: -
- Implementation packages: WP-7E-06
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-06

## Later Wave 19

- Specification packages: -
- Implementation packages: WP-7E-07
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-07

## Later Wave 20

- Specification packages: -
- Implementation packages: WP-7E-08
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-08

## Later Wave 21

- Specification packages: -
- Implementation packages: WP-7E-09
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-09

## Later Wave 22

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-7E-10
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7E-10

## Later Wave 23

- Specification packages: -
- Implementation packages: WP-7F-02
- Review / integration gates: -
- Migration owner constraints: WP-7F-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 24

- Specification packages: -
- Implementation packages: WP-7F-03
- Review / integration gates: -
- Migration owner constraints: WP-7F-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 25

- Specification packages: -
- Implementation packages: WP-7F-04, WP-8F-03
- Review / integration gates: -
- Migration owner constraints: WP-8F-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-04, WP-8F-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 26

- Specification packages: -
- Implementation packages: WP-7F-05, WP-7F-06, WP-8F-04
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-05, WP-7F-06, WP-8F-04

## Later Wave 27

- Specification packages: -
- Implementation packages: WP-8F-05
- Review / integration gates: WP-7F-07
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-7F-07, WP-8F-05

## Later Wave 28

- Specification packages: -
- Implementation packages: WP-7G-02
- Review / integration gates: WP-8F-06
- Migration owner constraints: WP-7G-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7G-02, WP-8F-06
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 29

- Specification packages: -
- Implementation packages: WP-7G-03, WP-7I-02, WP-10-03
- Review / integration gates: -
- Migration owner constraints: WP-7I-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7G-03, WP-7I-02, WP-10-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 30

- Specification packages: -
- Implementation packages: WP-7G-04, WP-7I-03, WP-7I-04, WP-10-01
- Review / integration gates: -
- Migration owner constraints: WP-10-01
- Packages that may run simultaneously after dependencies and conflict checks: WP-7G-04, WP-7I-03, WP-7I-04, WP-10-01
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 31

- Specification packages: -
- Implementation packages: WP-7G-05, WP-10-04
- Review / integration gates: WP-7I-05
- Migration owner constraints: WP-10-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-7G-05, WP-7I-05, WP-10-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 32

- Specification packages: -
- Implementation packages: WP-7H-02
- Review / integration gates: -
- Migration owner constraints: WP-7H-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7H-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 33

- Specification packages: -
- Implementation packages: WP-7H-03, WP-8A-02
- Review / integration gates: -
- Migration owner constraints: WP-8A-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-7H-03, WP-8A-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 34

- Specification packages: -
- Implementation packages: WP-7H-04, WP-8A-03
- Review / integration gates: -
- Migration owner constraints: WP-8A-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-7H-04, WP-8A-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 35

- Specification packages: -
- Implementation packages: WP-7H-05, WP-8A-04
- Review / integration gates: -
- Migration owner constraints: WP-8A-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-7H-05, WP-8A-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 36

- Specification packages: -
- Implementation packages: WP-8A-05
- Review / integration gates: -
- Migration owner constraints: WP-8A-05
- Packages that may run simultaneously after dependencies and conflict checks: WP-8A-05
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 37

- Specification packages: -
- Implementation packages: WP-8A-06, WP-8C-02
- Review / integration gates: -
- Migration owner constraints: WP-8C-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-8A-06, WP-8C-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 38

- Specification packages: -
- Implementation packages: WP-8C-03, WP-8C-04, WP-8C-05, WP-8E-02
- Review / integration gates: WP-8A-07
- Migration owner constraints: WP-8E-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-8A-07, WP-8C-03, WP-8C-04, WP-8C-05, WP-8E-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 39

- Specification packages: -
- Implementation packages: WP-8B-02, WP-8C-06, WP-8D-02, WP-8E-03
- Review / integration gates: -
- Migration owner constraints: WP-8D-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-02, WP-8C-06, WP-8D-02, WP-8E-03
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 40

- Specification packages: -
- Implementation packages: WP-8B-03, WP-8D-03, WP-8E-04
- Review / integration gates: WP-8C-07
- Migration owner constraints: WP-8D-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-03, WP-8C-07, WP-8D-03, WP-8E-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 41

- Specification packages: -
- Implementation packages: WP-8B-04, WP-8D-04, WP-8D-05, WP-10-05
- Review / integration gates: WP-8E-05
- Migration owner constraints: WP-10-05
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-04, WP-8D-04, WP-8D-05, WP-8E-05, WP-10-05
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 42

- Specification packages: -
- Implementation packages: WP-8B-05, WP-8G-02, WP-9-02, WP-10-06
- Review / integration gates: WP-8D-06
- Migration owner constraints: WP-10-06
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-05, WP-8D-06, WP-8G-02, WP-9-02, WP-10-06
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 43

- Specification packages: -
- Implementation packages: WP-8B-06, WP-8G-03, WP-9-03, WP-10-07
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-06, WP-8G-03, WP-9-03, WP-10-07

## Later Wave 44

- Specification packages: -
- Implementation packages: WP-8G-04, WP-9-04, WP-10-08
- Review / integration gates: WP-8B-07
- Migration owner constraints: WP-8G-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-8B-07, WP-8G-04, WP-9-04, WP-10-08
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 45

- Specification packages: -
- Implementation packages: WP-9-05
- Review / integration gates: WP-8G-05
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8G-05, WP-9-05

## Later Wave 46

- Specification packages: -
- Implementation packages: WP-8H-02, WP-9-06
- Review / integration gates: -
- Migration owner constraints: WP-8H-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-02, WP-9-06
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 47

- Specification packages: -
- Implementation packages: WP-8H-03
- Review / integration gates: WP-9-07
- Migration owner constraints: WP-8H-03
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-03, WP-9-07
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 48

- Specification packages: -
- Implementation packages: WP-8H-04
- Review / integration gates: -
- Migration owner constraints: WP-8H-04
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-04
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 49

- Specification packages: -
- Implementation packages: WP-8H-05
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-05

## Later Wave 50

- Specification packages: -
- Implementation packages: WP-8H-06
- Review / integration gates: -
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-06

## Later Wave 51

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-8H-07
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-8H-07

## Later Wave 52

- Specification packages: -
- Implementation packages: WP-10-02
- Review / integration gates: -
- Migration owner constraints: WP-10-02
- Packages that may run simultaneously after dependencies and conflict checks: WP-10-02
- Serialization note: this wave has exactly one migration owner; any other ready migration owner waits for a later wave.

## Later Wave 53

- Specification packages: -
- Implementation packages: -
- Review / integration gates: WP-10-09
- Migration owner constraints: -
- Packages that may run simultaneously after dependencies and conflict checks: WP-10-09
