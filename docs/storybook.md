# Storybook baseline catalogue

Storybook isolates component and page states for `apps/web`. Jest covers unit
logic, MSW supplies deterministic HTTP fixtures, Chromatic reviews visuals, and
Azure SWA remains the assembled-app preview for human testing.

## When a story is required

Add or update stories when a PR changes **user-visible** UI state that reviewers
cannot infer from unit tests alone:

- New or changed reusable primitives under `apps/web/src/components`
- Schema-driven forms that use `@poc-plattform-kit/forms` token renderers
- Assembled API-driven screens that already have MSW handlers

Skip stories for pure logic helpers, telemetry wiring, and non-visual refactors.

## Naming and placement

| Surface | Location | Title pattern |
| --- | --- | --- |
| Reusable component | beside the component as `*.stories.tsx` | `Components/<Name>` |
| Feature / page state | beside the feature entry as `*.stories.tsx` | `Features/<Area>/<Screen>` |
| Story export | PascalCase intent | `Default`, `Loading`, `CollectionEmpty`, `ValidationError` |

Prefer one story per meaningful state. Do not invent states the product cannot
reach.

## Empty-state catalogue (API-driven screens)

For assembled list/workspace screens, keep empty variants **distinct**:

| State | Intent | Tenant workspace example |
| --- | --- | --- |
| First-use / onboarding | Purpose copy + permitted primary action | `CollectionEmpty` |
| Filtered / search no-results | Active query context + clear/reset | `SearchNoResults` |
| Permission-aware empty | Empty collection with unavailable actions omitted | `PermissionAwareEmpty` |
| Goal-complete empty | Positive completion **without** a forced create CTA | Not applicable to Tenants today — do not fabricate |

Never collapse loading, error, permission-denied (failed fetch), and empty into
one screenshot. Assert user-visible copy and actions with `play` functions.

## Determinism

- Use fixtures under `apps/web/src/testing/fixtures` and MSW handlers under
  `apps/web/src/testing/handlers`.
- Prefer fixed ISO dates, stable IDs, and `en-GB` locale helpers already used by
  fixtures.
- Avoid `Math.random()`, `Date.now()`, and live API/Azure calls from decorators.
- Keep toast / animation durations long enough for Chromatic, or pause them in
  story parameters when motion would flake.

## Interaction and accessibility

- Use `play` + `expect` for validation messages, dialogs, empty recovery, and
  permission-gated controls.
- Accessibility runs via `@storybook/addon-a11y` (`parameters.a11y.test = 'error'`
  in `.storybook/preview.tsx`). Fix violations; do not suppress rules globally.

## Local commands

```bash
pnpm --filter @poc-plattform-kit/web run storybook
pnpm --filter @poc-plattform-kit/web run build-storybook
```

Themes: use the Storybook toolbar light/dark switch (`data-theme`). Chromatic
defaults to one 1280 px viewport; add a second viewport on a story only when
layout behaviour materially differs (see `Components/Drawer/OpenNarrow`).

## Definition of Done (UI change)

1. Meaningful visible states have stories (or an explicit N/A note in the PR).
2. Interactive behaviour has `play` assertions where users can act.
3. Fixtures/handlers stay deterministic and offline.
4. `build-storybook` succeeds; a11y does not report serious/critical issues for
   the touched stories.
5. Chromatic / SWA previews remain separate responsibilities.
