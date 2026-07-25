# Integration Rules

Dynaxis implementation flows through this sequence:

```text
Work Package
-> isolated branch
-> implementation
-> validation
-> review
-> integration
-> main
```

## Dependency Rules

- Dependent packages cannot start implementation until dependencies are integrated unless explicitly designated specification-only.
- Specification work can happen ahead of runtime dependencies when it is marked specification-only and does not modify product runtime code.
- Database migration number ownership must be serialized.
- Shared central schema files require explicit ownership.
- Conflicting agent changes never get automatically merged.
- Integration branch or pull request is reviewed before `main`.
- The user is the final merge authority.

## Integration Expectations

Before a Work Package enters review:

- the assigned branch must contain only scoped changes;
- validation commands listed in the Work Package must pass or be reported with exact failures;
- migration ownership status must be stated;
- contract changes must be explicitly called out;
- the working tree must be clean unless the Work Package is blocked.

No agent may approve, merge, or silently broaden its own implementation.
