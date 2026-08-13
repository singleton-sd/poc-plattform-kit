# 0002: OpenFGA for fine-grained authorization, separate from Entra coarse roles

## Status

Accepted.

## Context

The platform needs two different kinds of access control:

1. **Coarse roles** — "is this user a tenant-admin / support-agent at all?"
   This maps naturally onto Entra ID app roles and is a cheap claim check.
2. **Fine-grained, relationship-based authorization** — "can *this* user
   perform *this* action on *this specific resource* in *this* tenant?" —
   e.g. tenant membership, ownership chains, manager-of-manager
   relationships, time-bound one-time grants. Azure has no first-class,
   general-purpose app-data authorization service for this (Entra app roles
   and Azure RBAC both stop at the coarse level; they don't model
   per-resource relationships).

Without a dedicated engine, that fine-grained logic tends to get
reimplemented ad hoc inside each pillar (`if (user.tenantId === resource
.tenantId && ...)`), which duplicates authorization logic across pillars,
makes it hard to audit "who can do what" as one coherent model, and makes
relationship-based rules (manager chains, transitive grants) awkward to
express as scattered boolean conditions.

## Decision

Fine-grained authorization is centralized in the **Permissions** pillar,
which wraps **OpenFGA** (a Zanzibar-style relationship-based access control
engine) running on Azure Container Apps Consumption. Every other pillar
calls `Check(subject, action, resource)` against Permissions instead of
embedding its own authorization rules. Coarse Entra roles remain a
first-line `@Roles(...)` guard in front of the fine-grained check, not a
replacement for it. Permission denials may optionally emit an Audit event.

## Alternatives considered

- **Auth0 FGA / Permit.io** (managed ReBAC-as-a-service). Rejected for this
  PoC: adds another paid vendor dependency where OpenFGA (open source, same
  Zanzibar model) self-hosts on infrastructure already in the stack (ACA
  Consumption), keeping the cost-lock cheapest-SKU posture intact. Revisit
  only if self-hosting OpenFGA becomes an operational burden.
- **Flat SQL ACL tables per pillar** (a `permissions` table with
  `userId, resourceId, action` rows, queried directly). Rejected: doesn't
  scale to relationship-based rules (transitive manager chains, group
  membership) without hand-rolling recursive queries, and re-embeds
  authorization logic per pillar rather than centralizing it.
- **Azure RBAC / Entra app roles for domain-object authorization.**
  Rejected: these model access to Azure resources and coarse application
  roles, not arbitrary in-app resource relationships; there's no way to
  express "user X can edit ticket Y because X is a manager of Y's owner"
  in either system.

## Consequences

- Every pillar exposing a protected action must register it with the
  Permissions manifest (`pnpm permissions:register`) and call `Check()` —
  see [`docs/permissions.md`](../permissions.md) for the exact workflow and
  drift check (`pnpm permissions:check`).
- OpenFGA becomes a runtime dependency for any protected request path; the
  PoC datastore is SQLite on ACA `EmptyDir` with a single replica (Azure
  Files SMB cannot reliably host SQLite's locking model at OpenFGA's
  latency budget) — see `infra/README.md` § Permissions / OpenFGA for the
  exact constraint and the reserved Azure Files share for a future
  backup/Postgres follow-up.
- Ephemeral PR API preview identities are intentionally **not** granted
  OpenFGA access in this PoC, so `Check()` stays fail-closed on previews
  until a follow-up widens that allowlist — a preview can prove the
  authorization call is made, not that it returns `true` for a real grant.
- Denying by default when Permissions is unreachable is the safe failure
  mode; pillars must not fall back to "allow" if the `Check()` call fails.

## References

- `AGENTS.md` § Architecture (AuthZ line)
- [`docs/permissions.md`](../permissions.md) (manifest workflow, checklist)
- `infra/README.md` § Permissions / OpenFGA (locked) (datastore, AuthN,
  model, bootstrap)
- `infra/openfga/model.fga` (authorization model)
- `pillars/permissions/README.md`
