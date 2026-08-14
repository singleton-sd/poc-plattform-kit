---
name: Frontend
description: Opinionated React/Next.js frontend guidelines for Singleton SD personal projects. Extends vercel-react-best-practices with a canonical stack (Next.js App Router or React+Vite, Zustand, TanStack Query, Tailwind) and project-type decision rules.
tags: [engineering, frontend, react, nextjs, tailwind, zustand, tanstack-query, performance]
audience: [engineers]
status: stable
---

# Frontend

> First, apply all rules from the **vercel-react-best-practices** skill. The rules below extend and override that baseline for Singleton SD personal projects.

---

## Stack Decision

Before writing any code, pick the right project type:

| Scenario | Stack |
|---|---|
| SEO matters, auth required, or DB access needed | **Next.js App Router** |
| Pure client-side tool, dashboard, or internal app | **React + Vite SPA** + NestJS API |
| Need a real backend for either type above | **NestJS** |

Default to **Next.js App Router** when in doubt — you can always skip the server features.

---

## Canonical Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js App Router | Server components, routing, built-in SSR/SSG |
| Styling | Tailwind CSS | Utility-first, no context switching |
| Server state | TanStack Query | Caching, loading, error states out of the box |
| Client state | Zustand | Zero boilerplate, Redux DevTools support, simple API |
| Language | TypeScript | Always |
| Forms | Zod → JSON Schema → JSON Forms | Schema-driven data-entry; see **schema-driven-forms** skill |

---

## Forms

Default data-entry forms use **Zod → JSON Schema → [JSON Forms](https://jsonforms.io/)** with **custom Tailwind + Singleton SD token renderers** (not Material UI).

Before building or changing forms, read and apply the **schema-driven-forms** skill (`.cursor/skills/schema-driven-forms`). Produce both schema transformation and React wiring. Escape hatch for highly custom UX: hand-built controls + Zod.

Also apply the **form-ux** skill (`.cursor/skills/form-ux`) for submission validity, inline-validation timing, character limits, pre-fill, password UX, and forgiving-input rules — it complements schema-driven-forms rather than replacing it.

---

## State Separation Rule

- **Server state** (anything fetched from an API) → TanStack Query
- **Client state** (UI-only: modals open, selected tab, form draft) → Zustand
- Never put server data into Zustand manually — that's what TanStack Query's cache is for

---

## Project Setup Checklist

When bootstrapping a new frontend project:

### Next.js App Router
```bash
npx create-next-app@latest --typescript --tailwind --eslint --app --src-dir
npm install @tanstack/react-query @tanstack/react-query-devtools zustand
```

Wire up TanStack Query in `src/app/providers.tsx`:
```tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools />
    </QueryClientProvider>
  );
}
```

Add to `src/app/layout.tsx`:
```tsx
import { Providers } from './providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

### React + Vite SPA
```bash
npm create vite@latest my-app -- --template react-ts
npm install @tanstack/react-query @tanstack/react-query-devtools zustand tailwindcss @tailwindcss/vite
```

---

## Zustand Conventions

One store per domain, not one global store:

```ts
// stores/ui.ts — UI-only state
import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
```

Never replicate API response data in a Zustand store. Use `useQuery` from TanStack Query instead.

---

## TanStack Query Conventions

Co-locate query definitions with their feature, not in a global `queries/` folder:

```ts
// features/users/queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const userKeys = {
  all: ['users'] as const,
  detail: (id: string) => ['users', id] as const,
};

export function useUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => fetchUser(id),
  });
}
```

---

## Tailwind Conventions

- Use `cn()` (clsx + tailwind-merge) for conditional classes — never string concatenation
- Extract repeated class groups into component variants, not `@apply`
- Keep layout concerns (flex, grid, spacing) in the parent; keep visual concerns (color, border, shadow) in the component

```bash
npm install clsx tailwind-merge
```

```ts
// lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## File Structure

```
src/
  app/              # Next.js App Router pages (or pages/ for Vite)
  components/       # Shared UI components (Button, Modal, etc.)
  features/         # Domain slices — each owns its queries, hooks, components
    users/
      queries.ts
      UserCard.tsx
      useUserForm.ts
  stores/           # Zustand stores (UI state only)
  lib/              # Utilities (cn, api client, etc.)
  types/            # Shared TypeScript types
```

---

## Rules

- Always use TypeScript strict mode
- No `any` — use `unknown` and narrow, or generate types from the API schema
- Prefer Server Components by default in Next.js; only add `'use client'` when you need interactivity or browser APIs
- Keep components small — if a component file exceeds ~150 lines, extract
- One component per file, filename matches the component name (PascalCase)

---

## Storybook / Chromatic (this kit)

When adding or debugging `*.stories.tsx` or Chromatic snapshots in
`poc-plattform-kit`, read and apply the kit-local **storybook** skill
(`.cursor/skills/storybook`). Catalogue and Definition of Done:
[`docs/storybook.md`](../../../docs/storybook.md).

A passing `play` function is not proof Chromatic captured the subject.
Fixed drawers, sticky footers, and nested overlays need an in-flow harness
with an explicit frame — see that skill before iterating on viewports or
`cropToViewport`.
