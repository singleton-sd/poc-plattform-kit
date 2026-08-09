# Form UX audit (Phase 2)

Audit of every user-facing form and shared form renderer in `poc-plattform-kit`
against the canonical [`form-ux`](../.cursor/skills/form-ux/SKILL.md) skill
(six rules: submission readiness, inline validation, character limits,
pre-fill, password requirements, forgiving formatting). Read-only audit — no
production behaviour was changed to produce this report.

- Parent: https://app.clickup.com/t/86d3zh1hx
- This ticket: https://app.clickup.com/t/86d3zh1kb
- Depends on: https://app.clickup.com/t/86d3zh1k8 (form-ux skill, PR
  singleton-sd/poc-plattform-kit#113)

Status vocabulary (from the skill): **Compliant**, **Partially compliant**,
**Non-compliant**, **Not applicable** (reason required), **Unable to verify**
(reason required, static-only).

## Methodology

Repo-wide search for form surfaces (`JsonForms`, `<form`, `<input`, `<select`,
`<textarea`), then static read of every match plus its schema/uischema and any
wrapping drawer/page component. Renderers audited before host forms — a
renderer gap affects every consumer. Timing-dependent rules (blur order,
live-typing behaviour) are scored from the code that wires the event handlers
(e.g. is there an `onBlur` at all, is a validation mode hardcoded) rather than
from a browser session, and are marked accordingly below.

Commands actually run (this session, this environment):

```text
pnpm install                                          # node_modules were absent; installed to run tests
pnpm --filter @poc-plattform-kit/forms test            # 3 suites, 6 tests — all pass
cd apps/web && npx jest src/features/tenants \
  src/features/tenant-settings src/features/support \
  src/features/forms-demo src/features/auth            # 20 suites, 119 tests — all pass
```

No test failures were caused or found; the pass/fail results above are from
existing tests, not new ones — they establish a baseline, not compliance.
**Two form surfaces have zero test files**: `forms-demo` (`CreateProjectForm`)
and `support` (`TenantLookup`) — noted per-form below and reflected in the
remediation drafts.

`pnpm format:check` was run after adding this document; see the
Phase 1 PR's test plan for the one pre-existing, unrelated failure
(`packages/events/src/index.ts`) also present on `main`.

## Inventory

### Shared renderers — `packages/forms/src/renderers/`, `registry.ts`

| # | Location | Role |
|---|---|---|
| R1 | `text-control.tsx:TextControlRenderer` | string/email/password control |
| R2 | `select-control.tsx:SelectControlRenderer` | enum control |
| R3 | `date-control.tsx:DateControlRenderer` | date control |
| R4 | `checkbox-control.tsx:CheckboxControlRenderer` | boolean control |
| R5 | `array-control.tsx:ArrayControlRenderer` | string-array control |
| R6 | `group-layout.tsx`, `vertical-layout.tsx` | layout only, no field semantics |

### Feature host forms — `apps/web/src/features/`

| # | Location | Pipeline | Consumers |
|---|---|---|---|
| F1 | `tenants/create-tenant-form.tsx:CreateTenantForm` | JSON Forms (Zod → JSON Schema) | `tenants/tenant-create-drawer.tsx` |
| F2 | `tenants/update-tenant-form.tsx:UpdateTenantForm` | JSON Forms (Zod → JSON Schema) | `tenants/tenant-details-drawer.tsx`, `tenant-settings/tenant-settings.tsx` |
| F3 | `forms-demo/create-project-form.tsx:CreateProjectForm` | JSON Forms (Zod → JSON Schema) | standalone demo route |
| F4 | `support/tenant-lookup.tsx:TenantLookup` | hand-built | standalone |
| F5 | `tenants/tenant-open-by-id.tsx:TenantOpenById` | hand-built | tenant list toolbar |
| F6 | `tenant-settings/tenant-settings.tsx` — tenant-id lookup form | hand-built | standalone |
| F7 | `tenant-settings/tenant-settings.tsx` — settings JSON `<textarea>` (submits via `form={UPDATE_TENANT_FORM_ID}` on F2) | hand-built | same page as F2 |
| F8 | `tenants/tenant-search.tsx:TenantSearch` | hand-built, live filter — **not a submission form** | tenant list toolbar |
| F9 | `auth/login-panel.tsx:LoginPanel` / `HomeAuthGate` | OAuth redirect buttons — **not a data-entry form** | `/` |

