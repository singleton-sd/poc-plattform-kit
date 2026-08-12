# Secure tenant-scoped support-user impersonation discovery

**Status:** Proposed ADR for consolidation  
**Workstream:** C — secure, tenant-scoped support-user impersonation  
**Parent:** “Design customer support, diagnostic error handling, and secure user impersonation”  
**Scope:** Discovery only; this document does not implement impersonation.

## 1. Decision summary

Version one will provide **read-only, ticket-bound, tenant-scoped support access**, not unrestricted identity substitution.

1. A support agent authenticates normally with Entra and must have the coarse `support-agent` role.
2. Starting a session also requires all of:
   - an active support ticket belonging to the target tenant;
   - a non-blank written reason (20–500 characters after trimming);
   - an explicit, unexpired OpenFGA tenant grant for that exact support user;
   - an identified customer user who is an active member of that tenant; and
   - no other active impersonation session for that authenticated actor.
3. The server creates a short-lived, revocable database session and returns only an opaque credential in a `Secure`, `HttpOnly` cookie. It never accepts a client-supplied effective user or tenant on subsequent requests.
4. Every request first authenticates the support user, then resolves and validates the server session. Request context preserves both identities. Authorization is the intersection of a hard-coded read-only impersonation policy and the effective customer's normal permissions.
5. The UI shows a persistent, unmistakable banner with tenant, customer identity, expiry, ticket link, and an always-available exit control. Closing a tab is not considered stopping a session.
6. Start, use, refresh, stop, expiry, revocation, and denied attempts are audit and telemetry events. No tokens, cookies, raw request/response bodies, or unrestricted PII are recorded.

**Explicit non-decision:** write-capable impersonation is not a configurable v1 option. It requires a new threat review and ADR.

## 2. Shared contract and terminology

These terms are normative across the support, error-contract, and impersonation workstreams.

| Term | Definition |
| --- | --- |
| `tenantId` | Immutable platform `Tenant.id`. It is derived by the server and is never a request header, query parameter, editable local-storage value, or otherwise client-selected for impersonation. |
| `authenticatedActor` | Principal established by server authentication. During impersonation this remains the support user and is never overwritten. Canonical ID is the persisted platform `User.id`; Entra `oid` is an authentication attribute, not the long-term domain key. |
| `effectiveActor` | Customer principal used only during a valid server-issued impersonation session. Outside impersonation it equals `authenticatedActor`. It never changes who performed the action in audit. |
| `actorMode` | `self` or `impersonated`; a server-derived request-context discriminator. |
| `impersonationSessionId` | Server-generated opaque identifier for a persisted session. Only a one-way hash of the browser credential is stored. |
| `traceId` | W3C trace identifier used by OpenTelemetry/Application Insights. |
| `correlationId` | Public opaque diagnostic lookup identifier mapped server-side to `traceId`; it is not itself authority. |
| `errorCode` | Stable, namespaced machine code from the shared API error contract. |

Canonical request context proposed for Phase 1:

```ts
type ActorRef = { userId: string; tenantId: string | null };

type ActorContext = {
  authenticatedActor: ActorRef;
  effectiveActor: ActorRef;
  actorMode: 'self' | 'impersonated';
  impersonationSessionId?: string;
  supportTicketId?: string;
};
```

The context is immutable after guards/interceptors establish it. Domain services receive it through a server-owned request context, not DTO fields.

## 3. Repository and architecture evidence

### Verified behavior

- Entra JWT validation maps `oid`/`sub`, email, coarse roles, and an optional platform `tenant_id` into `AuthenticatedUser`. The ID currently falls back to Entra `oid` unless a local user ID is supplied.
- The global authentication path supports Auth.js cookies or Entra bearer tokens; `@Roles` accepts any matching coarse role. `/api/me` exposes only one user identity today.
- Tenancy is stored in `AsyncLocalStorage`. Existing middleware prefers a token/session tenant claim but falls back to `x-tenant-id`; a later interceptor lets a JWT claim override that header.
- Tenant list is coarse-role protected for `support-agent`. Tenant reads accept the legacy header tenancy escape. Tenant update also requires `tenant-admin` and, when OpenFGA is configured, a fine-grained `update` check.
- The web support page currently gates on the coarse `support-agent` role and lets an agent type a tenant ID; it configures the generated API client to send `x-tenant-id`.
- The current OpenFGA model has `tenant` relations `admin`, `member`, and CRUD-like actions, including conditional temporary grants. `PermissionsService` fails closed on an OpenFGA error, but the API guard deliberately bypasses fine-grained checks while OpenFGA is unconfigured and maps only `PATCH /tenants/:id`.
- Prisma has `User`, `Tenant`, `TenantMembership`, and per-pillar Outbox/Audit foundations. Support has no ticket or impersonation domain tables. Local Audit has one `actorId`; the cross-pillar Audit consumer is a storage stub and its normalized record has no actor identity.
- Telemetry uses Azure Monitor/OpenTelemetry and documents correlation/trace, tenant when known, and no raw PII/secrets. Current correlation middleware accepts arbitrary inbound `x-correlation-id` or even `traceparent` as the same value.

