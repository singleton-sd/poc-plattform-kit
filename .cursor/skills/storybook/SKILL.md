---
name: storybook
description: >-
  Write and debug Storybook stories and Chromatic snapshots for apps/web.
  Use when adding or changing *.stories.tsx, when Chromatic diffs look identical,
  when a snapshot is clipped or missing a footer/dialog, or when Chromatic
  reports that story resources failed to load.
tags: [engineering, frontend, storybook, chromatic, ui]
audience: [engineers, agents]
status: stable
---

# Storybook and Chromatic

Catalogue, naming, MSW, and Definition of Done:
[`docs/storybook.md`](../../../docs/storybook.md).

This skill is the capture playbook. A `play` assertion passing does **not**
mean Chromatic photographed the thing you care about.

## Before you snapshot

1. Name the **visual subject** (footer Save gate, dialog overlay, empty list).
   Everything else is noise.
2. Confirm the subject is inside Chromatic's captured box, not only in the DOM.
3. Look at the Chromatic image, not Storybook canvas. If two stories look the
   same in Chromatic, the crop is wrong even when `play` is green.

Global default is **one 1280 px Chromium viewport**. Add another viewport only
when the subject is invisible or tiny at 1280 (see `Components/Drawer/OpenNarrow`
at 375). Do not add viewports "for coverage".

## `position: fixed` and sticky footers

Chromatic snapshots `#storybook-root`. Fixed drawers (`fixed inset-0`,
`fixed inset-y-0 right-0`) do not give that root a natural size. A 1280-wide
shot buries a 420 px rail footer, or clips it entirely.

**Do this in the story harness (not production):**

- Wrap the component in a frame with **explicit width and height**.
- Put `transform: translate(0)` on the frame so nested `position: fixed`
  descendants (dialogs) are contained by the frame instead of the viewport.
- Force the drawer/panel to `position: relative` with `inset: auto` so it
  participates in document flow.
- Hide the drawer backdrop.

Worked example: `apps/web/src/features/tenants/tenant-details-drawer.stories.tsx`.

## Footer-only vs overlay stories

| Story intent | Frame | Body | Dialog |
| --- | --- | --- | --- |
| Distinct footer states (allowed / denied / pending / error) | Compact (e.g. 375 × ~280). Hide the form body. | Hidden | Closed |
| Overlay on the host (Request Access over the drawer) | Tall enough for the **full dialog** (e.g. 375 × 720). Keep the body. | Visible | Open via `play` |

Do **not** set the overlay to `position: absolute; inset: 0` if it is rendered
**inside the footer**. That makes Chromatic treat the short footer as the
snapshot box: the title clips, the host disappears, and the dialog looks
left-shifted on a black field.

`cropToViewport` and `ignoreSelectors` do not fix a clipped fixed/sticky
footer. Pin the shell in flow first.

`play` should wait for the distinctive control (`tenant-update-submit`,
`permission-gate-request-cta`, `permission-gate-status`, `permission-gate-retry`,
or the dialog heading). That still only proves DOM. Confirm the Chromatic
image shows those controls.

## Resource-load warnings

Chromatic may say it could not fetch story resources from the published
Storybook CDN and suggest serving static assets from Storybook. This kit
already uses `staticDirs: ['../public']` in `apps/web/.storybook/main.ts`.

Treat a clipped or identical snapshot as a **layout/capture** bug first. A
resource warning on a new story often rides along with a too-small frame or a
fixed overlay overflowing the root. Do not "fix" it by disabling the snapshot.

If a real asset 404s: import it or put it under `apps/web/public` (MSW worker
already lives there). Do not point stories at live Entra, Nest, or token CDNs.

## Checklist

- [ ] Subject is obvious in a Chromatic thumbnail (not only after zooming a 1280 desktop crop).
- [ ] Each state story shows a **different** control or copy.
- [ ] Overlay stories show the host **and** the full dialog title/actions.
- [ ] Handlers stay offline (`meSignedInHandlers` + feature MSW; `onUnhandledRequest: 'error'`).
- [ ] `build-storybook` succeeds. Visual accept in Chromatic stays human-only.