## Shared renderer audit

| Location | Rule | Applicability | Status | Evidence | User impact | Ownership | Suggested regression test |
|---|---|---|---|---|---|---|---|
| R1–R5 (all field renderers) | 1. Submission readiness | Applies | **Non-compliant** | Each renderer sets only a visual `<span aria-hidden="true"> *</span>` next to a required label; none sets `required` or `aria-required` on the actual `<input>`/`<select>`/array `<input>` (`text-control.tsx:9,19` [now :9-24 post any future edit], `select-control.tsx:10,20`, `date-control.tsx:6,14`, `array-control.tsx:22,41`). Assistive tech gets no programmatic required signal. | Screen-reader users are never told a field is required by the control itself — only sighted users see the asterisk. | Shared renderer | Renderer unit test: render each control with `required: true`, assert `aria-required="true"` (or `required`) on the underlying form element |
| R1 `text-control.tsx:TextControlRenderer` | 2. Inline validation | Applies | **Partially compliant** | Renders `aria-invalid`/`aria-describedby` + `role="alert"` whenever the `errors` prop is a non-empty string (lines 9, 27-32) — the renderer *is* capable of correct, accessible error display. But it has no `onBlur` handler and no "touched" concept of its own — display timing is entirely delegated to the host's `validationMode`, so a compliant renderer can still produce non-compliant behaviour (see F1/F2/F3 below). | N/A directly — this is a capability gap that becomes a real gap only combined with host wiring; see F1–F3. | Shared renderer (needs an opt-in blur/touched mechanism) + feature hosts (must use it) | Renderer test: with `errors` set but no interaction signal from the host, does the renderer have any way to suppress it pre-interaction? Currently no — it always shows if `errors` is truthy |
| R2 `select-control.tsx:SelectControlRenderer` | 2. Inline validation | Applies | Same as R1 | Identical pattern (line 32-33) | Same as R1 | Shared renderer | Same as R1 |
| R3 `date-control.tsx:DateControlRenderer` | 2. Inline validation | Applies | Same as R1 | Identical pattern (line 25-26) | Same as R1 | Shared renderer | Same as R1 |
| R1 `text-control.tsx:TextControlRenderer` | 3. Character limits | Applies to every field whose schema declares `maxLength` (e.g. tenant `name` max 120, `slug` max 64 — `apps/web/src/features/tenants/schemas.ts:5,8`; project `name` max 80 — `apps/web/src/features/forms-demo/schemas.ts:5`) | **Non-compliant** | `schema.maxLength` is available on `ControlProps.schema` (confirmed via `zod-to-json-schema` output — `packages/forms/src/convert.ts`) but `TextControlRenderer` never reads it; no counter is rendered anywhere in the component (full file read, `packages/forms/src/renderers/text-control.tsx`). | Every field with a length ceiling gives the user zero feedback about how much room is left, discovered only via a rejected submit. | Shared renderer | Renderer test: pass `schema: { maxLength: 10 }`, assert a `used/10` (or equivalent) counter renders and updates with `data` |
| R2, R3, R5 | 3. Character limits | Not applicable | Not applicable | Enum/date/array-of-strings controls have no `maxLength` semantics in the current schemas. | — | — | — |
| R4 `checkbox-control.tsx` | 1, 2, 3 | Not applicable | Not applicable | Boolean control has no "required marker" concept (a checkbox is either checked or not; JSON Forms doesn't mark booleans required in the same sense), no length, and errors (if any) are already wired identically to R1–R3 for the parts that do apply (aria-invalid/describedby, line 18-19) — that part is Compliant. | — | — | — |
| R1–R5 | 4. Pre-fill | Not applicable at the renderer layer | Not applicable | Renderers are stateless/controlled — pre-fill is a host concern (data passed in via `data` prop). No renderer defeats or ignores externally-provided data. | — | — | See host forms F1/F2 below |
| R1 (as the only text control usable for a password field) | 5. Password requirements | Applies if a password field is ever wired through `TextControl` | **Not applicable today** | No `format: 'password'`/`type: 'password'` handling exists in `TextControlRenderer` at all — it always renders a plain `<input>` with no `type` attribute (defaults to `text`), and repo-wide search of `apps/web/src` for "password" returns zero matches. There is currently no password-composition field anywhere in the app (auth is Entra SSO — `apps/web/src/features/auth/*`). | None today. | — | If/when a password field is introduced, the renderer needs an explicit password-mode path before Rule 5 applies — flag this as a design gap for that future ticket, not a current one |
| R1–R5 | 6. Forgiving formatting | Not applicable at the renderer layer | Not applicable | Renderers pass raw `event.target.value` straight to `handleChange`; normalisation is a schema/host concern (see F1 slug casing below). | — | — | — |

## Feature host form audit

### F1 — `tenants/create-tenant-form.tsx:CreateTenantForm` (+ `tenant-create-drawer.tsx`)

| Rule | Applicability | Status | Evidence | User impact | Ownership | Suggested regression test |
|---|---|---|---|---|---|---|
| 1. Submission readiness | Applies (`name` required, `slug` pattern-validated) | **Partially compliant** | The `<form onSubmit={handleSubmit}>` handler (`create-tenant-form.tsx:38-47`) re-validates via `createTenantSchema.safeParse` and blocks the mutation on failure — this correctly catches button click *and* Enter-key, because both dispatch the same `submit` event this handler listens for. But: (a) the submit button in `tenant-create-drawer.tsx:44-52` is `disabled={mutation.isPending}` only, with no validity signal, so an obviously-incomplete form still looks submittable; (b) only the **first** Zod issue is surfaced (`parsed.error.issues[0]?.message`, `create-tenant-form.tsx:42`), as one generic message at the form bottom, not per field. | User can click an enabled-looking "Create Tenant" button, get a single generic error unconnected to any field, and has to guess which field is wrong if there's more than one problem. | Feature host | Interaction test: submit with both `name` and `slug` invalid, assert the user is told about more than just the first issue (or assert the button visibly reflects invalidity) |
| 2. Inline validation | Applies (`name`, `slug` both validated) | **Non-compliant** | `validationMode="ValidateAndHide"` is a hardcoded, never-toggled prop (`create-tenant-form.tsx:63`) — JSON Forms computes validity internally but the renderer's `errors` prop is always empty as delivered to `TextControl`, so the accessible per-field error path in R1 never activates for this form, regardless of blur or submit attempts. | A user who mistypes `slug` gets no per-field explanation ever — only the single generic message from Rule 1's gap, and it doesn't identify which field. | Feature host | Interaction test: blur an invalid field (or submit), assert a field-scoped, accessibly-associated (`aria-describedby`) error appears — will fail today |
| 3. Character limits | Applies (`name` max 120, `slug` max 64) | **Non-compliant** | Inherits the R1 shared-renderer gap directly — no counter for either field. | Same as the renderer-level finding — user can type well past a reasonable length with no feedback until a rejected submit. | Shared renderer (fix once in R1, not per host) | See R1's regression test — a renderer fix here covers this host automatically |
| 4. Pre-fill | Applies? — this is a **create** form, not edit | **Not applicable** | No trusted prior value exists for a brand-new tenant's `name`/`slug`; `data` starts at `{ name: '', slug: '' }` (`create-tenant-form.tsx:33`), which is correct for a create flow. | — | — | — |
| 5. Password requirements | No password field | **Not applicable** | Schema has only `name`/`slug` (`apps/web/src/features/tenants/schemas.ts:4-12`). | — | — | — |
| 6. Forgiving formatting | Applies to `slug` (has a canonical lowercase-kebab form) | **Non-compliant** | `slug` schema is `.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)` with **no** `.toLowerCase()`/transform (`schemas.ts:6-9`); `toCreateTenantPayload` only trims whitespace and converts blank to `undefined` (`schemas.ts:17-20`) — it does not lowercase. Typing `MyCo` is rejected outright rather than being accepted and normalised to `myco`. | A harmless, common variant (mixed-case slug) is rejected instead of silently accepted, forcing the user to manually retype in lowercase for no security-relevant reason. | Feature schema (`apps/web/src/features/tenants/schemas.ts`) | Unit test: `toCreateTenantPayload({ slug: 'MyCo' })` → assert the payload's `slug` is `'myco'` and passes `createTenantSchema` |
| 6. Forgiving formatting | Applies to `name` (a display string, but still worth trimming) | **Partially compliant** | `name: z.string().min(1, 'Name is required').max(120)` has no `.trim()` — a whitespace-only value (`' '`) passes `min(1)` client-side. | A user can "successfully" submit a name that is visually blank. | Feature schema | Unit test: `createTenantSchema.safeParse({ name: '   ' })` → currently succeeds; assert it should fail (or trim first) |

### F2 — `tenants/update-tenant-form.tsx:UpdateTenantForm` (+ `tenant-details-drawer.tsx`, `tenant-settings.tsx`)

Same code shape and `validationMode="ValidateAndHide"` as F1 (`update-tenant-form.tsx:66`), so Rules 1–3 and 6 carry the **same findings as F1** (Partially compliant / Non-compliant / Non-compliant / Partially compliant respectively) — not restated per rule. One rule differs:

| Rule | Applicability | Status | Evidence | User impact | Ownership | Suggested regression test |
|---|---|---|---|---|---|---|
| 4. Pre-fill | Applies — this is an **edit** form | **Compliant** | Both consumers pass `initialName={tenant.name}` sourced from the fetched entity (`tenant-details-drawer.tsx:107`, `tenant-settings.tsx:145` — both read `tenantPayload(findQuery.data)`); `update-tenant-form.tsx:35-39` seeds `data`/`dataRef` from `initialName` via `useEffect` and re-syncs on prop change. The field is a normal, non-disabled controlled input — nothing makes it read-only. | User editing a tenant sees its current name pre-filled and can change it — no unnecessary re-typing. | — | Already covered by existing `tenant-details-drawer.test.tsx` / `tenant-settings.test.tsx`; add one assertion that the rendered input's initial value equals the fetched entity's name if not already present |
| 5. Password requirements | No password field | **Not applicable** | `updateTenantSchema` has only `name` (`schemas.ts:22-24`). | — | — | — |

### F3 — `forms-demo/create-project-form.tsx:CreateProjectForm`

| Rule | Applicability | Status | Evidence | User impact | Ownership | Suggested regression test |
|---|---|---|---|---|---|---|
| 1. Submission readiness | Applies (`name`, `category`, `launchDate`, `tags` all validated) | **Partially compliant** | `<form onSubmit={handleSubmit}>` re-validates via `createProjectSchema.safeParse` (`create-project-form.tsx:29-40`), correctly catching button/Enter submission. Submit button is `disabled={mutation.isPending}` only (line 58) — same affordance gap as F1. Only the first Zod issue is shown (line 34). | Same shape of gap as F1: button looks enabled when the form is incomplete; one generic message on failure. | Feature host | Same pattern as F1's test |
| 2. Inline validation | Applies | **Non-compliant** — but in the *opposite* direction from F1/F2 | No `validationMode` prop is passed to `<JsonForms>` at all (`create-project-form.tsx:44-54`), so JSON Forms uses its default, `ValidateAndShow` — errors are computed **and displayed immediately on mount**, before any user interaction, for every required-but-still-empty field (`name`, `launchDate`, the initial empty `tags: ['']` entry). This directly violates "no error is shown before the user has interacted with the field." | A brand-new demo form greets the user with visible validation errors on fields they haven't touched yet — the canonical "premature error" anti-pattern the skill calls out. | Feature host | Render test: mount `CreateProjectForm` with no interaction, assert no `role="alert"` error text is present (will currently fail) |
| 3. Character limits | Applies (`name` max 80) | **Non-compliant** | Same shared-renderer gap as F1 (R1). | Same as F1. | Shared renderer | Covered by R1's fix |
| 4. Pre-fill | Create form, `category`/`active` default sensibly (`'Internal'`, `true`) from static `initialData` (line 10-16), not from trusted user/entity context — there is none available here | **Not applicable** | No authenticated-user or entity context exists for a demo "create project" form; static defaults for enum/boolean fields aren't "pre-fill" in this rule's sense (no re-typing avoided). | — | — | — |
| 5. Password requirements | No password field | **Not applicable** | Schema has no password field (`forms-demo/schemas.ts:4-10`). | — | — | — |
| 6. Forgiving formatting | `launchDate` is a plain `z.string().date()` (ISO date) fed by a native `<input type="date">` (R3), which already normalises to `YYYY-MM-DD` at the browser widget level | **Compliant** (for `launchDate`) / **Not applicable** (`name`, `tags` are free text with no canonical form) | `date-control.tsx:16-27` uses a native date picker — the browser, not app code, guarantees canonical output. | — | — | — |
| — | Test coverage | — | — | **No test file exists** for this component (`find apps/web/src/features/forms-demo -iname "*.test.*"` → none). | Regressions here would go undetected. | Feature host | Add a baseline render + submit test before or alongside any remediation |

### F4 — `support/tenant-lookup.tsx:TenantLookup`

| Rule | Applicability | Status | Evidence | User impact | Ownership | Suggested regression test |
|---|---|---|---|---|---|---|
| 1. Submission readiness | Applies — one required field (a non-empty id) | **Partially compliant** | `onSubmit` (`tenant-lookup.tsx:35-45`) guards on `tenantId.trim()` being non-empty before doing anything; the submit button is `disabled={!tenantId.trim() \|\| query.isFetching}` (line 64) — this one **does** gate on validity, not just pending, unlike F1/F3, and Enter-key/click both go through the same `onSubmit`. But the `<input>` itself (line 55-59) has neither `required` nor `aria-required` — the same programmatic-required-signal gap flagged as Non-compliant for R1–R5 above; a screen-reader user gets no indication this field is mandatory from the control itself. | Sighted users get correct blocking behaviour; screen-reader users aren't told the field is required. | Feature host (this file; not the shared renderer, since it's hand-built) | Existing coverage unknown — no test file found for this component; add one asserting `aria-required`/`required` is present, and that the disabled state tracks the trimmed value |
| 2. Inline validation | The only "validation" is non-empty-string; there's no format rule beyond that | **Not applicable** | No `z` schema or format constraint governs this field — it's a free-text id looked up server-side (404 handled explicitly at lines 76-80). Rule 2 doesn't apply to a field with no validation rule. | — | — | — |
| 3. Character limits | No declared max length | **Not applicable** | Plain `<input>` with no `maxLength`. | — | — | — |
| 4. Pre-fill | No trusted prior tenant id exists for a fresh lookup | **Not applicable** | Support agents look up an arbitrary tenant; there is no "last tenant" context wired in. | — | — | — |
| 5. Password requirements | No password field | **Not applicable** | — | — | — | — |
| 6. Forgiving formatting | Tenant id is presumably a GUID/canonical id with no natural "typo-tolerant" variants documented | **Unable to verify** | The id format isn't declared client-side (no schema); whether the API is forgiving of e.g. surrounding whitespace isn't observable from this file alone — `tenantId.trim()` is applied before use (line 37), which is a reasonable default, but no documented "harmless variant" policy exists to check against. | — | — | Confirm with the Tenant pillar what id formats are accepted, then either document "no variants exist" (closing this out as N/A) or add normalisation |
| — | Test coverage | — | — | **No test file exists** for this component. | — | Feature host | Add a baseline test (empty id keeps the button disabled; a 404 response renders the not-found message) |

