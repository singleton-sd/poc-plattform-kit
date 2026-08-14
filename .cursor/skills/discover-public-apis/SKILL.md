---
name: Discover Public APIs
description: Use curated public API catalogs and official provider sources to brainstorm externally-enabled product capabilities and identify viable integration providers during idea refinement and requirements discovery.
tags: [product, discovery, ideation, integrations, api, research]
audience: [product-managers, engineers, tech-leads, founders, all]
status: stable
---

# Discover Public APIs

Use this skill when an idea, feature, or requirement could be improved, simplified, or expanded by integrating an external API or public data source.

This skill has two modes:

1. **Capability brainstorming** — during `refine-idea`, use public API catalogs to discover product capabilities the team may not have considered.
2. **Provider discovery** — during `discover-requirements` or technical validation, identify and compare providers that could satisfy an already-understood capability.

The default discovery source is [`public-apis/public-apis`](https://github.com/public-apis/public-apis), but it is a lead generator only. Never treat inclusion in that repository as proof that an API is current, production-ready, free, safe, or suitable.

## Goal

Help answer questions such as:

- What useful external capabilities could strengthen this idea?
- Is there an existing API that lets us validate the idea without building the capability ourselves?
- What adjacent features become cheap to test because public APIs already exist?
- Which providers appear viable for a required integration?
- Should we build, buy, integrate, defer, or avoid the capability?

The purpose is not to maximize integrations. Prefer a simpler product when an external capability does not materially improve user value or reduce delivery cost/risk.

## Capability brainstorming

When called from `refine-idea`, start from the user problem and desired outcome rather than searching for arbitrary APIs.

1. Identify the domain and core user job.
2. Search relevant categories in `public-apis/public-apis` and, when useful, other reputable API directories or public-data catalogs.
3. Generate a small set of plausible capabilities that could materially improve the product or enable a cheaper MVP.
4. Explain the user value of each capability before discussing a provider.
5. Separate:
   - **MVP-enabling** capabilities;
   - **valuable later** capabilities;
   - **interesting but distracting** ideas.
6. Feed the useful candidates back into `refine-idea` as alternatives, MVP options, or later/optional capabilities.

Examples of useful brainstorming categories include:

- geocoding and location;
- email and phone validation;
- public holidays and calendars;
- weather;
- transport;
- currency and finance data;
- company/business data;
- documents and productivity;
- open government data;
- security and fraud signals;
- test data;
- media, images, or content;
- AI/ML services.

Do not add a capability merely because an API exists.

## Provider discovery

When the capability is already understood:

1. Use `public-apis/public-apis` to discover candidates.
2. Verify each serious candidate using the provider's official documentation and current product/pricing pages.
3. Compare at least two viable candidates when the decision is material.
4. Prefer existing Platform Kit providers or abstractions when they already satisfy the requirement.
5. Record unresolved provider risk as validation work rather than silently choosing a vendor.

## Required verification

Before recommending a provider for implementation, verify as relevant:

- API is still operational and actively documented;
- authentication method;
- current free tier and pricing model;
- rate limits / quotas;
- commercial-use restrictions;
- geographic or data-coverage constraints;
- CORS/browser constraints when client-side use is proposed;
- privacy, PII, data residency, and retention implications;
- reliability/SLA expectations;
- licensing or attribution requirements;
- webhook/event support when needed;
- SDK/runtime compatibility;
- vendor lock-in and ease of replacement.

For production-critical integrations, prefer primary/official sources over community summaries.

## Output during idea refinement

Keep this lightweight. Return only ideas that materially affect product direction.

```text
Externally-enabled opportunities
- <capability> -> <user value> -> MVP | Later | Reject

Build / buy / integrate notes
- <capability> -> <recommended direction and why>

Validation needed
- <question that must be verified before committing>
```

Do not turn provider candidates into implementation decisions unless the idea is already ready for requirements/technical validation.

## Output during provider discovery

```text
Capability
<required external capability>

Candidates
- <provider>: <strengths, constraints, pricing/auth summary>
- <provider>: <strengths, constraints, pricing/auth summary>

Recommendation
<preferred provider, existing abstraction, build-it-yourself, or needs spike>

Why
<decision factors>

Risks / validation
- <remaining uncertainty>
```

## Guardrails

- `public-apis/public-apis` is discovery input, not an approved-provider registry.
- Never assume `free` means unlimited, production-safe, or commercially usable.
- Never expose a provider API key directly in a browser unless that provider explicitly supports the security model.
- Do not introduce an external dependency when the capability is trivial to implement locally and the dependency increases risk or cost.
- Avoid provider-specific architecture during early idea refinement.
- Prefer provider interfaces/adapters for material integrations where replacement is reasonably foreseeable.

## Handoff

When brainstorming changes the product concept, return the candidates to `refine-idea` so it can decide MVP, later scope, or rejection.

When a required integration needs behavioral, data, privacy, cost, or failure-mode decisions, hand the findings to `discover-requirements`.

When provider feasibility remains uncertain, recommend a narrowly-scoped validation/spike. Do not create implementation tickets from this skill by itself.
