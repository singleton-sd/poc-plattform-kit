# Discovery: API-error support-ticket and customer portal workflow

**Status:** Proposed, implementation-ready discovery (Workstream A)  
**Parent:** “Design customer support, diagnostic error handling, and secure user impersonation”  
**Scope:** API/network/client-error reporting, ticket lifecycle, customer/support portal, diagnostics, authorization, persistence, notifications, observability, tests, and preview data. This document does not implement the feature.

## 1. Evidence and constraints

Repository evidence inspected:

- The Support pillar exists only as a package stub; Prisma has `SupportAudit` and `SupportOutbox`, but no support domain entities (`pillars/support/package.json`, `packages/db/prisma/schema.prisma`).
- The portal `/support` checks only the coarse `support-agent` Entra role and permits a user-entered tenant ID; `TenantLookup` writes that ID into the API client (`apps/web/src/app/support/page.tsx`, `apps/web/src/features/support/tenant-lookup.tsx`). This is not sufficient tenant authorization.
- Tenancy currently prefers a platform `tenant_id` auth claim but falls back to client `x-tenant-id` (`pillars/tenant/src/tenancy.middleware.ts`, `pillars/tenant/src/claim-tenancy.interceptor.ts`, `docs/sso.md`).
- Fine-grained authorization is owned by the Permissions pillar and OpenFGA; domain pillars must call `Check(subject, action, resource)` and fail closed (`pillars/permissions/README.md`).
- The generated client currently throws `ApiFetchError {status,data}`; it does not propagate a typed Problem Details contract or response headers (`packages/api-client/src/custom-fetch.ts`).
- The web has a success-only, auto-dismissing toast and a telemetry helper for boundary errors, but no shared API error presenter or route-level error boundary (`apps/web/src/components/toast.tsx`, `apps/web/src/telemetry/report-boundary-error.ts`).
- Application Insights/OpenTelemetry is the APM store; domain audit is separate. Telemetry conventions include `correlationId`, `traceparent`, tenant when known, and prohibit raw PII/secrets. Current Log Analytics retention is 30 days (`docs/telemetry.md`, `apps/api/src/telemetry.ts`).
- Nest Swagger is the contract of record; API changes require committed OpenAPI export and Orval regeneration (`docs/openapi-client.md`).
- API controllers have a process-local baseline throttle (default 100 requests/60 seconds/client IP), unsuitable as the only per-user/per-tenant support-create quota (`docs/sso.md`).
- Mutations must atomically persist the entity, local audit, and outbox where another pillar must be notified (root `AGENTS.md`).

### Contradictions and required resolutions

1. **Tenant selection:** existing support UI and middleware allow a client-entered tenant/header, while the shared contract requires `tenantId` to be immutable `Tenant.id` and never client-selected. Decision for this design: support endpoints derive tenant scope server-side from authenticated membership or explicit OpenFGA support grant; URL IDs identify resources but never establish authority. Remove the header escape for these endpoints. Platform-wide removal/migration is a shared-foundation ticket.
2. **Support authorization:** the UI treats `support-agent` as enough; architecture requires OpenFGA fine-grained checks. Decision: role is only a coarse entry gate. Every support operation also requires a tenant/resource-scoped OpenFGA decision.
3. **Audit maturity:** schema has local Support audit/outbox, but the central Audit consumer/storage is described as a stub. Decision: local audit is the transactional record; outbox events feed central Audit when available. Handoff cannot claim centralized audit completeness until its storage dependency lands.
4. **Telemetry retention versus ticket retention:** APM is 30 days, while tickets normally need longer retention. Decision: tickets retain only safe diagnostic references/snapshots; correlation lookup becomes unavailable after APM expiry and must be displayed as such, never compensated by copying raw telemetry into Support.
5. **Architecture support documentation:** the repository mirror contains telemetry, SSO, OpenFGA, API-client, Prisma, and portal evidence but no existing support-workflow decision page. This ADR must be mirrored into the ClickUp Architecture Doc during consolidation; ClickUp remains the architectural source of truth.

