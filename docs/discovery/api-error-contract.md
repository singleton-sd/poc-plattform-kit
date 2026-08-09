# ADR: Safe API error contract and controlled diagnostic detail

- **Status:** Proposed; implementation-ready after the approval gates below
- **Scope:** Workstream B of “Design customer support, diagnostic error handling, and secure user impersonation”
- **Decision owners:** Platform architecture, Security, Support product owner
- **Contract version:** `1`
- **Normative basis:** RFC 9457 Problem Details for HTTP APIs

## Context and evidence

The API currently has a global `AllExceptionsFilter` that preserves arbitrary `HttpException.getResponse()` content, adds a correlation ID, and converts unknown errors to a generic 500. It logs the exception object for server-side analysis. Tests cover only a basic 400 and unknown 500 (`apps/api/src/common/filters/all-exceptions.filter.ts`, `apps/api/src/common/filters/all-exceptions.filter.spec.ts`). This is a useful interception point, but the public shape is Nest-specific (`statusCode`, `message`) and arbitrary exception payloads can escape without classification or redaction.

Azure Monitor OpenTelemetry starts after App Configuration loading and before Nest bootstrap (`apps/api/src/main.ts`, `apps/api/src/telemetry.ts`). The observability contract calls for `correlationId`/`traceparent` and `tenantId` when known, forbids secrets and raw PII in logs, and separates Application Insights telemetry from domain Audit (`docs/telemetry.md`). The web telemetry helper currently sends browser `Error` objects to Application Insights and can send a caller-provided `x-correlation-id` (`apps/web/src/telemetry/client.ts`).

Nest Swagger is the contract of record. Contract changes require an offline Swagger export, Orval regeneration, and committed generated output (`docs/openapi-client.md`, `apps/api/scripts/export-openapi.ts`, `packages/api-client/orval.config.ts`). Existing UI utilities parse Nest's `data.message` and tolerate string arrays (`apps/web/src/features/tenants/api.ts`), so rollout must preserve that behavior while consumers migrate.

Runtime App Configuration currently maps a fixed set of platform keys to environment variables and gives an explicit process environment value precedence (`apps/api/src/config/app-configuration.ts`). There is no tenant- or user-level diagnostic configuration implementation in the inspected repository.

## Shared contract and terminology

These definitions are normative across support, errors, and impersonation:

- **`tenantId`:** immutable Platform Kit `Tenant.id`, resolved server-side from the authenticated/effective relationship; never an Entra directory `tid`, arbitrary request header, query parameter, or client-selected value.
- **`authenticatedActor`:** principal established by server authentication. It is never replaced during impersonation.
- **`effectiveActor`:** customer principal established only from a valid server-issued impersonation session; otherwise it equals `authenticatedActor`.
- **`traceId`:** current W3C trace ID (32 lowercase hexadecimal characters) in server telemetry. It is operational data and is not the public lookup key.
- **`correlationId`:** server-issued, cryptographically random, opaque public diagnostic lookup ID mapped server-side to `traceId`. A client value may be logged as a separately named `clientRequestId` only after syntax/length validation; it must not become the authoritative correlation ID.
- **`errorCode`:** stable, namespaced, lowercase machine code, for example `auth.authentication_required` or `tenant.slug_conflict`. Codes are never repurposed; semantic change creates a new code.

## Decision

### Media type and versioning

Every non-2xx JSON API response produced by the application MUST use `Content-Type: application/problem+json` and this versioned RFC 9457 extension contract. Authentication/proxy failures emitted before Nest should be normalized at the edge where feasible and tested; otherwise clients synthesize `platform.unclassified_response` without displaying the raw payload.

```json
{
  "type": "https://plattform-kit.poc.singletonsd.com/problems/tenant/slug-conflict",
  "title": "Tenant name is already in use",
  "status": 409,
  "detail": "Choose a different tenant name and try again.",
  "instance": "/api/tenants",
  "contractVersion": 1,
  "errorCode": "tenant.slug_conflict",
  "correlationId": "01K2...opaque...",
  "category": "conflict",
  "retryable": false,
  "supportTicketEligible": true,
  "validationErrors": []
}
```