### Architectural constraints applied

- AuthN/coarse roles remain in SingleSignOn; fine-grained authorization is owned by Permissions/OpenFGA.
- Support owns support-ticket and impersonation-session lifecycle data. Mutations persist entity + local Audit + Outbox atomically.
- Pillars do not cross-pillar join or perform write HTTP calls. Support stores immutable reference IDs and uses explicit service contracts/events rather than foreign-key joins across pillar boundaries.
- Domain audit is durable database data; Application Insights is operational telemetry, not the audit source of truth.

### Contradictions and gaps requiring consolidation

1. **Normative tenant contract versus current code:** shared terminology forbids client-selected tenant IDs, while the current middleware, generated client, tenant controllers, and support UI intentionally support `x-tenant-id`. Impersonation must not reuse this escape. Phase 1 must introduce server-derived actor/tenant context, and the eventual removal or strict dev-only containment of `x-tenant-id` needs an explicit migration ticket.
2. **Persistent user ID versus current fallback:** this design requires canonical `User.id`, but current auth commonly uses Entra `oid`. The tracked “Persist SSO User locally on sign-in” work is a hard dependency; session creation must fail closed if either actor cannot be resolved to a local user.
3. **Fine-grained fail-closed claim versus guard behavior:** `PermissionsService` fails closed, but `PermissionsGuard` currently allows mapped requests when OpenFGA is not configured. Impersonation start/use must never take that bypass; unavailable or unconfigured OpenFGA means deny.
4. **Audit requirements versus current schemas:** one `actorId` and the normalized cross-pillar record cannot preserve authenticated actor, effective actor, session, reason, and outcome. Shared audit-contract work must land first.
5. **Support ticket prerequisite versus current persistence:** no ticket model exists. Impersonation cannot be enabled until the support-ticket API exposes a server-to-server eligibility check or equivalent Support-owned transaction boundary.
6. **Trace/correlation distinction versus middleware:** current middleware conflates caller-provided correlation and `traceparent`. The shared correlation foundation must validate/generate public IDs and obtain the W3C trace ID from the active span.
7. **Architecture source availability:** the repository mirror and parent ticket contained the evidence above; the linked ClickUp Architecture Doc must be checked during consolidation for newer decisions. Any conflict must be recorded rather than silently overwritten.

## 4. Scope and invariants

### In scope for v1

- Support-agent initiated, read-only customer view within one tenant.
- Ticket-bound reason, explicit tenant access grant, maximum duration, refresh, revocation, exit, banner, audit, telemetry, notifications, and security tests.
- Customer selection from server-authorized ticket participants/members, never a free-form user ID.

### Out of scope

- Acting as an anonymous user, service principal, tenant administrator, or another support agent.
- Writes of any kind while impersonating, including indirect writes such as exports, downloads that enqueue jobs, notification sends, access-request approval, password/security changes, and analytics tracking that changes domain state.
- Concurrent/nested impersonation, cross-tenant sessions, background-job delegation, API keys, mobile/offline sessions, and “remember this tenant/user.”
- Screen sharing or remote-control tooling.

### Non-bypassable invariants

- `authenticatedActor.userId !== effectiveActor.userId` in impersonated mode.
- Both users are active; effective user has active membership in exactly the session tenant.
- Ticket tenant, grant tenant, session tenant, route resource tenant, and effective membership tenant must match.
- An impersonation session never creates broader access than the customer has.
- The authenticated support actor is the `actor` for audit; the customer is always explicitly the `effectiveActor`.
- Session expiry can only stay the same or be shortened by policy change; refresh never exceeds the absolute lifetime.
- Deny on missing context, ambiguity, stale membership, closed ticket, revoked grant, revoked session, failed dependency, or unsupported route.

## 5. Threat model

### Assets and trust boundaries

Assets are tenant data, customer identity, support grants, active-ticket evidence, session credentials, audit history, and customer trust. Trust boundaries exist between browser and API, Entra and API, API and OpenFGA, API and Azure SQL, Support and other pillars, and runtime telemetry/exporters.