## 2. Shared contract and terminology

These definitions are normative across all three discoveries:

| Term | Definition |
| --- | --- |
| `tenantId` | Immutable platform `Tenant.id`, resolved and authorized by the server; never established by a header or other client-selected value. |
| `authenticatedActor` | Principal established by server authentication. Always retained for audit. |
| `effectiveActor` | Customer principal used only in a server-issued impersonation session; equals `authenticatedActor` otherwise. Support authorization and audit always preserve `authenticatedActor`. |
| `traceId` | W3C trace ID used inside telemetry. Not a public authorization credential. |
| `correlationId` | Public, opaque, high-entropy diagnostic lookup ID mapped server-side to `traceId`; safe to show/copy, but lookup remains authorized and time-bounded. |
| `errorCode` | Stable namespaced machine code from the versioned error contract (for example `support.ticket.rate_limited`). |

Additional terms:

- **Diagnostic snapshot:** a strictly allowlisted, redacted, immutable subset captured at ticket creation. It is not a request/response dump.
- **Reporter:** authenticated customer actor who creates or participates in a ticket.
- **Support grant:** explicit OpenFGA relationship authorizing a support actor for a tenant, optionally constrained by ticket/session and expiry.
- **Public reply:** tenant-visible message. **Internal note:** support-only message, never returned through customer endpoints or notification templates.

## 3. Reportable failures and presentation

### 3.1 Eligibility matrix

The error contract supplies `supportTicketEligible`; the server is authoritative when creating a diagnostic-linked ticket.

| Failure category | Examples | Reportable | Default presentation |
| --- | --- | --- | --- |
| Safe API problem | 5xx; dependency unavailable; unexpected server failure; persistent conflict specifically flagged eligible | Yes when `supportTicketEligible=true` and correlation is present; manual ticket still allowed without diagnostics | Persistent error toast for local action; modal on “Get help”; page boundary for route failure |
| Authorization/authentication | 401 expired session, 403 denied | Normally no diagnostic-linked report (prevents probing); provide sign-in/retry/request-access guidance. Manual support ticket may be allowed after authentication | Inline or modal requiring re-auth; no raw authorization reason |
| Validation/business rule | RFC validation errors, 400/409 (the V1 registry defines no 422) | Normally no; show field guidance. Eligible only for an explicitly classified unexpected/repeated condition | Inline field errors; summary at form; no global toast alone |
| Rate limiting | 429 | No new linked ticket while limited; honor `Retry-After`; manual channel guidance if sustained | Persistent toast/countdown or inline message |
| Network/offline/DNS/TLS/timeout | Browser cannot obtain an API response | Yes as a manual client-diagnostic ticket after connectivity retry; no claim of server correlation | Offline banner; persistent toast; modal can capture safe client metadata |
| Client runtime/render failure | React error boundary, chunk load failure | Yes after reload attempt; safe client event ID may replace API correlation | Route/global error boundary with reload and “Get help” |
| Abort/cancel/navigation race | `AbortError`, user cancellation | No | Usually silent |
| Expected empty/not-found state | Authorized 404 for a requested resource | No unless contract explicitly flags unexpected | Inline/page empty state |

Anonymous failures cannot create a tenant ticket. The UI may copy the correlation ID and direct the user to sign in or an approved external channel. Never infer tenant from the failing request payload or URL alone.

### 3.2 Toast, modal, and boundary behavior

