# Forward Email — outbound email + DNS provisioning

Platform Kit sends transactional and contact email through a provider-independent
**`EmailProvider`** in `@poc-plattform-kit/email` (`packages/email`). The
**Notifications** pillar re-exports that package for Nest / queue orchestration
and owns SMS / WhatsApp. The default production email adapter is
**[Forward Email](https://forwardemail.net/en/email-api)**
(`https://api.forwardemail.net`). Local / PR preview runtimes default to a
**development** provider that captures sends without calling the network.


This document covers architecture, configuration, DNS (Route53), the provisioning script, troubleshooting, rotation, and how to add domains / aliases / providers. **No secrets belong in git, ClickUp, or PR bodies.**

## Architecture

```text
Domain events / contact form / notifications.send
        │
        ▼
 @poc-plattform-kit/email          ← shared library (marketing-edge + pillar)
        │
        ├─ EmailProvider (abstraction)
        │     ├─ DevelopmentEmailProvider   ← default locally + PR previews
        │     └─ ForwardEmailProvider       ← production when opted in
        │
        └─ ForwardEmailManagementClient     ← deploy-time provisioning only

 Notifications pillar (product API)
        │
        ├─ re-exports @poc-plattform-kit/email
        ├─ SMS / WhatsApp providers
        └─ publishes notification.sent / notification.failed (future consumer)
```

| Concern | Owner |
| --- | --- |
| Runtime send (`POST /v1/emails`) | `@poc-plattform-kit/email` → `ForwardEmailProvider` |
| Domain / alias / verify (management API) | `ForwardEmailManagementClient` + `scripts/provision-forward-email.ps1` |
| DNS (MX / SPF / DKIM / DMARC / Return-Path) | AWS Route53 hosted zone `singletonsd.com` |
| Secret storage | Azure Key Vault `ssd-pocpk-kv-dev-ae` secret name **`forwardemail-api-key`** |
| Non-secret config | Azure App Configuration `ssd-pocpk-appcs-dev-ae` (`app:notifications:*` — shared email settings; name kept for ops continuity) |
| Marketing contact HTTP | Marketing edge Function App depends on `@poc-plattform-kit/email` only (see [marketing-edge.md](./marketing-edge.md)) — not Nest / not the Notifications pillar runtime |

Pillars never embed provider secrets in source. Nest `apps/api` maps App Config / KV refs into process env via `apps/api/src/config/app-configuration.ts` before boot.

## EmailProvider abstraction

`EmailProvider` is the runtime contract:

- `name` — `'forward-email' | 'development'`
- `isConfigured()` — token present (Forward Email) or always true (development)
- `send(request, signal?)` — accepts `to`, `from`, optional `fromName`, `subject`, `text` / `html`, `replyTo`, `correlationId`

Factory: `createEmailProvider()` / `loadEmailRuntimeConfig()` in `@poc-plattform-kit/email`
(also re-exported from `@poc-plattform-kit/pillar-notifications`).

| Provider | When selected | Behaviour |
| --- | --- | --- |
| `development` | Default when `EMAIL_PROVIDER` unset / `development`, and whenever production send is not explicitly allowed | Logs / captures; no Forward Email HTTP |
| `forward-email` | `EMAIL_PROVIDER=forward-email` (or legacy `forwardemail`) | HTTP Basic to Forward Email; retries on 429 / 5xx |

Header values are sanitised (no CR/LF injection). Logs include status, correlation id, and recipient **domain** only — never the API token, Authorization header, or full message bodies.

## Forward Email HTTP runtime

- **Base URL:** `FORWARD_EMAIL_BASE_URL` (default `https://api.forwardemail.net`)
- **Auth:** HTTP Basic — API token as **username**, **empty password** (`Authorization: Basic base64(token:)`)
- **Send:** `POST /v1/emails` (`application/x-www-form-urlencoded`)
- **Env token (runtime):** `FORWARD_EMAIL_TOKEN` (preferred). Legacy alias still accepted by the client: `FORWARDEMAIL_API_KEY`
- **KV secret name (unchanged):** `forwardemail-api-key` — App Config key `secret:forwardemail-api-key` maps to `FORWARD_EMAIL_TOKEN`

Never print or commit the token. Prefer User/Process env locally; production loads via App Config + Key Vault reference + managed identity.

## Configuration keys

| Env (runtime) | App Config key | Notes |
| --- | --- | --- |
| `FORWARD_EMAIL_TOKEN` | `secret:forwardemail-api-key` (KV ref → secret `forwardemail-api-key`) | Required for live send / provisioning |
| `FORWARD_EMAIL_BASE_URL` | `app:notifications:forwardEmailBaseUrl` | Default `https://api.forwardemail.net` |
| `EMAIL_PROVIDER` | `app:notifications:emailProvider` | `development` (safe default) or `forward-email` |
| `EMAIL_FROM_ADDRESS` | `app:notifications:emailFromAddress` | e.g. `noreply@mail.plattform-kit.poc.singletonsd.com` |
| `EMAIL_FROM_NAME` | `app:notifications:emailFromName` | e.g. `Plattform Kit` |
| `CONTACT_INBOX_ADDRESS` | `app:notifications:contactInboxAddress` | e.g. `hello@singletonsd.com` |
| `EMAIL_ALLOW_PRODUCTION_SEND` | `app:notifications:emailAllowProductionSend` | Must be `true` for live send in production hosts |

See root [`.env.example`](../.env.example) for local placeholders (empty values only).

Legacy contact env aliases (`CONTACT_FROM_EMAIL`, `CONTACT_INBOX_EMAIL`, `FORWARDEMAIL_*`) may still be read by the client for compatibility; prefer the `EMAIL_*` / `FORWARD_EMAIL_*` names above.

## Preview safety (locked)

| Environment | Expected provider |
| --- | --- |
| Local `pnpm` / agent worktrees | `EMAIL_PROVIDER=development` (default) |
| SWA / ACA **PR previews** | Development provider — do **not** set `EMAIL_ALLOW_PRODUCTION_SEND=true` |
| App Service / Functions **production** | `EMAIL_PROVIDER=forward-email` **and** `EMAIL_ALLOW_PRODUCTION_SEND=true` |

If `EMAIL_PROVIDER` is unset and `NODE_ENV=production`, the factory still prefers **development** unless `EMAIL_ALLOW_PRODUCTION_SEND=true` (then Forward Email). This prevents accidental outbound mail from preview slots that inherit production-like `NODE_ENV`.

## Production checklist

1. KV secret `forwardemail-api-key` set (human/ops; never in git).
2. App Config: KV reference on `secret:forwardemail-api-key` plus plain `app:notifications:*` keys.
3. Runtime env after load: `FORWARD_EMAIL_TOKEN`, `EMAIL_PROVIDER=forward-email`, `EMAIL_ALLOW_PRODUCTION_SEND=true`, from/inbox addresses.
4. Domain + DNS + alias provisioned (script below) and Forward Email verify-records / verify-smtp green.
5. Smoke-send a contact or transactional message; confirm inbox delivery and `notification.sent` (when worker is wired).

## DNS / Route53

Mail domain (PoC default): **`mail.plattform-kit.poc.singletonsd.com`** under hosted zone **`singletonsd.com`**.

Marketing stays on **`plattform-kit.poc.singletonsd.com`** (CNAME → Azure SWA). That hostname cannot carry MX/TXT (RFC 1034), so mail uses the dedicated `mail.` hostname instead. From address: **`noreply@mail.plattform-kit.poc.singletonsd.com`**.

| Record | Purpose |
| --- | --- |
| MX `mx1.forwardemail.net` (10), `mx2.forwardemail.net` (20) | Inbound / forwarding |
| TXT `forward-email-site-verification=…` | Domain ownership |
| TXT SPF `include:spf.forwardemail.net` | Merge into existing SPF; preserve other includes / unrelated TXT |
| TXT DKIM (name/value from API `smtp_dns_records.dkim`) | Outbound auth |
| CNAME Return-Path (from API `smtp_dns_records.return_path`) | Bounce path |
| TXT DMARC (from API `smtp_dns_records.dmarc`) | Only if no conflicting organisational DMARC on that exact name |

## BIMI (Brand Indicators for Message Identification)

Platform Kit can stamp BIMI selectors (and serve a compatible public logo) so
mailbox providers that support BIMI can display your configured brand mark on
transactional messages.

### Required DNS TXT record

Mailbox providers look for a BIMI assertion record in DNS at:

`<BIMI_SELECTOR>._bimi.<SENDING_DOMAIN>` (default selector: `default`).

`<SENDING_DOMAIN>` defaults to the domain part of `EMAIL_FROM_ADDRESS`.
If you set `EMAIL_SENDING_DOMAIN`, Platform Kit will use that domain in the
outgoing RFC5322 `From:` header so BIMI lookups match your DNS record.

The TXT record value must start with `v=BIMI1` and use this format:

`v=BIMI1; l=<EMAIL_LOGO_URL>; a=<EMAIL_BIMI_EVIDENCE_URL or empty>`

Where:

- `l=` points to a public HTTPS URL hosting your SVG indicator (Tiny-PS /
  Portable-Secure).
- `a=` is optional evidence (VMC / CMC PEM). When provided, it must also be a
  public HTTPS URL. When empty, the record is still syntactically valid, but
  some providers (notably Gmail) may not render.

For the current PoC deployment, with the defaults from `.env.example`:

- DNS name: `default._bimi.mail.plattform-kit.poc.singletonsd.com`
- TXT value: `v=BIMI1; l=https://api.plattform-kit.poc.singletonsd.com/bimi/logo.svg; a=`

### Selector header behavior

If you keep `EMAIL_BIMI_SELECTOR=default`, no per-message header is needed
because receivers always consult `default._bimi.<fromDomain>`.

If you set `EMAIL_BIMI_SELECTOR` to a non-`default` label, Platform Kit will
stamp the outgoing messages with:

`BIMI-Selector: v=BIMI1; s=<EMAIL_BIMI_SELECTOR>`

Receivers then fetch the record at `<EMAIL_BIMI_SELECTOR>._bimi.<fromDomain>`.

### Deployment guidance

1. Ensure transactional email authentication is in place (SPF + DKIM + aligned
   DMARC). BIMI presentation is only considered when providers deem the
   message authenticated; DMARC must be at least `p=quarantine`/`p=reject`
   with `pct=100`.
2. Ensure the BIMI indicator is publicly reachable over HTTPS:
   `GET /bimi/logo.svg` returns the SVG Tiny-PS asset.
3. Publish the BIMI TXT record with the correct selector and sending domain.
4. Wait for DNS propagation (can be up to ~48h). Then send a test message and
   verify in at least one BIMI-capable mailbox provider.

### Provider support caveats

- Gmail: expects a valid VMC/CMC certificate referenced in the BIMI `a=` tag.
  Without it, Gmail may ignore the BIMI record and will not display the logo.
- Outlook / Exchange: logo rendering is not guaranteed and may not be
  supported even when the BIMI record and headers are correct. This repo does
  not implement provider-specific workarounds/hacks.
- Other providers: behavior varies; some clients may show the SVG even
  without the certificate, but the only consistent guarantee is that receiver
  behavior controls rendering.

### Optional follow-up: VMC / CMC

Purchasing a VMC / CMC certificate and setting `EMAIL_BIMI_EVIDENCE_URL`
unlocks “verified” BIMI behavior in more providers (especially Gmail).

General product CNAMEs remain in [`infra/custom-domains.pocpk.json`](../infra/custom-domains.pocpk.json) / [`scripts/apply-route53-dns.ps1`](../scripts/apply-route53-dns.ps1). Forward Email DNS is **not** hand-merged into that JSON; use the provisioning script so SPF/TXT merges stay safe.

See also [dns-route53.md](./dns-route53.md).

## Provisioning script

[`scripts/provision-forward-email.ps1`](../scripts/provision-forward-email.ps1) is idempotent.

**Requires:** `FORWARD_EMAIL_TOKEN` (Process/User/Machine), AWS CLI (`aws` or `python -m awscli`) unless `-SkipDns`.

```powershell
# Dry-run DNS batch + report
powershell -File ./scripts/provision-forward-email.ps1 -WhatIf

# Full provision (default domain + noreply → hello@singletonsd.com)
powershell -File ./scripts/provision-forward-email.ps1

# Custom domain / skip verify while DNS propagates
powershell -File ./scripts/provision-forward-email.ps1 `
  -Domain mail.plattform-kit.poc.singletonsd.com `
  -ZoneDomain singletonsd.com `
  -Alias noreply `
  -AliasRecipient hello@singletonsd.com `
  -MaxVerifyAttempts 6 `
  -VerifyDelaySeconds 20
```

| Parameter | Default | Role |
| --- | --- | --- |
| `Domain` | `mail.plattform-kit.poc.singletonsd.com` | Forward Email domain |
| `ZoneDomain` | `singletonsd.com` | Route53 parent zone |
| `Alias` / `AliasRecipient` | `noreply` / `hello@singletonsd.com` | Ensure forwarding alias |
| `HostedZoneId` | (lookup) | Optional zone id override |
| `WhatIf` | off | Print change batch; no Route53 UPSERT |
| `SkipDns` / `SkipVerify` | off | Skip Route53 or verify API calls |
| `ForceDmarc` | off | Overwrite conflicting DMARC on the exact API name |
| `BimiSelector` | `default` | BIMI selector label (`<selector>._bimi.<domain>`) |
| `BimiLogoUrl` | (empty) | When set, upserts the BIMI TXT record |
| `BimiSendingDomain` | `Domain` | `<SENDING_DOMAIN>` part for the BIMI DNS name |
| `BimiEvidenceUrl` | (empty) | Optional PEM URL for the `a=` BIMI tag |
| `BimiBrandName` | (empty) | Informational / docs only (not used by DNS) |
| `MaxVerifyAttempts` / `VerifyDelaySeconds` | `6` / `20` | verify-records + verify-smtp retries |

Behaviour highlights:

1. GET domain → POST if missing.
2. Read `verification_record` + `smtp_dns_records`.
3. List existing Route53 TXT/MX/CNAME for relative names; merge SPF; UPSERT MX; verification TXT; DKIM; Return-Path; DMARC only without organisational conflict (unless `-ForceDmarc`).
4. Multiple TXT on the same name: GET current set, merge values, UPSERT the full set.
5. verify-records / verify-smtp with limited retries; **exit 0** if still pending (clear message — re-run later).
6. Ensure alias after listing existing aliases.
7. Change batches written **UTF-8 without BOM**. Token / Authorization never logged.

TypeScript helpers used by tests / tooling live in `packages/email/src/provisioning/forward-email-management.ts` (`getRequiredDnsRecords`, `mergeSpfInclude`). Prefer the PowerShell script for live Route53 writes.

## Troubleshooting

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `FORWARD_EMAIL_TOKEN is required` | Env not set in this shell | Set User/Process env; restart terminal |
| verify-records fails after UPSERT | DNS TTL / propagation | Wait; re-run script (exit 0 pending is expected) |
| SPF “missing include” | Unrelated TXT overwrite elsewhere | Re-run provisioner (merges SPF; does not drop other TXT) |
| DMARC skipped warning | Existing `v=DMARC1` differs | Confirm org policy; only then `-ForceDmarc` |
| 401 from API | Wrong/rotated token | Update KV `forwardemail-api-key` + local env |
| Sends captured locally only | `EMAIL_PROVIDER=development` | Expected for previews; set production keys only on prod hosts |
| AWS CLI missing | No `aws` / `awscli` | Install or use `-SkipDns` after manual DNS |

## Credential rotation

1. Create a new Forward Email API token in the Forward Email dashboard.
2. Update Key Vault secret **`forwardemail-api-key`** (new version).
3. Restart / recycle App Service / Function App so App Config + KV refs refresh (or wait for the provider’s refresh interval).
4. Update local `FORWARD_EMAIL_TOKEN` (User env) for ops scripts.
5. Revoke the old token in Forward Email after smoke-send succeeds.
6. Never paste tokens into ClickUp, PR comments, or chat logs.

## Adding domains, aliases, providers

### New mail domain

1. Choose FQDN under `singletonsd.com` (or another Route53 zone you control).
2. Run `provision-forward-email.ps1 -Domain <fqdn> -ZoneDomain <zone> -Alias … -AliasRecipient …`.
3. Add App Config from-address if the product From changes.
4. Document the domain in this file’s DNS table if it becomes a locked PoC hostname.

### New alias

Re-run the script with `-Alias` / `-AliasRecipient`, or `POST /v1/domains/{domain}/aliases` via the management client. Prefer idempotent script runs over dashboard-only changes so DNS and verify stay in sync.

### New email provider

1. Implement `EmailProvider` in `pillars/notifications/src/providers/`.
2. Extend `EmailProviderName` + `createEmailProvider` / `loadEmailRuntimeConfig`.
3. Keep development as the safe default for previews.
4. Add config keys + `.env.example` placeholders (names only).
5. Do not teach the Forward Email skill about HTML template design — that is separate form/UX work.

## Related

- Pillar overview: [`pillars/notifications/README.md`](../pillars/notifications/README.md)
- Marketing edge contact delivery: [marketing-edge.md](./marketing-edge.md)
- Route53 custom domains: [dns-route53.md](./dns-route53.md)
- Cursor skill: [`.cursor/skills/forward-email/SKILL.md`](../.cursor/skills/forward-email/SKILL.md)
- Upstream API: https://forwardemail.net/en/email-api

## Mail topology (marketing CNAME vs Forward Email)

**Locked choice (Path B):** keep marketing on `plattform-kit.poc.singletonsd.com` (CNAME → SWA) and provision Forward Email on **`mail.plattform-kit.poc.singletonsd.com`**.

| Host | Role |
| --- | --- |
| `plattform-kit.poc.singletonsd.com` | Marketing website (CNAME) — no MX/TXT |
| `mail.plattform-kit.poc.singletonsd.com` | Forward Email domain (MX / SPF / verification + DKIM / Return-Path / DMARC) |
| From | `noreply@mail.plattform-kit.poc.singletonsd.com` |

RFC 1034 forbids MX/TXT on the same name as a CNAME, so the marketing hostname cannot be the mail domain. The provision script still detects a CNAME on whatever `-Domain` you pass and skips apex MX/TXT in that case; with the PoC default `mail.…` there is no website CNAME, so full verification applies.

If an older Forward Email domain was created on `plattform-kit.poc.singletonsd.com` during foundation setup, leave or remove it in the Forward Email dashboard — production From/App Config should use the `mail.` domain only. Update App Config `app:notifications:emailFromAddress` (and redeploy marketing-edge if the Function still has the old default) when cutting over.
