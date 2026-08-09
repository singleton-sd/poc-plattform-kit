---
name: Form UX
description: Define and audit form UX rules for submission validity, inline validation timing, live character limits, trusted pre-fill, dynamic password requirements, and forgiving input normalisation. Use in implementation mode when building or modifying any form (native HTML, hand-built React, or schema-driven Zod/JSON Schema/JSON Forms) and in audit mode when reviewing an existing form, PR, or shared renderer for compliance. Complements a project's frontend and schema-driven-forms guidance; never replaces server-side/API validation.
tags: [engineering, frontend, forms, ux, accessibility, validation, review]
audience: [engineers, tech-leads]
status: stable
---

# Form UX

One canonical rule set, two modes:

- **Implementation mode** — apply these rules while building or modifying a form.
- **Audit mode** — evaluate an existing form, PR, or shared renderer against these rules and produce evidence-backed findings.

Both modes score the same six rules. This skill governs **client-side UX only** — see [Client UX vs. API/security validation](#client-ux-vs-apisecurity-validation) before applying it.

---

## Before scoring: determine applicability

Not every rule applies to every form or field. Each rule below has an **Applies when** / **Not applicable when** test. Check it first. A rule that legitimately doesn't apply is not a gap — record it as **Not applicable** with a one-sentence reason (see [Documenting exceptions](#documenting-exceptions)). Never force password-requirement UI, pre-fill, or formatting-normalisation behaviour onto a field that has no use for it.

---

## The six rules

### 1. Submission readiness

Prevent invalid submission while clearly explaining what is incomplete or wrong.

**Applies when:** the form has any required or validated field.
**Not applicable when:** every field is optional with no validation (e.g. a free-text feedback box with no constraints) — state that explicitly rather than skipping the row.

Required:

- Required fields carry a visible marker (e.g. `*`, "required") **and** a programmatic signal (`required`, `aria-required="true"`, or schema `required` reflected into the UI).
- Invalid submission is blocked through **every** entry point: submit button click, Enter-key (native form submit), and any programmatic submission. The gate must live in the submit handler / form-level validation, not only in a button's `disabled` attribute — a disabled button does not stop a native form `submit` event triggered by Enter in another field, and does not stop a caller invoking the handler directly. For programmatic submission specifically: trigger it via `formEl.requestSubmit()`, which fires the same `submit` event and constraint validation as a real click — never the legacy `formEl.submit()`, which bypasses both and reaches the network with no client gate at all.
- On a blocked submit attempt, the user is told **which** field(s) are missing or invalid — not just that "the form is invalid". A single generic message that names only the first error is a partial pass at best; per-field messaging (or a summary that links/scrolls to each invalid field) is the full pass. This still applies to a field the user never interacted with (never blurred) — a submit attempt is itself a validation trigger (see Rule 2), so an untouched invalid field must show its error once submission is attempted, not stay silent because blur never fired.
- **Invalid** and **pending** are distinct states. A pending (in-flight) submit disables the control and shows a busy affordance ("Saving…"); an invalid form should visibly signal invalidity (e.g. a disabled-with-reason or visibly flagged control) independent of whether a request is in flight. Do not use one `disabled` condition to mean both.

**Audit checks:** find the submit handler. Confirm it re-validates before calling the mutation/fetch, regardless of what the trigger button's `disabled` state is. Confirm the error message construction — does it enumerate all invalid fields or only the first? Confirm the "disabled" condition on the submit control — is it `isPending` only, or `isPending || !isValid`? Search for any `.submit()` call on a form element and flag it — it skips both the `submit` event and constraint validation, so this rule's gate cannot run.

---

### 2. Inline validation

Validate after meaningful interaction, then continue validating while the user corrects the value.

**Applies when:** the field has any validation rule (format, required, min/max, refine).
**Not applicable when:** the field has no validation rule at all (still evaluate the rest of the field set).

Required:

- No error is shown before the user has interacted with the field (on mount, or immediately on first keystroke). The first validation pass fires on **blur** (or an equivalent "meaningful interaction" boundary — e.g. leaving a step in a wizard) or on a submit attempt, whichever comes first.
- After that first pass, subsequent edits to the same field re-validate live, so a correction clears its error as soon as the value becomes valid (do not require another blur to clear an error that blur first raised).
- Errors are accessibly associated with their control: `aria-invalid="true"` on the input and `aria-describedby` pointing at the error text's `id`. A visual-only error (color or icon with no programmatic association) is a partial pass.
- Server-side validation is retained, not replaced. When the API returns structured field errors, map them onto the corresponding field (same accessible-association requirement) instead of only surfacing a generic banner.

**Audit checks:** render (or trace) the field before interaction — is an error visible? Find the validation trigger — is it wired to `onBlur`/equivalent, or does a global "hide errors always" mode suppress it regardless of interaction? Check whether the renderer reads and displays a per-field error object at all (a shared renderer can be capable of this while a specific host form suppresses it — audit both layers separately). Check the API error-handling path for field-level mapping.

---

### 3. Character limits

Show a live used/remaining count for any field with a length ceiling.

**Applies when:** the field's schema declares a maximum length (`z.string().max(n)`, JSON Schema `maxLength`, DB column limit surfaced to the client, etc.).
**Not applicable when:** the field has no declared maximum length.

Required:

- The count is visible and updates as the user types, not only after blur or submit.
- The count is programmatically associated with the field (`aria-describedby`, or a live region if it needs to be announced) — not purely decorative text with no relationship to the input.
- Over-limit behaviour is defined and consistent: either the input hard-stops at the limit (`maxLength` attribute) or the UI clearly flags the overage as an error: pick one, document which, and apply it consistently across the field set.
- The count reflects the **value that will actually be validated** — if the value is trimmed or normalised before validation/submit (see Rule 6), the count must track the post-normalisation length, not a stale pre-normalisation one, or the two will disagree at the boundary.

**Audit checks:** find every field whose schema declares a max length. For each, confirm a live counter exists and is wired to the same value used for validation/submit — a schema `max(n)` with no counter in the corresponding renderer is a clear gap.

---

### 4. Pre-fill

Pre-populate fields from trusted, already-known data.

**Applies when:** trusted context exists — the authenticated user's own profile fields, the entity being edited, a prior step's answer in a multi-step flow.
**Not applicable when:** the form genuinely has no trusted source (e.g. an anonymous public contact form, or a "create new" form with no plausible default) — state why no source exists.

Required:

- Edit/update forms initialise their fields from the fetched entity, not from a blank default that the user must re-type.
- Pre-filled fields stay editable unless the field is **intentionally** read-only (e.g. an immutable slug/ID) — and that read-only decision is deliberate, not an accident of how the data loads.
- Secrets are never pre-filled from storage. A password field is never populated with a stored value, hash, or placeholder that implies a real value exists — see Rule 5.

**Audit checks:** for edit/update forms, confirm the initial field values are derived from fetched entity data (props, query cache, loader data) rather than hardcoded empty defaults. Confirm no field marked read-only is read-only merely because of an implementation shortcut rather than a real business rule. Confirm no password/secret field ever receives a stored value.

---

### 5. Password requirements

Show composition requirements before submit, and keep them live.

**Applies when:** the form creates or changes a password subject to a composition policy (length, character classes, etc.).
**Not applicable when:** there is no password field, or the password field is a login field with no client-checkable composition policy (the server is the only source of truth there) — state which.

Required:

- Requirements are visible **before** the user attempts to submit, not only surfaced after a failed submit.
- Each requirement's met/unmet state updates live as the user types.
- State is never communicated by colour alone — pair colour with text and/or an icon with an accessible label (e.g. `aria-hidden` icon + visually-present text, or `sr-only` text).
- The password value itself is never logged, sent to analytics/telemetry, included in audit trails, or echoed back in any error message or pre-filled field.

**Audit checks:** find every password-composition field. Confirm the requirements list exists and check when it becomes visible. Confirm the live-update wiring (`onChange`, not only `onSubmit`). Confirm requirement indicators carry text/icon state, not colour-only classes. Grep the password value's variable/prop through logging, analytics, and audit-event call sites to confirm it never reaches them.

---

### 6. Forgiving formatting

Accept harmless input variants; normalise safely at one documented boundary.

**Applies when:** the field has a canonical machine form that differs from how people naturally type it (phone numbers, email casing/whitespace, codes with optional separators).
**Not applicable when:** the field is genuinely free-form with no canonical form to normalise toward (a name, a notes field) — trimming leading/trailing whitespace is still good practice but is not "normalisation" in this rule's sense.

Required:

- Documented harmless variants are accepted without the user having to fix them manually (e.g. a phone field accepts spaces, dashes, and parentheses; an email field tolerates surrounding whitespace and case).
- Normalisation happens at exactly one documented boundary (e.g. always on blur, or always immediately before validation/submit) — not inconsistently in some code paths and not silently rewriting what the user sees while they are still typing.
- The value that is **validated** is the normalised/canonical value, not the raw pre-normalisation string (a mismatch here is how "valid" input gets rejected, or invalid input slips through).
- When an input is genuinely ambiguous (e.g. a phone number that could be missing a country code, in a system that serves multiple countries), the rule is to ask, not guess: preserve the original input and prompt for clarification rather than silently picking an interpretation.

**Audit checks:** find fields with a canonical form. Confirm which variants are accepted vs. rejected, and whether that behaviour is documented anywhere. Confirm there is a single, identifiable normalisation point rather than duplicated/divergent logic. Confirm the normalised value is what gets validated and submitted. Look for any case where an ambiguous value is silently rewritten instead of flagged.

---

## Client UX vs. API/security validation

This skill is about **client-side UX**, not the security boundary. It must never be used to justify:

- Removing, weakening, or bypassing server-side validation (e.g. Nest `ValidationPipe` + `class-validator` DTOs, or the equivalent in another stack).
- Treating client-side normalisation (Rule 6) as if it secures the API — the server re-validates and re-normalises independently and remains the source of truth.
- Skipping server-side checks because "the client already validates it".

When implementing or auditing, call out explicitly if a change (or a finding) touches the security boundary — that is out of this skill's scope and belongs in backend/API review instead.

---

## Documenting exceptions

Every **Not applicable** result — in implementation or audit mode — must carry a one-sentence reason. "N/A" alone is not sufficient. In implementation mode, put the reason in a short code comment next to the field/schema; in audit mode, put it in the audit table's Evidence column. A missing reason is itself a finding.

---

## Implementation mode

When creating or modifying a form:

1. List the fields. For each field, check applicability for all six rules — do not skip a rule silently.
2. Wire submission readiness (Rule 1): required markers, a submit-handler-level validity gate that covers button/Enter/programmatic submission, and per-field (not just first-error) explanation on a blocked attempt.
3. Wire inline validation (Rule 2): first validation on blur or submit, live re-validation while correcting, accessible error association, and structured server-error mapping.
4. Add live character counts (Rule 3) for every field with a declared max length, tied to the same value that gets validated.
5. Pre-fill (Rule 4) from trusted context on edit/update forms and anywhere else trusted context exists; keep fields editable unless deliberately read-only.
6. Add dynamic, non-colour-only password requirement feedback (Rule 5) wherever a composition policy exists; never let the password value reach logs, analytics, or audit trails.
7. Normalise forgivingly (Rule 6) at one documented boundary; validate the normalised value; never guess on ambiguous input.
8. Document every Not-applicable rule inline (see above).
9. Do not weaken server-side validation to satisfy any of the above.

### Example: schema-driven (Zod → JSON Schema → JSON Forms) — custom renderer

```ts
// schema.ts
import { z } from 'zod';

export const createAccountSchema = z.object({
  displayName: z.string().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().optional(),
});
```

```tsx
// text-control.tsx — a custom JSON Forms renderer applying rules 1-3
import { isStringControl, rankWith, type ControlProps, type RankedTester } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';

function TextControlRenderer(props: ControlProps) {
  const { data, handleChange, path, label, required, errors, id, schema, uischema } = props;
  const inputId = id || path;
  const invalid = Boolean(errors);
  const maxLength = schema.maxLength;
  const touched = useTouched(path); // first shown on blur — Rule 2
  const submitAttempted = useFormSubmitAttempted(); // host sets this true on a blocked submit
  const showError = invalid && (touched || submitAttempted);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={inputId}
        value={data ?? ''}
        maxLength={maxLength}
        required={required}
        aria-required={required || undefined}
        aria-invalid={showError}
        aria-describedby={
          [showError ? `${inputId}-error` : null, maxLength ? `${inputId}-count` : null]
            .filter(Boolean)
            .join(' ') || undefined
        }
        onBlur={() => markTouched(path)}
        onChange={(e) => handleChange(path, e.target.value)}
      />
      {maxLength ? (
        <p id={`${inputId}-count`} className="text-xs">
          {(data ?? '').length}/{maxLength}
        </p>
      ) : null}
      {showError ? (
        <p id={`${inputId}-error`} role="alert">
          {errors}
        </p>
      ) : null}
    </div>
  );
}

export const textControlTester: RankedTester = rankWith(3, isStringControl);
export const TextControl = withJsonFormsControlProps(TextControlRenderer);
```

`showError` reacts to **either** signal — blur (`touched`) or a blocked submit attempt
(`submitAttempted`, set by the host's submit handler and read here from shared/context
state) — so an untouched-but-invalid field still explains itself when the user submits
without ever blurring it (e.g. pressing Enter right after focusing a single field). A
blur-only predicate would silently hide that error, contradicting Rule 1.

A blur-tracked `validationMode` (or an equivalent per-field "touched" model, as above) is required if the schema-driven host sets a validation mode that hides errors — see the audit checks in Rule 2. A hardcoded "always hide errors" mode with no toggle is a Rule 2 failure regardless of what the renderer is capable of.

### Example: hand-built React form

```tsx
function SignupForm() {
  const [rawEmail, setRawEmail] = useState('');
  const [touched, setTouched] = useState(false); // Rule 2: first shown on blur...
  const [attempted, setAttempted] = useState(false); // ...or on a submit attempt, whichever is first
  const email = normalise(rawEmail); // Rule 6: normalise once; validate and submit THIS value
  const errors = validate({ email }); // validates the normalised value, not the raw string
  const showError = Boolean(errors.email) && (touched || attempted);

  function handleSubmit(e: FormEvent) {
    // Fires on button click and Enter-key alike (both dispatch a `submit` event
    // this listener catches). It does NOT fire for a bare `formEl.submit()` call —
    // that native method bypasses both the `submit` event and constraint
    // validation. Route any programmatic submission through
    // `formEl.requestSubmit()` instead (or call this same handler directly), or
    // this gate is silently skippable.
    e.preventDefault();
    setAttempted(true);
    if (errors.email) return; // Rule 1: block + rely on the per-field error below
    onSubmit({ email }); // already the normalised value
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        required
        aria-required="true"
        aria-invalid={showError}
        aria-describedby={showError ? 'email-error' : undefined}
        value={rawEmail} // raw value while the user is still typing — Rule 6 doesn't rewrite it live
        onBlur={() => setTouched(true)}
        onChange={(e) => setRawEmail(e.target.value)}
      />
      {showError ? (
        <p id="email-error" role="alert">
          {errors.email}
        </p>
      ) : null}
    </form>
  );
}
```

---

## Audit mode

1. Inventory every user-facing form and every shared renderer that forms depend on. Audit shared renderers first — a renderer-level gap affects every consumer; a host-form gap affects only that form.
2. For each form/field, evaluate all six rules against the applicability tests above. Cite exact evidence: file path, line/symbol, and observable behaviour (not an inferred guess). If interaction timing or accessibility cannot be confirmed statically, mark it **Unable to verify** and say what manual/interactive check would resolve it — do not claim compliance you have not observed.
3. Use this status vocabulary only: **Compliant**, **Partially compliant**, **Non-compliant**, **Not applicable** (reason required), **Unable to verify** (reason required).
4. Record findings in this table shape:

| Location (path:symbol) | Rule | Applicability | Status | Evidence | User impact | Recommended ownership layer | Suggested regression test |
|---|---|---|---|---|---|---|---|
| `packages/forms/src/renderers/text-control.tsx:TextControlRenderer` | 2. Inline validation | Applies | Compliant | Renders `aria-invalid`/`aria-describedby` + `role="alert"` when an `errors` string is present (lines 9, 27-32) | N/A — capability, not yet a gap | Shared renderer | Renderer unit test asserting `aria-describedby` is set when `errors` is passed |
| `apps/web/src/features/tenants/create-tenant-form.tsx:CreateTenantForm` | 2. Inline validation | Applies | Non-compliant | `validationMode="ValidateAndHide"` is a hardcoded prop with no toggle; per-field errors from `TextControl` are never shown; only a single generic message from `parsed.error.issues[0]` is surfaced after submit, unassociated with any field | User who mistypes one field gets no feedback until submit, and then only a generic message that doesn't say which field | Feature host (`create-tenant-form.tsx`) | Interaction test: blur an invalid field, assert a field-scoped, accessibly-associated error appears |

5. Group remediation drafts by **shared foundation first, then feature adoption** — a renderer/registry fix that many forms depend on should be one ticket, not one ticket per consuming form.
6. Do not implement remediation during an audit. The audit changes no production behaviour.

---

## Worked examples

**Compliant** — an edit form seeding its field from the fetched entity and leaving it editable satisfies Rule 4 (Pre-fill): `initialName` (sourced from the entity load) seeds form state via `useEffect`, and the resulting input has no `disabled`/`readOnly` derived from that value.

**Non-compliant** — a form whose submit button is `disabled={mutation.isPending}` only, with no reference to form validity, fails part of Rule 1: the button offers no proactive signal that required fields are missing, even though (if the submit handler separately re-validates) invalid data may still be blocked from reaching the API. Score the button-affordance gap and the actual-blocking behaviour separately — they are not the same check.

**Not applicable** — Rule 5 (Password requirements) is Not applicable to a form set with zero password-composition fields (e.g. an application whose auth is entirely delegated to an external identity provider). Record it once, with that reason, rather than omitting Rule 5 from the audit silently.

---

## Cross-links

- If this project has schema-driven forms tooling (Zod → JSON Schema → JSON Forms, or an equivalent pipeline), apply these six rules to its shared renderers and to every host form built on it.
- Pair with this project's **frontend** guidance for framework/state conventions, and **code-review** guidance when reviewing a PR that touches a form.