Required fields are `type`, `title`, `status`, `contractVersion`, `errorCode`, `correlationId`, `category`, `retryable`, and `supportTicketEligible`. `detail`, `instance`, `validationErrors`, and `retryAfterSeconds` are optional. `instance` is path only: strip scheme, authority, query, and fragment. Do not emit `traceId`, `tenantId`, either actor, configuration state, dependency names, hostnames, or internal identifiers in the public body.

`type` is an HTTPS documentation URI derived from an allowlisted code registry, not exception text. `title` is stable for the code and localizable. `detail` is a safe remediation sentence selected/generated by the server. Unknown exceptions always map to `platform.internal_error` with a generic title/detail.

### Validation details

`validationErrors` is allowed only for `request.validation_failed` (400) and contains at most 50 entries:

```json
{ "field": "displayName", "code": "too_short", "message": "Enter at least 2 characters." }
```

`field` must be an allowlisted public DTO property expressed as a JSON pointer or stable field key. Never echo the rejected value. Messages come from a server-side catalog, not validator exception strings. Collapse overflow to one safe `request.too_many_validation_errors` entry. Cross-field errors use `field: "$"`.

### Code registry and HTTP mapping

A typed, centrally owned registry defines title, HTTP status, category, safe detail template, retryability, eligibility, and presentation. Feature modules may throw a typed domain error referencing a registered code; only the global filter renders it.

| Code / family | HTTP | Retryable | Ticket eligible | Presentation |
| --- | ---: | --- | --- | --- |
| `request.validation_failed` | 400 | No | No | Inline summary and field messages; focus first field |
| `request.malformed` | 400 | No | No | Inline/modal for blocking submit; no server text |
| `auth.authentication_required` | 401 | After re-auth | No initially | Session-expired modal; sign-in action; never toast-loop |
| `auth.forbidden` | 403 | No | Yes after repeated/expected-access case | Full inline state for page, toast for action; no resource-existence clues |
| `resource.not_found` | 404 | No | Yes | Page not-found state or inline action failure |
| `request.method_not_allowed` | 405 | No | No | Generic inline error; telemetry |
| `tenant.slug_conflict`, `resource.conflict` | 409 | No | Yes | Inline near submit plus safe remediation |
| `resource.precondition_failed` | 412 | Refresh then retry | Yes | Conflict modal offering reload; preserve unsaved input |
| `request.rate_limited` | 429 | Yes, delayed | No initially | Non-stacking toast/inline countdown using `retryAfterSeconds` |
| `dependency.unavailable` | 502/503 | Yes | Yes | Blocking state with retry and report action |
| `platform.maintenance` | 503 | Yes | No | Maintenance state; retry timing |
| `request.timeout` / `dependency.timeout` | 408/504 | Yes, idempotent only | Yes | Explain outcome may be unknown; refresh before mutation retry |
| `platform.internal_error` | 500 | Maybe, idempotent only | Yes | Generic blocking state/modal with correlation ID and report action |
| client-synthesized `network.offline` | n/a | Yes | No until connectivity returns | Persistent offline banner; queue no mutations |
| client-synthesized `network.unreachable` | n/a | Yes | Yes after recurrence | Retry state; generated client-side correlation ID is not diagnostic proof |
| client-synthesized `platform.unclassified_response` | response status | By status/idempotency | Yes | Generic safe state; never render response text/HTML |

Specific business codes extend families without changing HTTP semantics. Never use codes to reveal whether a cross-tenant resource exists: authorization checks return the registry-selected 403/404 policy consistently. A `retryable: true` response permits automated retry only for idempotent operations (or a mutation protected by an idempotency key), with capped exponential backoff and jitter. Honor a valid integer `Retry-After`, exposed as bounded `retryAfterSeconds`; never auto-retry 401, 403, validation, conflict, or unknown mutation outcomes.

### Frontend rules

1. Generated client parses a discriminated `ProblemDetailsV1`. Unknown/malformed bodies become `platform.unclassified_response`; raw body is discarded.
2. Field-correctable errors are inline. Non-blocking action failures use one deduplicated toast with an accessible live region. Blocking workflow failures use a modal only when the user must choose retry/reload/cancel. Route/render failures use the nearest error boundary with retry/navigation/report controls.
3. Show only `title`, safe `detail`, approved validation messages, and the public correlation ID. Do not render arbitrary `message`, response text, stack, headers, URLs with query strings, or thrown `Error.message` from remote input.
4. Copy-correlation/report controls appear only when `supportTicketEligible` is true. If no valid server correlation ID exists, the UI says diagnostics could not be linked and may still create a manually described ticket under Workstream A rules; it must not invent a trace mapping.
5. Toasts deduplicate by `{errorCode, normalized route/action}` within a short window. Error boundaries report once per boundary occurrence, not on each render.