- **Toast:** action-local transient errors. Error toast uses `role="alert"`, does not auto-dismiss while action is required, offers Retry and “Get help” only when eligible, and exposes Copy reference. Repeated identical failures update one toast rather than stack.
- **Modal/drawer:** opened by “Get help.” Shows safe summary, reference availability, the exact data that will be attached, editable subject/description/impact/contact preference, privacy warning, submit/cancel, and duplicate suggestion. It never renders hidden/raw response data.
- **Inline:** validation errors attach to fields and a focusable summary. Auth and permission problems provide the appropriate safe recovery action.
- **Route error boundary:** logs a safe client exception event, displays generic recovery text, reload/home actions, and support action using a server-issued client event/correlation token if available. A global boundary must not attempt to serialize the Error object into a ticket.
- **Accessibility:** focus moves to modal/summary; keyboard escape/cancel works; status is not conveyed by color alone; copied-reference feedback is announced; customer-visible state/reply changes use plain language.
- A failed ticket submission leaves user-entered fields in memory, clearly says no ticket was created, and offers retry. It does not persist description or diagnostics in local storage.

## 4. Ticket input and safe diagnostic capture

### 4.1 Customer-provided fields

Required: `subject` (10–120 characters), `description` (20–4,000), `impact` (`blocked|degraded|question`), and acknowledgement of the diagnostic-data notice. Server supplies reporter and tenant. Optional: reproduction steps (≤4,000), affected safe route template selected/normalized by client (≤200), contact preference (`portal|email`; SMS/WhatsApp only after Notifications supports verified destinations), and correlation ID from the trusted error object.

Normalize Unicode; reject control characters/HTML; render as plain text; virus-scan any future attachments. **Attachments are v1 out of scope** and require a separate malware/content-retention design. Customer text can contain PII, so classify it Confidential and warn users not to enter secrets; do not copy it to telemetry, event payloads, or notification subject/body.

### 4.2 Automatically captured allowlist

At create time the server may persist only:

- contract version, `errorCode`, HTTP status category/exact status, `retryable`, support eligibility;
- public `correlationId`, mapped telemetry availability state (`available|not_found|expired|unavailable`), occurrence timestamp, and safe server component/operation name from a registry;
- authenticated reporter ID, authorized `tenantId`, and (when applicable) both actor IDs without names/emails;
- client application version/build, platform class (`web|android|other`), browser family + major version, OS family, locale, timezone offset, online/offline state;
- normalized route **template** (not raw URL/query/fragment), request method from a fixed enum, bounded attempt count/latency bucket;
- server-generated diagnostic classification and redaction-policy version.

Client metadata is advisory/untrusted and length/enum validated. Server-derived values win.

### 4.3 Denylist, redaction, and handling

Never persist or emit in tickets, audit changes, outbox, replies, notifications, or telemetry enrichment: request/response bodies; Authorization or arbitrary headers; tokens, cookies or session IDs; URL query strings/fragments; raw SQL/parameters; exceptions/stack traces; connection strings/keys/secrets; DOM dumps; local/session storage; form state; unrestricted IP/user-agent; arbitrary telemetry attributes; unrestricted PII. Do not accept a generic metadata map.

Use positive DTO/schema allowlists at every boundary, key-based and value-pattern redaction as defense in depth, maximum lengths, newline/control stripping for identifiers, and structured logs. Reject unknown fields rather than storing them. Persist a redaction policy version. Audit records contain IDs/actions/classifications, never customer description or internal/public message bodies. Outbox events carry ticket/message IDs and routing facts; Notifications fetches authorized templates/data or receives minimized content.

## 5. Lifecycle and duplicate handling

### 5.1 States

`OPEN`, `WAITING_FOR_SUPPORT`, `WAITING_FOR_CUSTOMER`, `RESOLVED`, `CLOSED`. Creation enters `OPEN`; queue acceptance/first support action enters `WAITING_FOR_SUPPORT` only if not already there (an implementation may normalize creation directly to `WAITING_FOR_SUPPORT`, but the API/event must expose one canonical transition). Recommended canonical flow: create → `WAITING_FOR_SUPPORT` atomically.

Allowed transitions:

