# Support, error handling, and impersonation implementation roadmap

- **Status:** discovery complete; implementation blocked only by the approval
  gates listed below
- **Parent:** Design customer support, diagnostic error handling, and secure
  user impersonation
- **Inputs:** `shared-contract.md`, `support-ticket-workflow.md`,
  `api-error-contract.md`, and `support-impersonation.md`

## Consolidated decisions

1. All three features use the shared server-built request context. It carries
   `tenantId`, `authenticatedActor`, `effectiveActor`, optional
   `impersonationSessionId`, public `correlationId`, and W3C `traceId` as
   separate values. No client value is identity or tenancy authority.
2. API failures use RFC 9457 Problem Details contract version 1, a centrally
   governed stable `errorCode` registry, safe catalogued customer text, and
   explicit retryability and ticket-eligibility metadata.
3. The API issues the public correlation ID. It maps to the trace ID through a
   bounded, access-controlled diagnostic index; it never exposes the trace ID.
4. Support owns tickets, replies, private notes, ticket diagnostic snapshots,
   impersonation sessions, local audit, and outbox records. It does not query
   another pillar's database or replace Application Insights.
5. Diagnostic collection and presentation are allowlist-only. Bodies, tokens,
   cookies, arbitrary headers, raw SQL, stack traces, secrets, and unrestricted
   PII never enter public errors, ticket snapshots, or notification payloads.
6. OpenFGA owns tenant-scoped support access. The Entra `support-agent` role is
   only a coarse gate. Missing configuration, dependency failure, expiry, or
   revocation fails closed for support and impersonation actions.
7. Impersonation v1 is ticket-bound, read-only, temporary, revocable, and
   explicitly granted per tenant. A persisted server session and opaque
   HttpOnly credential select the effective actor; the browser never does.
8. Impersonated authorization is the intersection of the support session's
   exact tenant/scope and the effective customer's normal permission. Every
   write, export, bulk action, access administration, secret/configuration
   action, and background/offline mutation is prohibited by default.
9. Customer and support portals use generated Orval clients. API changes must
   update Swagger, run `pnpm openapi:export && pnpm openapi:generate`, and
   commit both the OpenAPI document and generated source.
10. Domain mutations write entity/session state, local immutable Audit, and
    Outbox in one Prisma transaction. Application Insights is operational
    telemetry, never the accountability ledger.

## Contradictions resolved by the target architecture

| Current repository behaviour | Target decision and rollout gate |
| --- | --- |
| `x-tenant-id` can establish AsyncLocalStorage tenancy and the browser can set it. | It cannot authorize protected production work. Phase 1 resolves tenant from verified membership/resource/session. Any local adapter is disabled by default and explicitly non-production. |
| Inbound `x-correlation-id` or an entire `traceparent` can become the correlation ID. | Continue valid W3C trace context separately; always issue an unpredictable public correlation ID. A bounded client request ID is non-authoritative metadata only. |
| The exception filter can return arbitrary Nest `HttpException` payloads. | Only a registered typed error or safe unknown fallback may render Problem Details V1. |
| Browser telemetry may send raw `Error` and response-body snippets. | Sanitizers remove body snippets and allowlist all dimensions before capture/export. |
| OpenFGA currently covers one route and may bypass checks when unconfigured. | Every new support/impersonation operation has an explicit mapping and fails closed; CI checks operation-classification completeness. |
| Audit tables have only one actor and an unstructured changes field. | Typed audit/event contracts preserve both actors, tenant, ticket/session, outcome, reason code, and correlation fields. |
| Support pillar is a package stub and no tenant/user diagnostic policy exists. | Forward-only Support-owned migrations and APIs land before portal or impersonation delivery. |

## Approval gates — do not guess

These questions are intentionally unresolved. Until approved, implementations
use the safer fallback stated here.