| Threat | Example attack | Required control / verification |
| --- | --- | --- |
| Identity spoofing | Browser sends `effectiveUserId`, tenant header, query ID, or edits local storage. | No such identity fields in use APIs; resolve an opaque HttpOnly cookie to a server row; authenticate support actor separately on every request. Negative E2E mutates every client-visible value. |
| Tenant confused deputy | Agent starts for tenant A then calls a tenant B resource. | Session tenant is authoritative; resource-to-tenant resolution is server-side; require exact equality before data access; composite tenant filters in every repository. |
| Privilege escalation | Read-only UI calls hidden `POST`, GraphQL mutation, export, or queue endpoint. | Default-deny impersonation route policy; allowlist safe `GET`/`HEAD` operations by operation ID, not verb alone; intersect with effective user's OpenFGA decision. |
| Grant bypass | OpenFGA unavailable/config missing, coarse role alone accepted. | Dedicated fail-closed checks on start and each use/short cache interval; no current guard bypass. Alert dependency failures. |
| Ticket laundering | Closed/unrelated ticket used or ticket moved across tenant. | Resolve ticket server-side; require eligible state and same tenant; revoke sessions on ticket close/tenant change; immutable tenant on ticket. |
| Session theft/replay | Credential leaked via XSS, logs, telemetry, or another actor. | 256-bit opaque credential; HttpOnly/Secure cookie; hash at rest; bind to authenticated support `User.id`; rotate on refresh; never log; revoke previous hash atomically. |
| CSRF | Malicious origin starts/refreshes/stops a session using cookies. | Existing Entra authentication plus strict CORS origin, `SameSite` appropriate to deployed host topology, Origin validation, and CSRF token for cookie-authenticated lifecycle mutations. |
| Session fixation | Attacker supplies a known session ID. | Server always generates credential after authorization; ignore/delete pre-existing invalid cookie; rotate at start and refresh. |
| Repudiation | Agent denies starting or reading customer records. | Same-transaction immutable local Audit and Outbox; authenticated/effective IDs, reason, ticket, grant, outcome, operation, trace/correlation; append-only audit access restricted. |
| Information disclosure | Banner/API/telemetry leaks customer email or ticket text. | Minimal display name plus masked identifier; no ticket body/reason in telemetry; audit reason is classified restricted; DTO allowlists; no raw bodies, tokens, cookies, arbitrary headers, stack traces, secrets, or unrestricted PII. |
| Enumeration | Agent guesses ticket/customer/session IDs. | Server-provided eligible-customer picker; opaque IDs; non-disclosing 404/403 policy; rate limits and anomaly alerts. |
| Stale authorization | Grant/member/ticket revoked while session remains active. | Revalidate critical facts every request or with a maximum 60-second positive authorization cache plus event-driven invalidation; revocation endpoint and deny on cache uncertainty. High-risk routes recheck synchronously. |
| Race / TOCTOU | Ticket closes between eligibility check and session insert. | Support-owned transaction/optimistic version check for ticket + session creation; recheck on first and every use. |
| Availability abuse | Many sessions/checks overload OpenFGA or database. | One active session per support actor; start/refresh rate limits; indexed lookups; bounded cache; fail closed and alert without retry storms. |
| Audit poisoning | Reason contains markup/control data or fake correlation IDs. | Length/character validation, encode on display, structured fields, server-generated correlation mapping. |

Residual risk: a legitimately authorized agent can view data visible to the selected customer. Explicit tenant grants, active tickets, notification, short duration, and audit reduce—but cannot eliminate—insider risk.

## 6. Authorization model and permission matrix

### Coarse role and proposed OpenFGA relations

Keep Entra `support-agent` as coarse admission only. Extend the model with explicit tenant-scoped support relations (names to be finalized once against the Architecture Doc):

```fga
type tenant
  relations
    define support_grantor: [user] or admin
    define support_access: [user with not_yet_expired]

type support_ticket
  relations
    define tenant: [tenant]
    define requester: [user]
    define assigned_agent: [user]
    define impersonate: assigned_agent and support_access from tenant
```

OpenFGA model syntax/relationship feasibility must be validated with model tests. If ticket state cannot safely be expressed in OpenFGA, Support must check active state in its database in addition to `user:<agent> support_access tenant:<tenant>`. Ticket assignment is recommended, but a configurable support-queue policy may allow any explicitly granted agent; product/security must choose before implementation.

Grant rules:

- Only tenant admin/owner (or a narrowly defined platform security administrator break-glass workflow) may grant/revoke.
- Grant is always to one support `User.id`, one tenant, with maximum expiry; no group/wildcard/platform-wide tuple in v1.
- Grant UI requires confirmation, reason, and expiry. Grant/revoke is audited and not allowed while impersonating.
- Recommended maximum grant lifetime: 30 days; recommended default: 24 hours. Security must approve.

### Request permission matrix

| Capability | Customer/self | Support, no session | Support, active impersonation | Tenant admin/grantor |
| --- | --- | --- | --- | --- |
| View own allowed tenant data | Normal policy | No | Yes, only intersection with effective customer + read allowlist | Normal policy |
| List/search tenants | Normal policy | Existing coarse support behavior; should become explicit platform permission | No tenant switching inside session | Normal policy |
| Start impersonation | No | `support-agent` + ticket + reason + exact `support_access` + assignment policy | No nested start | No unless also support actor |
| Refresh own session | No | No | Authenticated actor only, all prerequisites rechecked | No |
| Stop own session | No | No | Always; stop should remain available if dependencies fail | No |
| Revoke another actor's session | No | Security/support supervisor permission | No | Explicit `impersonation:revoke`, tenant scoped |
| Grant/revoke support access | No | No | Prohibited | Explicit tenant `support_grantor` |
| Mutate domain data | Normal policy | Normal support tools only | **Always deny** | Normal policy |
| Read audit/diagnostic secrets | Policy-specific | Separate support permission | Never inherited from customer | Policy-specific |

Authorization algorithm for every impersonated request:

1. Authenticate `authenticatedActor` from Entra/Auth.js and require `support-agent`.
2. Resolve cookie hash to an active session bound to that actor.
3. Revalidate time, revocation, ticket state/tenant, grant, actor status, customer status/membership.
4. Resolve the requested resource's `tenantId` server-side and compare with session tenant.
5. Match Swagger operation ID against the reviewed read-only allowlist. Unlisted is deny even if `GET`.
6. Check the normal effective-customer OpenFGA action/resource decision.
7. Execute with immutable dual-actor context and tenant-constrained repository query.

## 7. Session and credential design

### Persistence model (Support-owned Prisma migration)

Proposed `SupportImpersonationSession` fields:

| Field | Notes |
| --- | --- |
| `id` | CUID/UUID opaque domain ID; never accepted as authority by itself. |
| `credentialHash` | Unique keyed hash/HMAC of random 256-bit credential; raw value never stored. |
| `tenantId` | Immutable `Tenant.id` reference value; indexed. |
| `supportTicketId` | Immutable Support-owned ticket ID; indexed. |
| `authenticatedActorId` | Persisted support `User.id`; indexed. |
| `effectiveActorId` | Persisted customer `User.id`; indexed. |
| `reason` | Restricted audit data, 20–500 chars, sanitized/encoded at output. |
| `grantEvidence` | Minimal tuple/model ID or decision reference, not a token or full OpenFGA response. |
| `status` | `ACTIVE`, `STOPPED`, `REVOKED`, `EXPIRED`; state transition enforced by service. |
| `createdAt`, `lastUsedAt`, `expiresAt`, `absoluteExpiresAt` | UTC server timestamps. |
| `stoppedAt`, `revokedAt`, `revokedBy`, `revocationReason` | Nullable terminal evidence. |
| `version` | Optimistic concurrency for rotate/revoke races. |

Recommended session idle lifetime is 15 minutes, renewable while active; absolute lifetime is 60 minutes. Refresh when less than 5 minutes remain, but never extend absolute expiry. These values belong in platform App Configuration with stricter platform values overriding tenant preferences; they cannot be loosened by user preference. Final numbers require security approval.

Cookie proposal: `__Host-pocpk-impersonation`, `Secure`, `HttpOnly`, `Path=/`, no `Domain`, short `Max-Age`; use `SameSite=None` only if the separate app/API host topology requires cross-site treatment and only with strict allowed-origin/CSRF controls. Never expose it to JavaScript, local/session storage, URLs, response JSON, logs, or telemetry. The normal Entra/Auth.js credential still authenticates the support actor; the impersonation cookie cannot authenticate by itself.

### Start sequence

1. Agent opens an active ticket and chooses “View as customer.” UI obtains eligible customers from a server endpoint scoped to that ticket; no free-form user ID.
2. Agent supplies the written reason and confirms tenant/customer/expiry.
3. `POST /support/impersonation-sessions` accepts `ticketId`, an opaque server-issued eligible-customer selection token or selected ticket participant ID, and `reason`; it does **not** accept `tenantId`.
4. Server authenticates actor, checks coarse role, resolves local user, ticket/tenant/customer, assignment policy, rate limit, and fail-closed OpenFGA tenant grant.
5. Server re-verifies no other active session exists for that authenticated actor and rejects the request with a conflict Problem Details response if one does. In one Support transaction, create the session, local Audit and Outbox event. Generate/set the cookie only after commit.
6. Response returns a safe view (`expiresAt`, masked actor display, tenant display, ticket reference, read-only flag), not credential or unrestricted PII.
7. UI clears tenant-header client state, refetches `/api/me` or `/api/actor-context`, discards caches, navigates to an allowlisted landing page, and displays banner before customer data renders.

### Use sequence

1. Normal auth establishes support `authenticatedActor`.
2. Impersonation guard hashes cookie and loads session by credential + support actor.
3. It runs the seven authorization steps above; failures clear the cookie where safe and return the shared Problem Details code (`impersonation.session_expired`, `.revoked`, `.not_authorized`, or generic non-disclosing equivalent).
4. Actor/tenant context is attached server-side. Domain repositories use session tenant and effective user from context only.
5. A sampled/batched `lastUsedAt` update must not turn otherwise read-only customer requests into noisy audit mutations. Security-significant use events are auditable; operational spans carry only safe IDs.

### Refresh sequence

1. UI requests refresh over CSRF-protected `POST` before idle expiry.
2. Server repeats every start prerequisite and verifies optimistic version.
3. It creates a new random credential/hash, invalidates the old hash atomically, advances idle expiry within absolute expiry, records audit, and sets a replacement cookie.
4. Replay of the old credential fails; a refresh race has one winner.

### Stop, revoke, and expiry

- `DELETE /support/impersonation-sessions/current` is always available to the bound actor, even if ticket/OpenFGA dependencies are down. It atomically marks stopped, audits, emits an event, and expires the cookie. UI clears all query/cache state before returning to support workspace.
- Revocation requires a tenant-scoped supervisor/security permission. Ticket close, tenant-grant revoke, user disablement, membership removal, or security automation should publish/consume an idempotent revoke command/event. Each request remains the final enforcement point.
- Expired rows are terminal on use or a scheduled sweeper. A stale/missing cookie yields normal self context; a cookie naming a terminal session yields a safe expired/revoked response on impersonation-only routes and must never fall back silently while rendering a customer page.
- Logout revokes or stops the actor's active session and clears the cookie.