- `WAITING_FOR_SUPPORT` → `WAITING_FOR_CUSTOMER` (support public reply requests input)
- `WAITING_FOR_SUPPORT` or `WAITING_FOR_CUSTOMER` → `RESOLVED` (support; customer may mark resolved for own ticket)
- `WAITING_FOR_CUSTOMER` → `WAITING_FOR_SUPPORT` (customer reply)
- `RESOLVED` → `WAITING_FOR_SUPPORT` (customer/support reopen within 30 days with reason)
- `RESOLVED` → `CLOSED` (support, customer confirmation, or automatic after 30 days)
- Any non-closed state → `CLOSED` only by authorized support for abuse/security/legal reason, recorded and audited

`CLOSED` is terminal in v1. No deletion endpoint; privacy deletion/anonymization follows retention policy and legal approval. Use optimistic concurrency (`version`/ETag); return conflict on stale transitions. Every mutation writes entity + immutable local audit + outbox in one transaction.

### 5.2 Duplicate policy

Compute an HMAC/server-only fingerprint from `tenantId + reporterId + errorCode + correlationId-or-safe-operation + time bucket`; never fingerprint customer free text. Use the approved duplicate-detection window from the roadmap's approval gate; until approval is obtained, use the documented 24-hour safe default. Within that window, present existing open ticket before submission. If the same correlation/reporter is submitted idempotently, return the existing ticket. Allow “Create separate ticket” only with a distinct impact/reason, record the possible duplicate link, and rate-limit it. Support may link duplicates to a canonical ticket; never merge messages or expose tickets across tenants.

### 5.3 Rate limits

In addition to baseline API throttling: per authenticated reporter 3 creations/10 minutes and 20/day; per tenant 100/day (configuration with conservative hard maximum); messages 30/hour/reporter/ticket; correlation lookup 10/minute/actor; search/list bounded and paginated. Apply a distributed store or database counters/idempotency keys so replicas agree. Return Problem Details `429` with `Retry-After`. Support agents receive separate bounded operational limits, never unlimited. Audit suspicious abuse without logging supplied text.

## 6. Portal experiences

### 6.1 Customer

- `/support/tickets`: tenant-authorized, newest activity first; filters for open/resolved/closed; cards/table include reference, subject, state, impact, created/updated, last public responder. Cursor pagination; no internal-note existence indicator.
- `/support/tickets/{ticketId}`: subject/state/timeline of customer messages and public support replies, safe diagnostic summary/reference and telemetry availability (not trace ID), reply form, resolve/reopen actions, notification preference. Return indistinguishable 404 for nonexistent versus unauthorized IDs.
- Creation from error pre-populates only safe contract fields; manual creation is also available. After create, route to detail and announce ticket reference.
- Tenant switching must come from authenticated memberships/server-selected context, not editable IDs/headers.

### 6.2 Support agent

- `/support/queue`: coarse `support-agent` role plus per-row authorized tenant grants; filters by state, impact, safe code, age, assignment; no unrestricted cross-tenant export; paginated and default oldest waiting first.
- Detail shows tenant identity permitted by grant, reporter display details permitted for support purpose, public thread, separate visually distinct internal notes, assignment, state actions, safe diagnostic summary, correlation copy, and a deep link/query action into Azure Monitor only after server authorization.
- A public reply is explicit and previewed; internal notes are never customer-visible. UI/API use distinct endpoints and DTOs to prevent an `internal` boolean mass-assignment bug.
- Assignment is advisory workflow ownership, not authorization. Access is rechecked each request; revoking a grant immediately blocks detail/message/search and any telemetry lookup.

## 7. Tenant isolation and permissions

Proposed actions/resources:

| Actor | OpenFGA action/resource | Scope |
| --- | --- | --- |
| Tenant member | `support_ticket:create` on `tenant:{tenantId}` | Own authorized tenant only |
| Reporter/tenant authorized member | `support_ticket:list/read/reply/resolve` on `support_ticket:{id}` | Relation through the ticket’s immutable tenant; policy decides reporter-only vs tenant admins. Default reporter + tenant admin. |
| Support agent | `support_queue:list` on `tenant:{tenantId}` and `support_ticket:read/reply/note/assign/transition` | Requires coarse role **and** explicit active tenant support grant |
| Diagnostic operator/support agent | `diagnostic:lookup` on `support_ticket:{id}` | Active grant and ticket relation; separate from merely reading a ticket |

All repository queries include persisted `tenantId` from authorized server context; retrieve-by-ID uses `WHERE id AND tenantId`, then OpenFGA. Never trust DTO/header/query tenant values. Background jobs carry signed/internal minimized tenant context and revalidate ownership. Cache only allow decisions for very short periods and invalidate/reject on grant expiry; denial fails closed. Audit allow-sensitive mutations and denied cross-tenant attempts without revealing target existence.

## 8. Azure Monitor/Application Insights correlation

At request ingress, validate/continue W3C `traceparent` per OTel and always mint a high-entropy public `correlationId`; map it server-side to trace ID, tenant, safe operation, timestamp, and expiry. Echo only the correlation ID through the standard error contract/approved response header. It is a locator, not proof of access.

Ticket create validates that the correlation mapping belongs to the authenticated tenant (and, by default, reporter) and was issued within 24 hours. It stores the public ID plus safe snapshot, never `traceId`. Authorized support diagnostic lookup resolves the mapping server-side and queries App Insights using parameterized, fixed KQL templates constrained by time, cloud role, operation, and tenant. Results are re-redacted and limited to the allowlisted summary; raw telemetry is accessible only through existing Azure RBAC outside the customer API.

- **Missing:** ticket creation continues; status `not_found`; ask for approximate occurrence time and steps, without inventing telemetry linkage.
- **Expired:** creation continues; status `expired`; explain that diagnostic telemetry is no longer available. Do not extend APM retention or copy raw events.
- **Unavailable/query failure:** `unavailable`, retryable support-only lookup; ticket remains usable.
- **Foreign/forged:** treat as unavailable/invalid with the same customer wording; audit a security denial. Never confirm another tenant’s correlation exists.

## 9. Notifications and retention

Publish minimized `support.ticket.created`, `support.ticket.public_reply_added`, `support.ticket.state_changed`, and optionally SLA events via Support outbox. Notifications pillar sends portal/email notices using preferences and verified destinations. Email contains ticket reference, safe subject (or generic subject), state, and a portal link; **never** description, replies, diagnostic data, tenant-sensitive identifiers, or internal notes. No notification on internal note or diagnostic lookup. Delivery failure does not roll back Support; Notifications publishes its own outcome and retry/dead-letter policy.

Proposed retention pending product/privacy approval:

- Tickets, public replies, internal notes, local audit: active life + 24 months after close; then delete/anonymize free text and actor display data, retaining minimal non-PII aggregate/audit identifiers only if legally approved.
- Diagnostic snapshot/mapping: maximum 30 days and never beyond backing APM retention; purge independently even while ticket stays open.
- Idempotency/dedup/rate-limit records: 24 hours/30 days as needed, containing hashes/IDs only.
- Legal hold is privileged, reasoned, expiring/reviewed, and audited. Retention jobs are tenant-partitioned, idempotent, observable, and covered by restore/purge tests.

## 10. Data/API outline

Forward-only Prisma migration in the Support section:

- `SupportTicket`: ID/reference, immutable `tenantId`, reporter user ID, subject/description/reproduction (classified), impact/state, assignment user ID nullable, safe correlation ID nullable, diagnostic availability, safe diagnostic JSON or normalized fields, redaction version, duplicate-of nullable same-tenant ID, `version`, timestamps/resolved/closed/purge timestamps.
- `SupportMessage`: ticket/tenant IDs, author authenticated/effective IDs as applicable, kind `CUSTOMER_MESSAGE|PUBLIC_REPLY` (customer-readable table/view).
- `SupportInternalNote`: separate table and DTO path; ticket/tenant/author, body, timestamps.
- Existing `SupportAudit` must evolve to preserve authenticated/effective actor IDs, tenant, reason/classification and metadata without bodies; `SupportOutbox` payload remains minimized. Add indexes for tenant/state/activity, reference, correlation, assignment, retention, and unique idempotency key.

API surface (exact routes may follow repo controller conventions): customer create/list/detail/reply/resolve/reopen; support queue/detail/public-reply/internal-note/assign/transition; authorized diagnostic-summary lookup. DTOs must be separate for customer and agent views. Require idempotency key on create/reply, bounded cursor pagination, ETag/version on mutations, and Swagger security/Problem Details/error responses.

## 11. Implementation-ready tickets

Each ticket must include `[repo=singleton-sd/poc-plattform-kit]`, this ADR/ClickUp Architecture link, TDD, and the shared terminology. Consolidation should search ClickUp by title/intent before creating tasks.

| Order | Ticket title | Depends on | Estimate | Acceptance criteria |
| --- | --- | --- | ---: | --- |
| A0 | Publish support workflow ADR and approved retention/privacy decisions | Discovery consolidation | 25k | ClickUp Architecture mirrors this design; product/security decisions recorded; no contradiction is silent. |
| A1 | Add server-derived actor, tenant and correlation request context | Shared foundation | 100k | Support cannot establish tenant from client header; authenticated/effective actors and public correlation are available and tested; old routes have explicit migration behavior. |
| A2 | Add Support OpenFGA relations and authorization service | A1, shared Permissions model | 100k | Model/actions above implemented; role alone insufficient; revocation/expiry and cross-tenant fail-closed tests pass. |
| A3 | Add Support Prisma domain migration and transactional repositories | A0, A1 | 100k | Forward migration models/indexes/constraints; tenant-filtered repository; entity+audit+outbox atomic; separate internal notes; retention fields and tests. |
| A4 | Implement customer support-ticket API | A2, A3, error contract | 100k | Create/list/detail/reply/resolve/reopen; allowlists, idempotency, dedup, pagination/concurrency/rate limits; indistinguishable unauthorized 404; Swagger tests. |
| A5 | Implement support-agent queue and ticket API | A2, A3 | 100k | Queue/detail/assign/public reply/internal note/transition; distinct note/reply DTOs; tenant grant each request; audit and negative auth tests. |
| A6 | Implement safe diagnostic correlation lookup and snapshot policy | A1, A3, error/diagnostic foundation | 100k | Mapping ownership/expiry, fixed query, redacted summary, missing/expired/unavailable behavior, no forbidden data, security audit. |
| A7 | Regenerate OpenAPI and Orval support clients | A4–A6 | 50k | Swagger accurately documents variants/security/errors; export and generated client committed; `openapi:check` clean; typed Problem error preserved. |
| A8 | Build customer ticket list/detail/create portal | A7 | 100k | Routes/states/forms/accessibility/optimistic concurrency; manual and error-linked create; no client tenant selection; customer DTO cannot receive notes. |
| A9 | Build support-agent queue, ticket workspace and diagnostic view | A7 | 100k | Coarse gate + server authorization; filters/detail/reply/note/assignment; clear reply/note separation; expired/missing diagnostic UX. |
| A10 | Add shared web error presentation and support capture | Error contract client, A7 | 100k | Category rules, persistent error toast, modal, boundary, offline/client cases, deduped presentation, safe allowlist; accessibility tests. |
| A11 | Integrate Support outbox with Notifications | A3, Notifications contracts | 50k | Minimized events; preference/verified destination; safe templates; retry outcome; internal notes/diagnostics never notified. |
| A12 | Implement Support retention, purge and operational metrics | A0, A3, A6 | 50k | Approved periods configurable within caps; idempotent tenant-scoped purge; legal-hold controls; metrics/alerts without PII; tests. |
| A13 | Seed preview support workflows and deterministic diagnostics | A4–A12 | 50k | Scenarios below reproducible, isolated to preview, documented accounts/grants, clocks/IDs deterministic, no real PII/secrets. |
| A14 | Validate end-to-end support security and operability | A13 | 100k | Cross-tenant/role/revocation/IDOR/note leakage/correlation forgery/redaction/rate-limit/retention/notification tests; App Insights correlation validated; threat findings resolved/escalated. |