| Owner | Approval needed | Safe default |
| --- | --- | --- |
| Product/privacy | Ticket retention, proposed 24 months after close; diagnostic snapshot maximum 30 days; reopen window 30 days; legal-hold authority. | Shortest operational retention, no legal-hold feature exposed. |
| Product | Ticket visibility: reporter plus tenant admins, or narrower participants. | Reporter plus explicitly authorised tenant admins. |
| Support operations | Priority/SLA, assignment policy, languages/hours, and duplicate window. | Assigned-agent actions; no promised SLA; 24-hour fingerprint dedupe. |
| Security | Who grants `support_access`; whether diagnostic lookup needs stronger JIT elevation; whether break glass exists. | Tenant admin grants only; separate diagnostic permission; no break glass. |
| Security/privacy | Diagnostic field allowlist, restricted APM stack policy, reason classification, tenant ID in telemetry, fixed lookup result. | Enhanced diagnostics disabled; no snapshot stack; pseudonymous actor IDs. |
| Security/product | Impersonation session/grant maxima and revocation SLA. | 15-minute idle, 60-minute absolute session, 24-hour grant, synchronous next-request revocation and target within 60 seconds. |
| Product/security | Impersonation assignment rule, eligible customer, notification and agent naming. | Assigned agent, ticket requester only, immediate start/end notification using a support-team label. |
| Product/security | Initial read-only Swagger operation allowlist. | Empty allowlist until each operation is reviewed. |
| Privacy/legal | Ticket/session/audit access, export/deletion, audit retention (proposed at least 365 days). | Restricted security readers; immutable minimum audit without free-text duplication. |
| Platform | Realistic OpenFGA authorization in ACA PR previews. | Isolated preview test store/identity; never weaken production checks or use a production store. |

## Ordered technical ticket hierarchy

Every ticket is a child of the parent discovery feature, includes
`[repo=singleton-sd/poc-plattform-kit]`, links the four discovery documents,
uses TDD, and has explicit negative tenant-isolation/redaction criteria.

### Phase 1 — shared foundations

| Key | Ticket | Estimate | Depends on | Done when |
| --- | --- | ---: | --- | --- |
| F1 | Establish canonical actor, tenant, trace and correlation request context | 200k | Persistent local SSO user | Server context has dual actors and server-owned tenant/correlation; valid W3C continuation; production tenant/correlation spoof tests pass. |
| F2 | Implement Problem Details V1 registry and safe exception filter | 100k | F1 | Registered codes render `application/problem+json`; validation catalog and unknown fallback are safe; fuzz/redaction tests pass. |
| F3 | Publish Problem Details Swagger schemas and regenerate Orval | 50k | F2 | Standard responses documented; OpenAPI and generated client committed; drift check passes. |
| F4 | Extend audit, outbox and telemetry contracts for dual actors | 100k | F1 | Typed identity/ticket/session/outcome fields survive local Audit, Outbox and central Audit; forbidden fields are rejected. |
| F5 | Add Support and impersonation relations to OpenFGA | 200k | Security grant approval | Exact tenant conditional grants and expiry/revoke tests pass; support role alone never authorizes; outage fails closed. |
| F6 | Persist diagnostic policies, grants and safe capture index | 200k | F1, F4, privacy/security approval | Forward migration; most-restrictive platform/tenant/user policy; reason/expiry/revoke; redacted mapping; baseline on failure. |
| F7 | Build shared web Problem Details presentation primitives | 100k | F3 | Safe parser/legacy adapter, inline/toast/modal/boundary rules, retry constraints, accessibility and no-remote-string tests pass. |

F4 and F5 may start concurrently after terminology is merged. F3, F5, and
approved F6 may run concurrently after their own prerequisites. F7 can proceed
from F3 while persistence work continues.

### Phase 2A — support tickets