## 8. Prohibited action policy

While `actorMode=impersonated`, default deny all operations except a reviewed, generated allowlist of side-effect-free reads and session stop/refresh. Specifically prohibited:

- all `POST`, `PUT`, `PATCH`, and domain `DELETE` operations (session stop is the explicit exception);
- tenant/user/contact/subscription create, update, delete, invitation, role or permission changes;
- password, MFA, SSO, consent, API-key, secret, billing, payment, and security-setting access or changes;
- support-ticket notes/replies/status changes in customer identity (agent can exit and use agent tools);
- notification/email/SMS/WhatsApp sends or resend actions;
- access approval, OpenFGA grant/revoke/check-as-user administration, or audit deletion/export;
- file upload, bulk export, report generation, webhook/test actions, job enqueue, or signed-download creation;
- any read whose implementation has write side effects beyond bounded telemetry (for example marking messages read);
- WebSocket subscription, service-worker queued/offline requests, background jobs, and cached mutation replay;
- any endpoint not explicitly classified and tested as safe.

The API—not disabled buttons—enforces this. CI compares the OpenAPI operation inventory with the impersonation allowlist and fails when a new route lacks an explicit `allow-read` or `deny` classification.

## 9. UI requirements

- The banner is rendered by the authenticated app shell before route content and cannot be dismissed. Use token CSS/Tailwind, a high-contrast icon/text treatment, and screen-reader announcement.
- It states: “Viewing as [masked customer] in [tenant] — read only,” remaining time, ticket reference, and “Exit customer view.” Never show the full reason.
- All write controls are removed or disabled with an explanation, but this is defense in depth only.
- Cross-tenant navigation, tenant picker, support administration, and normal agent ticket mutation tools are unavailable until exit.
- On expired/revoked session, block customer content, clear caches, show a modal explaining that access ended, and offer return to support. Do not silently show cached customer data under self mode.
- Prevent persisted customer data in local storage/service-worker caches. Query keys include actor mode/session generation and are purged on start/stop/revoke. Back-button pages must revalidate context.
- Opening a second tab displays the same banner after context fetch; stopping in one tab broadcasts a cache purge/redirect without storing identity authority in browser storage.

## 10. Audit, events, and telemetry

### Durable audit schema

Extend the shared audit contract rather than placing dual identity in an unstructured `changes` blob:

```ts
type ImpersonationAudit = {
  eventId: string;
  eventType:
    | 'support.impersonation_started'
    | 'support.impersonation_used'
    | 'support.impersonation_refreshed'
    | 'support.impersonation_stopped'
    | 'support.impersonation_revoked'
    | 'support.impersonation_expired'
    | 'support.impersonation_denied';
  occurredAt: string;
  tenantId: string;
  authenticatedActorId: string;
  effectiveActorId?: string;
  impersonationSessionId?: string;
  supportTicketId?: string;
  reasonCode: string;
  reasonText?: string; // restricted; start/grant/revoke only, never telemetry
  operationId?: string;
  resourceType?: string;
  resourceIdHash?: string;
  outcome: 'allowed' | 'denied' | 'stopped' | 'expired' | 'revoked';
  correlationId: string;
  traceId: string;
};
```

Start/refresh/stop/revoke mutations write session + `SupportAudit` + `SupportOutbox` in one transaction. Used events may be aggregated to a bounded per-operation/time-window audit record to control volume only if security approves; start/stop/denial are never sampled. Event payloads use IDs and classifications, never token/cookie, request/response body, arbitrary headers, ticket text, customer email, stack trace, raw SQL, or secrets.

### Application Insights/OpenTelemetry

Safe span/log dimensions: cloud role, `actorMode`, session ID hashed/pseudonymous, tenant ID (per existing convention, subject to telemetry classification approval), ticket ID hash, operation ID, allow/deny outcome, stable reason/error code, correlation ID, trace ID, remaining-duration bucket, and dependency result. Do not put names, emails, written reasons, customer record IDs, grant payloads, or session credentials in telemetry.

Metrics and alerts:

- active session count; start/stop/revoke/expiry/denial counts;
- denied cross-tenant and prohibited-operation attempts (immediate security alert threshold ≥1);
- repeated invalid/replayed credentials, refresh races, and start rate-limit breaches;
- sessions exceeding expected duration or missing stop/expiry audit;
- OpenFGA/ticket dependency failures and revocation latency.

Audit retention must meet the platform security/legal policy and should exceed support-ticket retention; proposed minimum is 365 days, while operational App Insights follows the documented 30-day workspace retention. Product/security/legal must approve the audit value and access model.

## 11. Customer notification recommendation

**Recommended default:** notify the affected customer and tenant admins on session start and end/revoke/expiry through the Notifications pillar, with in-portal history and email by preference. Include time, tenant, generic support-agent label, ticket reference, reason category, and how to report concern; do not include the private reason or sensitive agent/customer data.