### Correlation and telemetry

At request ingress, continue the valid W3C `traceparent` through OpenTelemetry or create a trace. Independently issue a public `correlationId` using a CSPRNG/ULID-equivalent with at least 128 bits of unpredictability. Store/search the mapping as structured telemetry (`correlationId`, `traceId`, route template, status, `errorCode`, tenant ID when authorized and known, actor pseudonymous IDs, deployment/version, timestamp). Do not expose the trace ID.

A submitted client request ID is bounded (64 characters), character-allowlisted, stored only as `clientRequestId`, and never trusted for lookup/uniqueness. Logs use route templates rather than raw URL/query. Telemetry sanitization occurs before exporters/loggers; sampling must retain all eligible 5xx and security/audit events. A missing/expired correlation mapping produces a safe “diagnostics unavailable or expired” result, never a broad telemetry search.

### Diagnostic detail policy

Enhanced diagnostics do **not** alter the public problem body. They increase only server-generated, allowlisted metadata retained for authorized support lookup.

Allowed examples: error code/status, route template, HTTP method, bounded durations, dependency category and sanitized operation name, deployment/version, region, retry count, feature flag names (not values if sensitive), tenant ID, pseudonymous actor IDs, impersonation session ID, and redaction counters.

Never capture or return request/response bodies; authorization/session/CSRF tokens; cookies; arbitrary headers; query-string values; raw URL; raw SQL or database parameters; exception messages unless classified safe; stack traces in customer-visible data; secrets/connection strings; or unrestricted PII. Stack traces may remain in tightly controlled platform telemetry only if the telemetry processor strips values and access is restricted; they never enter support-ticket diagnostic snapshots or API responses.

Classification:

| Class | Examples | Public problem | Diagnostic snapshot | Restricted APM |
| --- | --- | --- | --- | --- |
| Public | stable code/title, HTTP status | Yes | Yes | Yes |
| Internal operational | trace mapping, build, route template, timings | No | Allowlist | Yes |
| Tenant-confidential | tenant ID, pseudonymous subject | No | Role-gated, purpose-bound | Yes |
| Restricted/secret | bodies, tokens, cookies, raw headers/SQL, secrets, unrestricted PII | Never | Never | Redact/drop; exception stack only under restricted policy |

### Configuration and authorization

Effective diagnostic policy is the **most restrictive** result, not merely the last-written value:

1. **Platform ceiling** in Azure App Configuration (environment variable only as an operator emergency override under existing repository precedence) defines whether the feature is available, maximum level, maximum expiry, fields, and retention.
2. **Tenant policy** may lower/disable that ceiling. A tenant security administrator may approve a lower ceiling and view status, but cannot increase beyond platform policy.
3. **User/session grant** may lower scope further and activates enhanced collection for that user/session only. It cannot enable a field or duration disallowed above.

Normal diagnostics are always the minimal safe baseline. Enhanced diagnostics may be enabled only by a platform support-security role with an explicit tenant-scoped OpenFGA permission **and** tenant policy/consent as approved by Security. Self-enable by end users is not allowed. Each activation requires an active support ticket, written reason (bounded, treated as confidential), selected safe scope, start/end timestamps, and automatic expiry (proposed maximum: 60 minutes, subject to Security approval). Re-enable requires a new decision; refresh never extends expiry implicitly. Disable/revoke immediately stops enhanced collection.

Every request/approval/enable/disable/expiry/use/change emits immutable local Audit records containing authenticated actor, effective actor, tenant ID, ticket ID, reason reference/hash (not duplicated free text in telemetry), policy before/after, scope, expiry, and correlation ID. Use an Outbox event when Notifications/Support must react. Configuration reads fail closed to baseline if tenant/user policy is missing, stale, malformed, or unavailable. Cache TTL may never exceed grant expiry.

### Compatibility and rollout