| Key | Ticket | Estimate | Depends on | Done when |
| --- | --- | ---: | --- | --- |
| S1 | Add Support ticket Prisma migration and transactional repositories | 200k | F1, F4, retention approval | Ticket/message/note/link models, indexes and state constraints migrate forward; every query is tenant scoped; mutation+audit+outbox rollback tests pass. |
| S2 | Implement customer support-ticket API | 200k | S1, F2, F5 | Create/list/detail/reply/resolve/reopen, strict DTOs, idempotency/dedupe/rate limits, indistinguishable cross-tenant denial, Swagger tests. |
| S3 | Implement support-agent queue and ticket API | 200k | S1, F2, F5 | Queue/detail/assign/reply/private note/transition enforce coarse role plus exact grant; notes cannot enter customer DTO/event. |
| S4 | Implement ticket-bound diagnostic lookup and retention | 100k | S1, F6 | Fixed allowlisted lookup, ownership/expiry states, purge/legal-hold policy, audited access and no arbitrary KQL. |
| S5 | Regenerate support API OpenAPI and Orval clients | 50k | S2, S3, S4 | Swagger security/error variants and generated clients are committed and drift-free. |
| S6 | Build customer ticket list, detail and error-report portal | 200k | S5, F7 | Accessible routes and states, manual/error-linked create, reply/resolve/reopen, no client tenant selection, expired/missing diagnostic UX. |
| S7 | Build support-agent queue, workspace and diagnostic portal | 200k | S5, F7 | Role shell plus server authorization, filters/assignment/replies/notes/transitions, diagnostic view and grant-revoke cache clearing. |
| S8 | Integrate Support events with Notifications | 100k | S1, Notifications contract | Safe minimized templates for receipt/reply/state; preference and verified destination; retry/idempotency; no note/diagnostic content. |

After S1 and F5 merge, S2, S3, S4, and S8 can run concurrently in distinct
workspaces. S6 and S7 can run concurrently after the consolidated S5 contract.

### Phase 2B — controlled diagnostics and error UX

| Key | Ticket | Estimate | Depends on | Done when |
| --- | --- | ---: | --- | --- |
| D1 | Add diagnostic policy administration and audited activation API | 100k | F2, F5, F6, S2 | Active ticket, written reason, permission, ceiling, expiry and revoke are enforced; missing/stale config is baseline; Swagger tests pass. |
| D2 | Integrate error presentation with support capture | 100k | F7, S5 | Eligibility controls, strict client metadata allowlist, deduped toast/modal/boundary capture, offline/manual fallback and inaccessible/expired correlation behavior pass. |
| D3 | Roll out Problem Details compatibility and observability gates | 50k | F3, F7 | Preview/route flags, legacy-safe adapter metrics, malformed/unclassified alerting and documented sunset gate are operational. |

D1 and D3 can run concurrently. D2 can run in parallel with S6/S7 after S5.

### Phase 2C — read-only support impersonation

| Key | Ticket | Estimate | Depends on | Done when |
| --- | --- | ---: | --- | --- |
| I1 | Persist temporary Support impersonation sessions | 200k | F1, F4, S1 | Forward migration, hashed opaque credential, one-active rule, state machine, sweeper/retention and atomic audit/outbox race tests pass. |
| I2 | Implement fail-closed impersonation lifecycle API | 400k | I1, S2, F2, F5 | Ticket/reason/assignment/customer/grant checks; secure HttpOnly cookie, CSRF/CORS, limits/kill switch; start/current/refresh/stop/revoke Swagger contract. |
| I3 | Enforce default-deny read-only dual authorization | 400k | I2 | Exact tenant plus effective-customer intersection on every request; CI operation allowlist complete; direct writes/exports/background actions denied. |
| I4 | Build impersonation entry, banner, expiry and exit portal | 200k | I2, F7 | Ticket-driven entry, unmistakable pre-content banner, read-only controls, always-working exit, multi-tab/cache/service-worker purge, no browser authority. |
| I5 | Deliver impersonation notifications, audit reconciliation and security telemetry | 100k | I1, F4, notification approval | Start/end/revoke/expiry events, safe templates, metrics/alerts, reconciliation and approved notification delay only. |

I1 may run beside support portal work once S1 is stable. After I2's contract is
stable, I3, I4, and I5 can run concurrently; none starts before its Phase 1
dependencies are merged.

### Phase 3 — integration, previews, security and operations

| Key | Ticket | Estimate | Depends on | Done when |
| --- | --- | ---: | --- | --- |
| V1 | Seed support, error and impersonation preview scenarios | 100k | S2–S8, D1–D3, I2–I5 | Deterministic idempotent synthetic tenants/users/tickets/grants/errors/sessions cover all ADR success and failure cases; no real PII/secrets. |
| V2 | Integrate support, diagnostics and impersonation end to end | 200k | V1 | Customer error→ticket→agent reply→approved read-only session flow preserves shared IDs, audit/outbox, generated client and App Insights correlation. |
| V3 | Validate tenant isolation, authorization, redaction and threat model | 400k | V2 | IDOR/spoof/replay/XSS/CSRF/cross-tenant/revocation/outage/rate/retention/leakage matrix passes; residual risks recorded for human security sign-off. |
| V4 | Publish and exercise support and impersonation operations runbooks | 100k | D3, I5, V1 | Kill switch, revoke, dependency outage, alert triage, evidence/retention, privacy and customer-communication procedures are exercised in preview. |