Allow delayed notification only for an approved fraud/security investigation policy, requiring security authorization, expiry, written justification, and an audit event. Do not let individual agents suppress notification. Notification delivery failure does not retroactively authorize/deny a valid session, but is audited, retried through Notifications, and visible to supervisors. Product/security must approve whether start notification is mandatory before v1 launch.

## 12. Limits, retention, and operational controls

- One active session per authenticated support actor; one agent/customer/ticket/tenant per session.
- Suggested limits: 5 start attempts per actor per 15 minutes, 20 per day, 6 refreshes per session; stricter tenant/platform security configuration wins. Return safe `429` Problem Details and audit repeated abuse.
- Terminal session rows: proposed 90-day operational retention; immutable security audit: proposed ≥365 days. Credential hashes may be purged shortly after terminal transition while audit remains.
- Background sweeper expires sessions idempotently; reconciliation detects active rows past expiry and missing outbox/audit records.
- Operational runbook covers emergency global disable (platform App Configuration kill switch), actor/tenant/session revoke, alert investigation, evidence preservation, and customer communication.
- Kill switch and dependency failure always prevent start/refresh/use but never prevent stop or cookie clearing.

## 13. API and generated-client surface

Proposed endpoints (final versioning follows the shared API contract):

| Method/path | Purpose |
| --- | --- |
| `GET /support/tickets/{ticketId}/impersonation-eligibility` | Agent-safe eligibility, tenant display, server-authorized candidate customers, grant/ticket blockers. |
| `POST /support/impersonation-sessions` | Start from ticket + selected eligible customer + reason; tenant is derived. |
| `GET /support/impersonation-sessions/current` | Safe actor context/banner data. |
| `POST /support/impersonation-sessions/current/refresh` | Rotate credential and renew within absolute expiry. |
| `DELETE /support/impersonation-sessions/current` | Stop current session. |
| `POST /support/impersonation-sessions/{id}/revoke` | Supervisor/security revocation with reason. |

All DTOs use strict allowlists/validation. Swagger describes cookie/CSRF requirements, dual-actor semantics, read-only errors, and Problem Details. Any API implementation ticket must run `pnpm openapi:export && pnpm openapi:generate`, commit `packages/api-client/openapi.json` and generated Orval output, and update frontend against generated types. Do not add `tenantId`, effective user ID, credential, or identity headers to client configuration.

## 14. Test strategy and acceptance gates

### Unit and contract tests

- Actor context keeps authenticated and effective actors distinct and immutable; self mode collapses them correctly.
- Session state machine permits only active → stopped/revoked/expired terminal transitions; expiry/refresh boundaries use a fake clock.
- Credential generation entropy, HMAC lookup, constant-time comparison where applicable, rotation, replay denial, and no credential serialization/logging.
- Eligibility requires role, ticket state, reason bounds, assignment rule, tenant grant, local users, customer membership, and matching tenant; each failure denies.
- Operation classifier defaults deny and exhaustively classifies every OpenAPI operation.
- Redaction tests snapshot audit/telemetry and prove absence of tokens, cookies, bodies, arbitrary headers, reasons in telemetry, email/name, stack traces, secrets, raw SQL, and unrestricted PII.

### Integration and authorization tests

- Prisma forward-only migration, indexes, unique active-session invariant, optimistic refresh/revoke races, same-transaction session/audit/outbox rollback.
- OpenFGA model tests for exact actor/tenant, expiry boundary, revoked/missing tuple, unrelated tenant, wildcard absence, and service outage (fail closed).
- Active ticket in tenant A cannot authorize tenant B/customer B; closed/resolved/deleted/moved ticket denies and revokes.
- Every repository query includes server-derived tenant and effective-customer authorization; ID guessing returns no cross-tenant existence signal.
- Customer can read only what their normal OpenFGA policy allows; support role never expands it.
- Every prohibited endpoint returns `403` even with direct HTTP calls and regardless of hidden UI.
- Stop succeeds during OpenFGA/Support dependency outage; start/use/refresh fail closed.

### End-to-end security tests

- Start from eligible ticket, see banner before data, read allowed record, refresh/rotate, exit, caches purge, and old credential fails.
- Tamper tenant header, query, route ID, body user/tenant, cookie/session ID, local storage, bearer identity, Origin/CSRF, and `traceparent`; none changes context or crosses tenant.
- XSS-oriented test proves HttpOnly cookie unavailable and reason/banner output encoded; CSP remains effective.
- Two-tab stop/revoke/expiry blocks stale UI and cached customer data.
- Ticket close, grant revoke, member removal, customer disable, support-role removal, logout, kill switch, and absolute expiry terminate access within the approved SLA (target ≤60 seconds; synchronous on next request).
- Concurrent refresh, revoke-versus-use, duplicate start, replay, and rate-limit tests.
- Audit chain reconciles every lifecycle event to session/ticket/actors and telemetry trace without leaking restricted fields.
- Automated browser accessibility checks plus keyboard/screen-reader behavior for banner, timer, modal, and exit.