1. Add the registry, DTOs, sanitizer, server-issued correlation mapping, and tests behind response negotiation/feature flag. Do not expose enhanced details yet.
2. Publish Problem Details schemas in Swagger, including all standard error responses and `application/problem+json`; export and regenerate Orval.
3. Update UI parser/presentation to prefer V1, while temporarily adapting legacy `{statusCode,message,correlationId}` into safe local categories. The adapter must ignore unrecognized server message text.
4. Enable V1 for internal/preview traffic, observe unknown-code/malformed metrics, then enable by route group.
5. Remove legacy parsing only after all supported clients have adopted V1. Contract version `1` receives additive optional fields only; required-field or semantic changes require version `2`, a new schema/media-type profile, parallel support, and a communicated sunset.

Changing `apps/api/package.json` version does not itself version the error schema; `contractVersion` and registry governance do.

## Audit and observability requirements

- Counters by `errorCode`, status, route template, role, and deployment; alert on 5xx rate, malformed/unclassified responses, redaction failures, and diagnostic-policy misuse. Avoid tenant IDs in high-cardinality metric dimensions; use them only in access-controlled logs/traces.
- A redaction failure drops the questionable field/event and emits a security metric; it never fails open.
- Diagnostic lookup is purpose-bound to ticket and tenant, audited, rate-limited, and returns only an allowlisted snapshot.
- APM access does not substitute for application authorization. Customer/support APIs never query Application Insights using arbitrary KQL supplied by clients.
- Align correlation mapping retention with telemetry retention (repository mirror currently says 30 days) and support-ticket policy. Expiration is visible and deterministic.

## Test strategy

### Contract and unit

- Snapshot/schema tests for every registered code: unique immutable code/type, exact status/category/defaults, safe titles/details, and complete Swagger registration.
- Global-filter tests for typed errors, Nest validation errors, unknown `Error`, non-`Error` throws, malformed exception payloads, and each relevant status.
- Property/fuzz tests inject secrets, tokens, cookies, headers, URLs/query values, SQL, PII-like values, circular objects, and huge strings; none may occur in the response, snapshot, or structured log.
- Correlation tests prove server issuance, valid W3C continuation, invalid `traceparent` rejection, inbound ID separation, trace mapping, entropy/format, and no trace-ID exposure.
- Configuration tests cover platform/tenant/user precedence, most-restrictive merge, fail-closed behavior, expiry boundary/clock skew, cache invalidation, revocation, and maximum scope.

### API/integration

- Assert `application/problem+json` and schema for validation, authn, authz, not-found, conflict, throttling, dependency failure, timeout, and unknown 500.
- Verify cross-tenant requests cannot infer resource existence or retrieve diagnostics; missing grants and OpenFGA outages fail closed.
- Verify activation requires ticket, reason, tenant grant, authorized actor, expiry, audit transaction, and Outbox where applicable.
- Verify telemetry fields link correlation to trace while public responses and support snapshots exclude forbidden data.
- Verify proxies/CORS preserve `traceparent` as intended and expose only required safe response headers; ensure authentication failures before controllers conform or are safely synthesized.
- Run Swagger export and Orval generation and fail CI on drift.

### Frontend

- Parser tests cover V1, legacy, HTML/proxy errors, empty responses, offline/rejected fetch, invalid/expired correlation IDs, and unknown fields/version.
- Component tests assert inline/toast/modal/boundary mapping, accessible focus/live regions, deduplication, retry constraints, copy/report controls, safe fallback text, and never rendering injected remote strings.
- End-to-end tests exercise 400/401/403/404/409/429/500/503/504 and offline flows, legacy staggered deployment, report eligibility, and correlation lookup success/expired/not-found.

## Implementation tickets

Each title must include `[repo=singleton-sd/poc-plattform-kit]` when created in ClickUp. These are proposed slices for consolidation; this discovery agent does not create or claim them.

