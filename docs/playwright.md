# Playwright web journeys

Playwright covers a deliberately small set of full-application browser journeys.
Jest remains the unit/component logic layer, Storybook isolates deterministic UI
states, Chromatic reviews component visuals, and Azure SWA remains the assembled
preview for human testing.

## Initial scope

The Chromium-only suite verifies:

- signed-out application boot and PWA manifest wiring;
- navigation from the app to the public changelog and back; and
- the legacy `/login` redirect.

The suite intercepts `/api/me` with an unauthenticated `401` response. This
exercises the application's normal signed-out behavior; it does not disable,
replace, or weaken Entra or OpenFGA. Every run aborts HTTP(S) requests whose
origin is not the configured application base (`PLAYWRIGHT_BASE_URL` or the
local static export on `http://127.0.0.1:4173`) and not loopback, so a run
cannot contact production, telemetry, token, or other third-party hosts.

Authenticated and tenant-domain journeys are intentionally deferred until a
sanctioned non-production Entra identity, secure storage-state lifecycle, and
isolated tenant data exist. ClickUp follow-up:
[`Add secure authenticated Playwright journeys`](https://app.clickup.com/t/86d3zkp7k).
Never substitute an auth bypass, production account, shared tenant, or credential
stored in GitHub Secrets.

## Local run

Prerequisites are Node 24, pnpm 9.15.0, and a clean workspace install:

```bash
pnpm install --frozen-lockfile
pnpm --filter @poc-plattform-kit/web exec playwright install chromium
pnpm --filter @poc-plattform-kit/web run test:e2e
```

On Linux (including CI images), install OS dependencies with Chromium:

```bash
pnpm --filter @poc-plattform-kit/web exec playwright install --with-deps chromium
```

The Playwright config builds the Next.js static export and serves `apps/web/out`
on `http://127.0.0.1:4173`. To inspect tests interactively:

```bash
pnpm --filter @poc-plattform-kit/web run test:e2e:ui
```

To validate a trusted deployed target without starting the local server, set a
non-production URL explicitly:

```bash
PLAYWRIGHT_BASE_URL=https://<trusted-swa-preview> \
  pnpm --filter @poc-plattform-kit/web run test:e2e
```

The network allowlist permits that preview origin (plus loopback). The current
public suite remains signed out even against a preview and does not consume
preview or production credentials.

## Failure artifacts

CI runs one Chromium worker with one retry. Screenshots and videos are retained
only for failures; traces are captured on the first retry. The workflow uploads
`playwright-report` and `test-results` only when the job fails, with seven-day
retention. To inspect a downloaded trace:

```bash
pnpm --filter @poc-plattform-kit/web exec playwright show-trace <trace.zip>
```

Screenshot assertions are intentionally absent: component visual regression is
Chromatic's responsibility.