### F5 — `tenants/tenant-open-by-id.tsx:TenantOpenById`

Same shape as F4 (guarded by `disabled={!tenantId.trim()}`, `tenant-open-by-id.tsx:22,60`) and the same gap — **Partially compliant** for Rule 1: submission is correctly blocked, but the `<input>` (`tenant-open-by-id.tsx:50-57`) has neither `required` nor `aria-required`. **Not applicable** for Rules 2–6 for the same reasons as F4. This component *does* have test coverage (`tenant-open-by-id.test.tsx`, passing) — extend it with the `aria-required` assertion.

### F6 — `tenant-settings/tenant-settings.tsx` — tenant-id lookup form

Same shape and same **Partially compliant** Rule-1 verdict as F4/F5 (`disabled={!tenantIdInput.trim() || findQuery.isFetching}`, `tenant-settings.tsx:103`; `<input>` at lines 93-98 has neither `required` nor `aria-required`). Rules 2–6 **Not applicable** for the same reasons as F4.

### F7 — `tenant-settings/tenant-settings.tsx` — settings JSON `<textarea>`

This field lives **outside** the `UpdateTenantForm`'s `<form>` element but is submitted through it via the HTML `form="tenant-update-form"` attribute on the "Save changes" button (`tenant-settings.tsx:169-177`), and is parsed inside `handleNameSubmit` (`tenant-settings.tsx:63-77`), which only runs *after* the name form's own Zod validation has already passed.