1. **Establish actor, tenant and correlation request context** (M): server-owned `tenantId`, authenticated/effective actors, W3C trace continuation, opaque public correlation issuance/mapping; remove authoritative reliance on inbound correlation/tenant headers. Foundation for all later work.
2. **Implement the Problem Details V1 registry and exception filter** (M; depends on 1): typed domain error, strict safe renderer, validation mapping, unknown exception behavior, rate-limit metadata, media type, sanitizer.
3. **Publish Problem Details in Swagger and regenerate Orval client** (S; depends on 2): reusable response decorators/schema, `pnpm openapi:export && pnpm openapi:generate`, committed spec/generated sources, drift checks.
4. **Build shared web error parsing and presentation** (M; depends on 3): V1 plus safe legacy adapter, presentation policy, retry controller, toast deduplication, modal and error-boundary primitives, accessible behavior.
5. **Persist diagnostic policy, grants and audit contracts** (L; depends on 1 and Security decisions): forward-only Prisma migration, platform/tenant/user resolver, OpenFGA checks, reason/expiry/revocation, local Audit + Outbox.
6. **Implement redacted diagnostic capture and ticket-bound lookup** (L; depends on 2 and 5): allowlist processor, mapping/snapshot retention, permissioned lookup, metrics/alerts, expired/missing behavior.
7. **Roll out V1 compatibility and observability gates** (S; depends on 3 and 4): preview/route flags, dashboards for unknown/unclassified responses, supported-client adoption gate, sunset plan.
8. **Validate the error and diagnostics security boundary end to end** (M; depends on 4 and 6): fuzz/redaction, cross-tenant/AuthZ, telemetry leakage, expiry/revoke/cache, pre-controller/proxy errors, penetration-style regression suite.

Tickets 3 and 5 may start concurrently after their distinct prerequisites; 4 can proceed from a stable generated contract while 5 proceeds on policy persistence. Ticket 6 needs both tracks. Ticket 8 is a release gate.

## Preview seed scenarios

- Deterministic endpoint/fixture for safe validation errors with multiple field codes.
- Tenant slug conflict and stale precondition conflict.
- Authenticated but forbidden cross-tenant lookup with no existence leak.
- Throttled request with bounded retry time.
- Dependency timeout and unknown server exception linked to seeded diagnostic metadata.
- Missing mapping, expired mapping, and invalid public correlation ID.
- Baseline diagnostics; authorized ticket-bound enhanced grant; unauthorized enable attempt; automatic expiry; explicit revoke; OpenFGA/config outage fail-closed.
- Legacy Nest error fixture during compatibility window and malformed HTML gateway response.

Seed data must use synthetic tenants/users/tickets and scrubbed fixed messages; never copy production telemetry or PII.

## Contradictions and gaps

1. **Tenant ownership conflict:** repository middleware and generated client currently allow `x-tenant-id` as a legacy/dev fallback (`pillars/tenant/src/tenancy.middleware.ts`, `packages/api-client/src/client-config.ts`, `docs/sso.md`), while this shared contract forbids client-selected tenancy. Resolution: phase out the header as an authority; any retained developer selector must be server-validated against membership/grant and disabled in production. Track as a foundation migration, not an implementation guess.
2. **Correlation trust conflict:** the exception filter prefers inbound `x-correlation-id`, and web code can set it. This ADR requires a server-issued authoritative correlation ID and separates a validated inbound `clientRequestId`.
3. **Public error safety gap:** arbitrary `HttpException` payloads and validator messages can currently reach customers. The V1 registry/filter closes this before enhanced diagnostics ships.
4. **Telemetry detail tension:** browser telemetry currently sends raw `Error` objects, while architecture forbids raw PII and this policy requires allowlisting. Add client/server telemetry processors and verify SDK auto-collection configuration rather than assuming it is safe.
5. **Configuration gap:** platform env/App Configuration precedence exists, but tenant/user policies, grants, reason, expiry, and audit persistence do not. Their schema and API must be implemented only after approval.
6. **Architecture-source gap:** the repository telemetry mirror declares the ClickUp Architecture Doc authoritative. This ADR must be mirrored/approved there during consolidation; repository evidence alone cannot establish product consent, diagnostic maximum duration, retention, or notification policy.

## Approval-required questions

- **Security:** approve maximum enhanced-diagnostic duration (proposal 60 minutes), exact allowlist, whether restricted APM may retain sanitized stack traces, roles/OpenFGA relations, approval/consent workflow, and tenant-ID use in restricted telemetry.
- **Product/Support:** approve which 403/404/business errors are reportable, customer wording/localization, manual-ticket behavior without a correlation match, and supported-client legacy sunset.
- **Privacy/compliance:** approve diagnostic snapshot and correlation retention (must not exceed operational need), reason text classification, customer access/export/deletion implications, and geography.
- **Operations:** choose correlation mapping store/index and capacity, alert thresholds, sampling exception rules, and behavior when Application Insights is unavailable.

Until these are approved, ship only the baseline safe Problem Details contract and minimum redacted telemetry; enhanced diagnostic activation remains disabled.