Parallelism: after A1/A2/A3 and shared error foundations merge, A4, A5, A6, and A11 can run concurrently on non-overlapping modules; after A7, A8/A9/A10 can run concurrently. A12 can run alongside portal work. A13 and A14 are sequential integration gates.

## 12. Preview seed scenarios

Use synthetic tenants `Acme Preview` and `Globex Preview`; customer Alice belongs only to Acme, customer Bob only to Globex; support Sam has an active Acme support grant, support Pat has no tenant grant. Never use production telemetry or real contact data.

1. **Successful eligible 503:** Alice triggers `dependency.unavailable` with valid correlation; modal lists safe metadata; ticket created, deduped on repeat; Sam sees safe summary and replies; Alice notified and responds; resolve/close succeeds.
2. **Validation 400:** field errors render inline, no support action by default, no ticket created.
3. **Offline/network:** simulated network failure shows offline/retry; manual ticket has `not_found` diagnostic state and safe client metadata only.
4. **Client boundary:** deterministic render error produces safe client event ID; reload action works; ticket contains no stack/error object.
5. **Expired correlation:** >30-day/expired mapping produces ticket with `expired`; support UI explains telemetry unavailable.
6. **Missing/forged correlation:** random and Globex-owned IDs look identical to Alice; ticket may proceed without linkage; security denial audited without disclosure.
7. **Tenant isolation/IDOR:** Alice cannot list/read Globex ticket by guessed ID; Sam cannot access Globex without grant; responses indistinguishable from missing.
8. **Grant revocation:** revoke Sam while detail is open; next read/reply/diagnostic request fails closed and UI clears sensitive cached data.
9. **Internal-note safety:** Sam adds note; Alice list/detail, generated DTO, notifications, and public event never expose content or existence.
10. **Rate limit/idempotency:** repeated same idempotency key returns same ticket; quota returns 429 + retry guidance; no duplicate outbox event.
11. **Notification failure:** ticket commits; simulated provider failure retries/dead-letters without exposing message text in logs.
12. **Retention:** clock-forward purge removes diagnostic snapshot before ticket, later anonymizes/deletes approved content; held ticket follows audited exception.

## 13. Approval questions

Implementation must not guess these:

1. Product/privacy: approve ticket content retention (proposed 24 months after close), diagnostic retention (maximum 30 days), reopen window (30 days), and legal-hold authority.
2. Product: may all tenant admins see all tenant tickets, or only reporter plus explicitly added participants? This design defaults to reporter + tenant admins.
3. Support operations: SLA priorities, assignment policy, supported contact channels/languages/business hours, and whether customer notification is mandatory on agent first view (recommended: no notification for view; notify on reply/state change; impersonation notification belongs to Workstream C).
4. Security: which support role/grant administrators may issue tenant grants, and whether diagnostic lookup requires a stronger separate role/JIT elevation.
5. Privacy/security: whether support may see reporter email/name by default or only after purpose-bound reveal; approve fixed KQL/result allowlist.
6. Platform: retire `x-tenant-id` globally versus retain it for explicitly local development only. It is prohibited for support production endpoints either way.
7. Product: attachment roadmap. Attachments are excluded from v1; adding them requires malware scanning, object isolation, authorization, and retention approval.