Release gates: threat-model review approved; product/security open questions resolved; OpenFGA model deployed; actor/audit/correlation foundations merged; support ticket prerequisite merged; required checks green; preview security suite passes; runbook and kill switch exercised; human security validation completed.

## 15. Implementation-ready ticket slices

Every ticket description must include `[repo=singleton-sd/poc-plattform-kit]`, link this ADR and the authoritative ClickUp Architecture page, and use test-first delivery.

### Phase 1 — shared foundations (hard dependencies)

#### C-F1 — Establish canonical authenticated/effective actor request context

**Type/size:** Feature, L  
**Acceptance criteria:** persist/resolve canonical local `User.id`; immutable dual-actor context; self mode compatibility; no DTO/header/query/local-storage actor input; `/api/me` or actor-context response safely distinguishes mode; unit/integration tests.  
**Dependencies:** persistent SSO user work.  
**Out of scope:** session lifecycle.

#### C-F2 — Extend audit and event contracts for dual actors

**Type/size:** Feature, M  
**Acceptance criteria:** typed authenticated/effective/session/ticket/outcome/reason-code fields; Support local Audit + Outbox atomic pattern; cross-pillar Audit preserves fields; restricted-field classification; retention/index plan; redaction and rollback tests.  
**Dependencies:** C-F1; shared correlation foundation from error workstream.

#### C-F3 — Add tenant-scoped temporary support grants to OpenFGA

**Type/size:** Feature, L  
**Acceptance criteria:** model and model tests; grantor matrix; exact user/tenant conditional grant; maximum expiry; audited grant/revoke; managed-identity deployment docs; impersonation path denies when unconfigured/unavailable and does not use current guard bypass.  
**Dependencies:** product/security grantor approval.  
**Out of scope:** platform-wide wildcard grant.

#### C-F4 — Remove impersonation dependence on client-selected tenancy

**Type/size:** Security chore, M  
**Acceptance criteria:** server resource/actor context supplies tenant for all impersonated routes; generated client has no impersonation tenant setter; negative tests cover header/body/query; document and separately migrate/contain the legacy `x-tenant-id` escape for non-impersonated flows.  
**Dependencies:** C-F1.

### Phase 2 — impersonation delivery

#### C-I1 — Persist read-only Support impersonation sessions

**Type/size:** Feature, L  
**Acceptance criteria:** forward-only Prisma migration with fields/indexes/state constraints above; HMAC credential; one-active-session rule; start/refresh/stop/revoke service state machine; local Audit + Outbox transactions; expiry sweeper; retention job; unit/integration race tests.  
**Dependencies:** C-F1, C-F2; support-ticket persistence/API.

#### C-I2 — Implement fail-closed impersonation eligibility and lifecycle API

**Type/size:** Feature, XL  
**Acceptance criteria:** proposed endpoints/strict DTOs; active-ticket/reason/customer membership/assignment/grant checks; CSRF/CORS/cookie hardening; rate limits/kill switch; stable Problem Details; Swagger; OpenAPI export + Orval regeneration; contract/security integration tests.  
**Dependencies:** C-F3, C-F4, C-I1, support-ticket state API, shared error contract.

#### C-I3 — Enforce read-only dual authorization on every impersonated request

**Type/size:** Security feature, XL  
**Acceptance criteria:** exact server tenant match; effective customer's normal OpenFGA check; reviewed operation-ID allowlist default deny; CI exhaustiveness check; no background/offline/write bypass; revocation revalidation ≤ approved SLA; all route and cross-tenant integration tests.  
**Dependencies:** C-I2.

#### C-I4 — Build portal banner, entry, expiry, and exit experience

**Type/size:** Feature, L  
**Acceptance criteria:** ticket-driven eligible-customer chooser and reason confirmation; banner rendered before content; read-only controls; exit always available; expiry/revoke blocking modal; cache/service-worker purge and multi-tab sync; no authority in browser storage; generated client only; accessibility/component/E2E tests.  
**Dependencies:** C-I2, shared portal ticket UI. Can develop against API contract in parallel with C-I3 after C-I2 contract stabilizes.

#### C-I5 — Deliver customer notifications and security telemetry

**Type/size:** Feature, M  
**Acceptance criteria:** start/end/revoke/expiry notification events/preferences; retry/idempotency; approved suppression policy only; metrics/alerts/dashboards and field allowlist; no restricted fields; reconciliation tests.  
**Dependencies:** C-F2, C-I1, Notifications contracts; notification-policy approval. Can run parallel with C-I3/C-I4.

### Phase 3 — validation and operations

#### C-V1 — Seed impersonation preview scenarios

**Type/size:** Chore, M  
**Acceptance criteria:** deterministic, idempotent, non-production seed identities/tickets/grants/sessions listed below; no real PII/secrets; reset instructions; SWA/ACA preview compatibility (including documented OpenFGA preview limitation or isolated test store).  
**Dependencies:** C-I2–C-I5.

#### C-V2 — Validate end-to-end impersonation security and threat model