| Rule | Applicability | Status | Evidence | User impact | Ownership | Suggested regression test |
|---|---|---|---|---|---|---|
| 1. Submission readiness | Applies — invalid JSON must not reach the API | **Partially compliant** | `parseSettingsText(settingsText)` is called inside `handleNameSubmit` and returns `{ error }` on failure, which sets `clientError` and returns before calling the mutation (`tenant-settings.tsx:66-70`) — so invalid JSON *is* blocked from submission. But the button that triggers this (`form={UPDATE_TENANT_FORM_ID}`, line 171) is a plain submit button with `disabled={updateMutation.isPending}` only (line 173) — same affordance gap as F1/F3, and the JSON error only surfaces after a submit attempt, with no live "is this valid JSON" feedback while typing. | User can type malformed JSON, see no feedback until they click Save, and the button never signals the problem in advance. | Feature host | Interaction test: type invalid JSON, submit, assert `clientError` is shown; separately assert the button gives no advance signal today (documents the gap) |
| 2. Inline validation | Applies — JSON parseability is a validation rule | **Non-compliant** | No `onBlur`/live check exists on the `<textarea>` (`tenant-settings.tsx:157-163`) — the only validation path is the submit-time `parseSettingsText` call described above. | Same as Rule 1 — no feedback until submit. | Feature host | Add a debounced/blur JSON-parse check with an inline error, mirroring Rule 2 |
| 3. Character limits | No declared max length on the settings JSON | **Not applicable** | `<textarea>` has no `maxLength`; the schema is an arbitrary JSON object with no documented size ceiling. | — | — | — |
| 4. Pre-fill | Applies — this is effectively an edit of existing settings | **Compliant** | `settingsText` is seeded from `tenant.settings` via `useEffect` (`tenant-settings.tsx:44-47`) once the entity loads, and stays editable. | User sees current settings JSON, not a blank box. | — | Existing `tenant-settings.test.tsx` likely covers this — confirm/extend to assert the seeded value explicitly |
| 5. Password requirements | No password field | **Not applicable** | — | — | — | — |
| 6. Forgiving formatting | Applies — the field has a canonical form (valid JSON) | **Compliant** | `parseSettingsText` (`tenant-settings/schemas.ts:16-32`) trims the whole textarea before parsing (line 17), uses standard `JSON.parse` (line 22, which already tolerates all non-semantic whitespace/formatting variance inherent to JSON — there's no ambiguity left to "guess" on), and rejects non-object/array-typed JSON with a clear message rather than silently coercing it (lines 27-29). Blank text is treated as "leave unchanged" and documented as such (lines 4-8), not silently interpreted as "clear". | — | — | Already fully covered by the existing `schemas.test.ts` (blank/leave-unchanged, valid object, invalid JSON, non-object JSON) — no gap |

### F8 — `tenants/tenant-search.tsx:TenantSearch`

**Not applicable across all six rules.** This is an instant client-side filter with no submission, no validation, and no persisted value — evidence: no `<form>`, no submit handler, `onChange` fires directly into a filter callback (`tenant-search.tsx:15-23`). None of the six rules (which are all framed around a value that gets *submitted* or *validated*) have a meaningful application here; recorded to make the inventory complete, not because it's a gap.

### F9 — `auth/login-panel.tsx:LoginPanel` / `HomeAuthGate`

**Not applicable across all six rules.** These are OAuth-redirect buttons ("Sign in with Microsoft" / "Sign out"), not data-entry forms — evidence: no `<form>`, no `<input>`, just `onClick` handlers calling `signIn()`/`signOut()` (`login-panel.tsx:49-57,148-156`). Recorded for inventory completeness.

## Findings summary

| Status | Count (rule × form-or-renderer instances, excluding N/A) |
|---|---|
| Compliant | 5 (R4 partial-aria; F2 Rule 4 ×2 consumers counted once; F3 Rule 6 `launchDate`; F7 Rule 4; F7 Rule 6) |
| Partially compliant | 8 (F1/F2/F3 Rule 1; F7 Rule 1; F1 `name` Rule 6; F4/F5/F6 Rule 1) |
| Non-compliant | 8 (R1–R5 Rule 1; R1–R3 Rule 2 combined with F1/F2 hosts; R1 Rule 3; F1/F2 Rule 2; F1 slug Rule 6; F3 Rule 2; F7 Rule 2) |
| Not applicable | the majority of remaining rule×form cells — see tables (each carries its own one-line reason per the skill's requirement) |
| Unable to verify | 1 (F4 Rule 6) |

(Counts are for narrative orientation, not a scoreboard — the tables above are
the source of truth.)

## Remediation ticket drafts

Ordered dependency-first: shared foundations before the feature adoption that
depends on them. Each is implementation-ready and independently mergeable.

### Ticket 1 — Add programmatic `required` signal to all shared field renderers

**Foundation.** Fixes the Rule 1 finding shared by R1–R5.

- **Files:** `packages/forms/src/renderers/{text,select,date,array}-control.tsx`
- **Change:** propagate the existing `required` prop onto the underlying
  form element (`required={required}` and/or `aria-required={required ||
  undefined}`) alongside the current visual asterisk. Match the fix already
  applied to the `form-ux` skill's own worked examples (PR
  singleton-sd/ai-plattform-skills#1, commit `384a995`) for the exact
  pattern.
- **Regression tests:** one assertion per renderer's existing `.spec.ts`
  (or new specs for `text-control`/`date-control`, which currently have
  none — only `array-control.spec.ts` and `select-control.spec.ts` exist)
  asserting `aria-required`/`required` reflects the `required` prop.
- **Depends on:** nothing.

### Ticket 2 — Add a live character counter to `TextControl`

**Foundation.** Fixes the Rule 3 finding shared by R1 and inherited by F1,
F2, F3.

- **Files:** `packages/forms/src/renderers/text-control.tsx`
- **Change:** when `schema.maxLength` is set, render a live `used/max` count
  wired to the same `data` value the control validates, associated via
  `aria-describedby` alongside the existing error id (see the corrected
  example in `.cursor/skills/form-ux/SKILL.md`'s Rule 3 implementation
  section for the exact shape).
- **Regression tests:** new `text-control.spec.ts` (none currently exists)
  covering: no counter when `maxLength` is absent; counter present and
  updates on change when `maxLength` is set.
- **Depends on:** nothing (can land independently of Ticket 1).

### Ticket 3 — Give hosts a way to show errors on blur, and use it in F1/F2

**Foundation + first feature adoption**, because the renderer and the two
hosts that need it belong together (a renderer-only change with no consumer
using it doesn't close the gap).

- **Files:** `packages/forms/src/renderers/text-control.tsx` (and
  `select-control.tsx`, `date-control.tsx` for the same reason),
  `apps/web/src/features/tenants/create-tenant-form.tsx`,
  `apps/web/src/features/tenants/update-tenant-form.tsx`
- **Change:** replace the hardcoded `validationMode="ValidateAndHide"` with
  a per-field "touched" mechanism (blur-triggered) plus a form-level
  "submit attempted" signal, per Rule 2's implementation guidance and the
  corrected JSON Forms example in the skill (handles the "submit before any
  blur" case Codex flagged upstream). Also fix Rule 1's affordance gap while
  touching these two files: gate the submit button's `disabled` on validity
  as well as `isPending`, and surface all invalid fields' messages, not just
  the first Zod issue.
- **Regression tests:** interaction tests on both forms — blur an invalid
  field, assert a field-scoped accessible error appears; submit an
  untouched-but-invalid form, assert the same; submit with multiple invalid
  fields, assert more than the first is communicated.
- **Depends on:** Ticket 1/2 not required but recommended to land first to
  avoid re-touching the same renderer files twice.

### Ticket 4 — Fix `CreateProjectForm`'s premature-error default

**Feature adoption**, independent of Tickets 1–3.

- **Files:** `apps/web/src/features/forms-demo/create-project-form.tsx`
- **Change:** pass an explicit `validationMode` (not the implicit
  `ValidateAndShow` default) so errors don't render before first
  interaction — reuse whatever touched/attempted mechanism Ticket 3
  introduces once it lands, or a local equivalent if this ships first. Also
  gate the submit button on validity (same Rule 1 affordance gap as F1),
  and surface more than the first Zod issue.
- **Regression tests:** add the missing baseline test file for this
  component (none exists today) — cover "no errors on initial mount",
  "errors after interaction/submit attempt", "button disabled state".
- **Depends on:** nothing strictly, but sequence after Ticket 3 to reuse its
  mechanism rather than inventing a second one.

### Ticket 5 — Normalise the tenant `slug` field (case) and trim `name`

**Feature adoption**, independent of the renderer tickets.

- **Files:** `apps/web/src/features/tenants/schemas.ts`
- **Change:** lowercase `slug` before validating (either a Zod
  `.transform()` or in `toCreateTenantPayload`) so mixed-case input is
  accepted and normalised instead of rejected; add `.trim()` to `name` (both
  `createTenantSchema` and `updateTenantSchema`) so whitespace-only values
  don't pass `min(1)`.
- **Regression tests:** `schemas.test.ts` — assert `MyCo` → `myco` passes
  and normalises; assert an all-whitespace `name` fails.
- **Depends on:** nothing.

### Ticket 6 — Add JSON-validity inline feedback to the tenant-settings JSON field

**Feature adoption**, scoped to F7 only.

- **Files:** `apps/web/src/features/tenant-settings/tenant-settings.tsx`
  (and its `schemas.ts`, where `parseSettingsText` lives)
- **Change:** add a blur- or debounce-triggered JSON-parse check with an
  inline, accessibly-associated error on the `<textarea>`, instead of
  surfacing `parseSettingsText`'s result only on submit; gate the Save
  button's `disabled` state on last-known JSON validity in addition to
  `isPending`.
- **Regression tests:** type invalid JSON, blur, assert an inline error
  appears before any submit attempt. `parseSettingsText` itself (Rule 6) is
  already Compliant and fully tested — no change needed there.
- **Depends on:** nothing.

### Ticket 7 — Add `required`/`aria-required` to the hand-built lookup inputs

**Feature adoption**, independent of Ticket 1 (same fix pattern, but these
three forms are hand-built rather than JSON-Forms-driven, so Ticket 1's
renderer fix doesn't reach them). Grouped into one ticket since all three
share the identical one-line fix rather than filing one ticket per form.

- **Files:** `apps/web/src/features/support/tenant-lookup.tsx`,
  `apps/web/src/features/tenants/tenant-open-by-id.tsx`,
  `apps/web/src/features/tenant-settings/tenant-settings.tsx` (the tenant-id
  lookup `<input>` only, not the settings `<textarea>`)
- **Change:** add `required` and `aria-required="true"` to each lookup
  `<input>`, matching the same criterion Rule 1 already applies to the
  shared renderers.
- **Regression tests:** one assertion per component asserting
  `aria-required`/`required` is present on the input.
- **Depends on:** nothing.

### Ticket 8 — Baseline tests for currently-untested form surfaces

**Housekeeping**, unblocks confident future changes to F3 and F4.

- **Files:** new `apps/web/src/features/forms-demo/create-project-form.test.tsx`,
  new `apps/web/src/features/support/tenant-lookup.test.tsx`
- **Change:** no production change — add render/submit/error-path tests
  matching the pattern already used for `tenant-create-drawer.test.tsx` /
  `tenant-details-drawer.test.tsx`.
- **Depends on:** nothing; can land before or in parallel with Tickets 3/4/6
  and should ideally land first so those tickets have a safety net.

Password-requirement UI (Rule 5) has no ticket: there is currently no
password-composition field anywhere in the app (confirmed by repo-wide
search), so there is nothing to remediate. This should be revisited only if
a future ticket introduces local password creation/change.

## Risks and open items

- Rules 2/3 fixes both touch `text-control.tsx`; sequencing Tickets 1–3
  together (or at least in quick succession) avoids repeated review churn on
  the same shared file.
- The one remaining "Unable to verify" finding (F4, Rule 6 — tenant id
  format tolerance) needs a conversation with the Tenant pillar's contract
  before it can be closed out as either Not applicable or a real gap —
  flagged rather than guessed at, per the skill's evidence requirement.
- This audit is static. Blur-order and live-typing timing claims are inferred
  from the presence/absence of `onBlur` handlers and hardcoded
  `validationMode` props, not from an interactive browser session — call
  this out explicitly if any of these findings are disputed in review.