V4 may be drafted alongside V1. V2 is the integration gate; V3 is the final
non-self-approved security gate and blocks launch.

## Dependency graph

```text
Persistent SSO User
        |
       F1 ----> F2 ----> F3 ----> F7
        |        |                  |
        +--> F4  |                  +-----------> D2,D3
        |    |   |
approval+--> F5  +------------------------------+
        |    |                                  |
        +--> F6 ----------------> S4,D1          |
             |                                  |
F1,F4 ------> S1 ---> S2,S3,S4,S8 ---> S5 ---> S6,S7,D2
              |       |                         |
              +-----> I1 ---> I2 ---> I3,I4,I5 |
                                                   |
S2-S8 + D1-D3 + I2-I5 --------------------------> V1
V1 ------------------------------------------------> V2 -> V3
D3 + I5 + V1 -------------------------------------> V4
```

## Preview scenario catalogue

Seed two synthetic tenants and distinct customers, one assigned and granted
support agent, one ungranted agent, safe deterministic errors, and bounded fake
clocks. The suite demonstrates:

- validation inline behavior, conflict, 401, 403 without existence leak, 429,
  timeout/unknown-result, 500, 503, malformed gateway response, offline, and a
  render boundary;
- ticket creation with valid, missing, forged, cross-tenant, and expired
  correlation IDs; duplicate/idempotent create; reply/note separation;
  notification failure; grant revocation; and retention purge;
- successful ticket-bound read impersonation, effective-customer permission
  denial, cross-tenant tampering, closed ticket, missing/expired grant, removed
  membership, expired/revoked session, prohibited direct write, OpenFGA outage,
  concurrent refresh/replay, rate limit, multi-tab exit, and audit linkage.

## Assignment recommendation

1. Obtain the approval-gate decisions and merge F1 first.
2. Assign F2 and F4 in parallel; assign F5 to an authorization specialist and
   F6 to a privacy/diagnostics specialist once approvals are recorded.
3. Assign F3 after F2, then F7 to a frontend platform agent.
4. Assign S1; after it merges, run S2, S3, S4, and S8 concurrently.
5. Stabilize S5 once, then run S6, S7, D1/D2/D3, and I1 where dependencies
   permit. Avoid separate generated-client PRs modifying the same outputs.
6. Stabilize I2, then assign I3 to a security/backend agent, I4 to a frontend
   agent, and I5 to an audit/notifications agent concurrently.
7. Assign V1 and V4, then one integration owner for V2.
8. Assign V3 to a security validator who did not implement I2/I3; human
   security approval and human merge remain mandatory.

No Phase 2 ticket may start until all of its Phase 1 dependencies are merged.

## ClickUp registration state

Discovery created the parent feature as ClickUp task `86d3zha4p`. The first
eight child tickets were registered before ClickUp returned HTTP 429:

| Key | ClickUp task |
| --- | --- |
| F1 | `86d3zhctn` |
| F2 | `86d3zhctq` |
| F3 | `86d3zhctr` |
| F4 | `86d3zhctt` |
| F5 | `86d3zhcu3` |
| F6 | `86d3zhcu4` |
| F7 | `86d3zhcu5` |
| S1 | `86d3zhcu7` |

Per the repository's mandatory rate-limit rule, no ClickUp retry was made in
this discovery run. Dependencies and tickets S2 through V4 remain fully
specified above but require registration in a later, non-rate-limited session.
The eight created tasks are unassigned, have no Claim Token, remain `TO DO`,
and have their Token Estimate and acceptance criteria populated. Because the
429 occurred before the dependency-writing pass, their dependency links must
also be registered later from the table above; the roadmap remains the
authoritative dependency definition meanwhile.