**Type/size:** Security validation, XL  
**Acceptance criteria:** execute every E2E security case in §14; tenant isolation matrix; OWASP-style manual abuse review; audit/telemetry leakage scan; revocation SLA measurement; documented residual risks and human security sign-off.  
**Dependencies:** all implementation and seed tickets. Must not be self-approved by implementer.

#### C-V3 — Publish impersonation operations and incident runbook

**Type/size:** Documentation/ops, M  
**Acceptance criteria:** grant/revoke, kill switch, dependency outage, alert triage, evidence/retention, customer communication, privacy requests, rollback/disable, and post-incident reconciliation procedures exercised in preview.  
**Dependencies:** C-I5; can draft alongside C-V1.

## 16. Preview seed scenarios

Use obviously synthetic identities and deterministic IDs; never seed production. Each scenario includes a ticket visible to both support and customer workflows:

| Seed | Setup | Expected demonstration |
| --- | --- | --- |
| `imp-success-read` | Agent has `support-agent`, active assigned ticket, 24h tenant grant, active customer/member with read permission. | Start, banner, allowed read, refresh, stop, audit/notifications. |
| `imp-customer-denied-resource` | Valid session but effective customer lacks permission to one resource. | Intersection policy denies without revealing existence. |
| `imp-cross-tenant` | Ticket/grant/customer in tenant A plus known resource ID in tenant B. | Header/query/route tampering cannot cross tenant; security audit/alert. |
| `imp-ticket-closed` | Closed ticket with otherwise valid grant. | Eligibility/start denied; active-session variant revoked on close. |
| `imp-grant-missing` | Active ticket/customer but no support tuple. | Fail-closed denial and safe remediation message. |
| `imp-grant-expired` | Conditional tuple exactly before/at expiry. | Allowed before, denied at boundary; no clock ambiguity. |
| `imp-membership-removed` | Active session then customer membership removed. | Next request denied/revoked within SLA; stale cache blocked. |
| `imp-session-expired` | Session near idle/absolute expiry. | Modal, cache purge, old cookie replay rejected. |
| `imp-session-revoked` | Supervisor revokes while agent has two tabs. | Both tabs exit; revoke audit and customer notification. |
| `imp-prohibited-write` | Active valid session and visible disabled update control. | Direct API mutation still returns `403` stable code. |
| `imp-openfga-outage` | Fault injection for OpenFGA. | Start/use/refresh deny; stop succeeds; dependency alert without retry storm. |
| `imp-concurrent-refresh` | Two simultaneous refresh requests. | One rotated credential wins; other/old credential cannot replay. |
| `imp-rate-limited` | Repeated invalid start attempts. | Safe `429`, audit, and anomaly metric. |

## 17. Dependency graph and parallelism

```text
Persist SSO User ──> C-F1 ──> C-F2 ───────────────┐
                         └──> C-F4                 │
Security approvals ──> C-F3                       │
Support ticket persistence/API ───────────────┐    │
Shared error/correlation contract ────────────┼─> C-I1 -> C-I2 -> C-I3 ─┐
                                              │             ├──> C-I4 ─┤
                                              └─────────────└──> C-I5 ─┤
                                                                         ├-> C-V1 -> C-V2
                                                                         └-> C-V3 ─────┘
```

- After the canonical terminology is merged, C-F2, C-F3, and C-F4 can run concurrently in separate worktrees.
- C-I1 may run alongside late support UI/error-presentation work once ticket and audit contracts are stable.
- After C-I2's API contract stabilizes, C-I3, C-I4, and C-I5 can run concurrently; do not start them before their Phase 1 dependencies merge.
- C-V1 and C-V3 can run concurrently. C-V2 is the final gate after all feature paths integrate.

## 18. Questions requiring product or security approval

1. Must an agent be explicitly assigned to the active ticket, or may any tenant-granted support agent use a queue ticket?
2. Who can grant tenant support access: tenant owner/admin only, and is a platform security break-glass grant allowed?
3. Approve defaults/maxima: 15-minute idle, 60-minute absolute session, 24-hour default and 30-day maximum tenant grant, ≤60-second revocation propagation.
4. Is customer/tenant-admin start notification mandatory, and may a security investigation delay it? Who authorizes and reviews a delay?
5. Approve 90-day terminal-session and ≥365-day security-audit retention, reason data classification, and audit-reader roles.
6. Which exact Swagger operation IDs form the initial read allowlist? Product owners must confirm that none have hidden writes or sensitive exports.
7. Should the effective customer be restricted to the ticket requester, or may another active tenant member be selected with justification?
8. Should the UI identify the individual support agent to customers or use a support-team label, considering privacy and accountability?
9. Resolve the platform-wide future of legacy `x-tenant-id`; this ADR only forbids it for impersonation.
10. How will ACA PR previews perform realistic OpenFGA authorization when repository documentation says preview managed identities are not assigned and checks fail closed: isolated preview store/identity, deterministic fake behind a preview-only contract, or integration environment?

Until these are approved, implementations must choose the safer behavior: assigned agent only, tenant-admin grant only, shorter expiry, immediate notification, requester only, fail closed, and no route allowlisted by assumption.
