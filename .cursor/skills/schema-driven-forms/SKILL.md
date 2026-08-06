---
name: Schema-driven Forms
description: Build data-entry forms with Zod → JSON Schema → JSON Forms (jsonforms.io), custom Tailwind/token renderers, and typed submit wiring. Use when creating or changing UI forms, form schemas, JSON Forms renderers, or schema-driven admin/console inputs in poc-plattform-kit.
tags: [engineering, frontend, forms, zod, json-schema, jsonforms, react, tailwind]
audience: [engineers]
status: stable
---

# Schema-driven Forms

> Default UI forms toolchain for Singleton SD / poc-plattform-kit.
> Pair with the **frontend** skill for Next.js, TanStack Query, Tailwind, and tokens.
> Architecture Doc: ClickUp page **Schema-driven Forms (UI)** under doc `2kz0kcnk-1416`.

---

## Locked pipeline

```
Zod schema (TS source of truth)
        ↓  zod-to-json-schema (or Zod 4 equivalent)
JSON Schema
        ↓  + explicit UI Schema
JSON Forms (@jsonforms/core + @jsonforms/react)
        ↓  custom React renderers (Tailwind + Singleton SD tokens)
Form UI → typed submit → Nest API (class-validator DTOs)
```

| Layer | Role |
| --- | --- |
| **Zod** | Author form shape, refine/transform, `z.infer` types |
| **JSON Schema** | Interchange for JSON Forms validation/rendering |
| **UI Schema** | Layout, grouping, visibility rules — not optional |
| **JSON Forms** | Schema-driven control tree ([jsonforms.io](https://jsonforms.io/)) |
| **Custom renderers** | Visual system — **never** default to Material UI renderers |

Forms are **one** schema-driven component family. Other UI stays hand-built.

---

## When to use / when not to

**Use** for:

- Create/edit entity forms (tenants, contacts, support admin, settings)
- Admin consoles where fields largely mirror a domain schema
- Repeated CRUD forms that benefit from shared renderers

**Do not force** for:

- Highly custom multi-step wizards with heavy side effects
- Drag-and-drop builders, rich canvases, or one-off interactive UX
- Pure display / read-only views (use normal components)

Escape hatch: hand-built controls + Zod (optionally react-hook-form later). Still prefer Zod as the client-side schema.

---

## Canonical dependencies (names)

Until `packages/forms` exists, document these as the intended installs:

| Package | Purpose |
| --- | --- |
| `zod` | Form schema + inferred types |
| `zod-to-json-schema` | Zod → JSON Schema (Zod 3); use Zod 4 built-in/`z.toJSONSchema` when on Zod 4 |
| `@jsonforms/core` | Core engine, testers, UI Schema types |
| `@jsonforms/react` | React bindings (`JsonForms`, renderer props) |

**Do not** add `@jsonforms/material-renderers` as the default kit. It conflicts with Tailwind + [Singleton SD tokens](https://tokens.design.singletonsd.com/).

Future shared home: `@poc-plattform-kit/forms` under `packages/forms` — not `packages/config`.

---

## Agent output requirements

When implementing a form, produce **both**:

1. **Transformation** — Zod schema → JSON Schema helper + UI Schema
2. **UI wiring** — client host component, renderer registry, submit/error mapping, TanStack Query mutation handoff

Do not stop at schemas alone.

---

## Pipeline steps

### 1. Author Zod

```ts
import { z } from 'zod';

export const createContactSchema = z.object({
  displayName: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().optional(),
  active: z.boolean().default(true),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
```

- Co-locate schema with the feature (`features/<domain>/schemas.ts`) or export from `@poc-plattform-kit/forms` when shared.
- Prefer `.default` / `.optional` explicitly so JSON Schema generation is predictable.

### 2. Convert to JSON Schema

```ts
import { zodToJsonSchema } from 'zod-to-json-schema';

export const createContactJsonSchema = zodToJsonSchema(createContactSchema, {
  name: 'CreateContact',
  $refStrategy: 'none',
});
```

- Strip or avoid `$ref` cycles when feeding JSON Forms (`$refStrategy: 'none'` is usually safest for forms).
- Keep a single conversion helper in the forms package once it exists.

### 3. Author UI Schema

```ts
import type { UISchemaElement } from '@jsonforms/core';

export const createContactUiSchema: UISchemaElement = {
  type: 'VerticalLayout',
  elements: [
    {
      type: 'Group',
      label: 'Contact',
      elements: [
        { type: 'Control', scope: '#/properties/displayName' },
        { type: 'Control', scope: '#/properties/email' },
        { type: 'Control', scope: '#/properties/phone' },
        { type: 'Control', scope: '#/properties/active' },
      ],
    },
  ],
};
```

Common patterns:

| UI Schema | Use |
| --- | --- |
| `VerticalLayout` / `HorizontalLayout` | Stack or row |
| `Group` | Section with label |
| `Control` + `scope` | Bind to `#/properties/...` |
| `Rule` (`EFFECT` SHOW/HIDE/ENABLE/DISABLE) | Conditional fields |

### 4. Wire JSON Forms + custom renderers

```tsx
'use client';

import { useMemo, useState } from 'react';
import { JsonForms } from '@jsonforms/react';
import { createContactJsonSchema } from './schemas';
import { createContactUiSchema } from './uischema';
import { tokenRenderers, tokenCells } from '@poc-plattform-kit/forms'; // future
import { useCreateContact } from './queries';

export function CreateContactForm() {
  const [data, setData] = useState<Record<string, unknown>>({});
  const mutation = useCreateContact();

  const schema = useMemo(() => createContactJsonSchema, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(data as CreateContactInput);
      }}
      className="flex flex-col gap-4"
    >
      <JsonForms
        schema={schema}
        uischema={createContactUiSchema}
        data={data}
        renderers={tokenRenderers}
        cells={tokenCells}
        onChange={({ data: next }) => setData(next)}
      />
      <button
        type="submit"
        className="rounded-md bg-[var(--accent-primary)] px-4 py-2 text-[var(--fg-on-accent)]"
        disabled={mutation.isPending}
      >
        Save
      </button>
    </form>
  );
}
```

- Host is a Client Component (`'use client'`).
- Submit via TanStack Query `useMutation` — do not put server entities in Zustand.
- Map API validation errors onto field paths when the API returns structured errors.

---

## Custom renderer checklist

Implement (or extend) a shared renderer set styled with **token CSS vars + Tailwind only** — no hardcoded palette hex.

Minimum controls:

- [ ] Text / email / password / number inputs
- [ ] Textarea
- [ ] Select / enum
- [ ] Checkbox / boolean
- [ ] Date (and datetime if needed)
- [ ] Array (add/remove rows)
- [ ] Group / layout chrome

For each control:

- Label + `htmlFor` / `aria-*` for a11y
- Show JSON Forms / AJV error messages under the field
- Disabled / read-only from UI Schema rules
- Use `cn()` for conditional classes
- Colors via `var(--fg-*)`, `var(--bg-*)`, `var(--accent-*)`, etc.

Register with rank testers (`rankWith`, `isStringControl`, …) from `@jsonforms/core`. Prefer one registry exported from the forms package.

---

## Validation split (locked for now)

| Surface | Owner |
| --- | --- |
| Client UX (required, format, refine) | Zod + JSON Forms |
| API contract / security | Nest `ValidationPipe` + **class-validator** DTOs |

- Zod does **not** replace server validation.
- Do not claim a single schema secures the API until a later shared-contract story (OpenAPI and/or shared Zod).
- Keep DTO fields aligned with form payloads by convention; document drift in the PR if unavoidable.

---

## Package layout (future)

```
packages/forms/
  package.json          # @poc-plattform-kit/forms
  src/
    convert.ts          # zod → JSON Schema helper
    renderers/          # token/Tailwind JSON Forms renderers
    registry.ts         # renderers + cells export
    index.ts
```

Feature-local:

```
apps/web/src/features/<domain>/
  schemas.ts
  uischema.ts
  CreateXForm.tsx
  queries.ts
```

---

## Anti-patterns

- Using `@jsonforms/material-renderers` (or MUI/Chakra/antd) as the visual system
- Hardcoded hex colors in form controls
- Skipping UI Schema and relying on JSON Forms defaults for production layouts
- Putting form submit server state in Zustand
- Generating forms from Nest DTOs only (no Zod) without an agreed codegen path
- Treating JSON Schema as the human-authored source — author in Zod

---

## Cross-links

- Frontend skill: `.cursor/skills/frontend`
- Tokens: https://tokens.design.singletonsd.com/
- JSON Forms: https://jsonforms.io/
- ClickUp Architecture Doc: https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- Backend validation: Nest class-validator (backend skill) — separate from this pipeline
