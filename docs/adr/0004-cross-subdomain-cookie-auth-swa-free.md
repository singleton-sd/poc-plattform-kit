# 0004: Cross-subdomain session cookies instead of SWA Standard app-linking

## Status

Accepted.

## Context

The web app (`app.plattform-kit.poc.singletonsd.com`) is an Azure Static
Web App and the API (`api.plattform-kit.poc.singletonsd.com`) is a separate
Azure App Service. Auth.js issues an `httpOnly` session cookie from the API
after Entra login. For the browser to send that cookie back to the API on
same-site navigation/fetch, the API and web origins need a compatible
cookie `Domain`, and Azure Static Web Apps' documented way to tightly
couple a SWA to a backend API ("Bring your own API" / linked backends)
requires the **Standard** SWA tier — the PoC's cost-lock policy specifically
picked SWA **Free** (×2, for web and marketing) as one of its cheapest-
working-SKU choices.

Separately, PR preview web builds are served from Azure's own
`*.azurestaticapps.net` default hostnames (no custom preview domains), which
are a different site entirely from the custom-domain production host and
cannot share its cookie `Domain` at all.

## Decision

For the custom-domain production/dev host, both the web SWA and the API App
Service sit under sibling subdomains of `singletonsd.com`
(`app.plattform-kit.poc.singletonsd.com` / `api.plattform-kit.poc
.singletonsd.com`), which are same-site. Auth.js's cookie `Domain` is set to
the shared parent (`.plattform-kit.poc.singletonsd.com`,
`AUTH_COOKIE_DOMAIN`), so `SameSite=Lax` plus that cookie `Domain` is enough
for a credentialed `fetch` from the web origin to the API origin — no SWA
Standard app-linking needed. This is referred to as "Option B" in
[`docs/sso.md`](../sso.md).

For SWA preview hosts (`*.azurestaticapps.net`), which cannot share that
cookie `Domain` and where Auth.js's cookie-based CSRF check fails
cross-site, the web app instead uses MSAL.js **redirect** mode to get an
Entra access token and calls the API with `Authorization: Bearer` — a
second, explicit authentication mode for previews only, not a security
downgrade of the production path.

## Alternatives considered

- **Upgrade the web SWA to Standard and link it to the API as a backend.**
  Rejected: doubles a specific SKU's cost against this repo's explicit
  cheapest-working-SKU policy, solely to get cookie-domain alignment that
  sibling-subdomain cookies achieve for free.
- **MSAL Bearer tokens everywhere, including production, dropping Auth.js
  cookies entirely.** Rejected (for the primary custom-domain host): would
  mean every API call needs an explicit token-acquisition step in every SPA
  code path instead of relying on the browser's normal cookie handling, and
  throws away Auth.js's built-in server-side session handling for no
  benefit on a host where sibling-subdomain cookies already work.
- **MSAL popup mode instead of redirect on preview hosts.** Rejected: SWA
  Free's `Cross-Origin-Opener-Policy: same-origin-allow-popups` header still
  interacts badly with Entra's own COOP header on the popup's
  `window.opener`/`window.closed` handoff; redirect mode avoids that failure
  mode entirely.

## Consequences

- Production/dev cookie-based auth only works because the web and API hosts
  are deliberately kept as sibling subdomains of the same parent domain —
  moving either host to an unrelated domain would break Option B and force
  a redesign of this decision, not just a config change.
- Two different auth flows must both be kept correct and tested: Auth.js
  cookies (custom-domain hosts) and MSAL Bearer redirect (SWA preview
  hosts). A code change to one must be checked against the other.
- Entra doesn't accept `*.azurestaticapps.net` wildcards for SPA redirect
  URIs, so `preview-web.yml` must register/deregister each PR's **exact**
  preview origin via Graph on deploy/close — an extra moving part in the
  preview pipeline that a single production redirect URI wouldn't need.
- CORS and Auth.js redirect allow-lists must stay in sync (exact custom
  domains, plus `{swaName}*` instance-scoped prefixes) — an open
  `https://*.azurestaticapps.net` allow-list is explicitly rejected because
  it would accept any Azure customer's Static Web App as a valid post-login
  redirect target, not just this repo's.

## References

- [`docs/sso.md`](../sso.md) (full runtime contract, Option B, CORS,
  redirect URIs, follow-ups)
- `AGENTS.md` § Architecture (AuthN line)
- `infra/README.md` (Key Vault / App Config `app:auth:*` keys)
