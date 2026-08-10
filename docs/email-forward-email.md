# Forward Email — outbound email + DNS provisioning

`[repo=singleton-sd/poc-plattform-kit]`

Platform Kit sends transactional and contact email through the **Notifications** pillar. The default production email adapter is **[Forward Email](https://forwardemail.net/en/email-api)** (`https://api.forwardemail.net`). Local / PR preview runtimes default to a **development** provider that captures sends without calling the network.

This document covers architecture, configuration, DNS (Route53), the provisioning script, troubleshooting, rotation, and how to add domains / aliases / providers. **No secrets belong in git, ClickUp, or PR bodies.**

## Architecture

```text
Domain events / contact form / notifications.send
        │
        ▼
 Notifications pillar
        │
        ├─ EmailProvider (abstraction)
        │     ├─ DevelopmentEmailProvider   ← default locally + PR previews
        │     └─ ForwardEmailProvider       ← production when opted in
        │
        ├─ ForwardEmailManagementClient     ← deploy-time provisioning only
        │
        └─ publishes notification.sent / notification.failed
```

| Concern | Owner |
| --- | --- |
| Runtime send (`POST /v1/emails`) | `pillars/notifications` → `ForwardEmailProvider` |
| Domain / alias / verify (management API) | `ForwardEmailManagementClient` + `scripts/provision-forward-email.ps1` |
| DNS (MX / SPF / DKIM / DMARC / Return-Path) | AWS Route53 hosted zone `singletonsd.com` |
| Secret storage | Azure Key Vault `ssd-pocpk-kv-dev-ae` secret name **`forwardemail-api-key`** |
| Non-secret config | Azure App Configuration `ssd-pocpk-appcs-dev-ae` (`app:notifications:*`) |
| Marketing contact HTTP | Marketing edge Function App (see [marketing-edge.md](./marketing-edge.md)) — not Nest |

Pillars never embed provider secrets in source. Nest `apps/api` maps App Config / KV refs into process env via `apps/api/src/config/app-configuration.ts` before boot.

## EmailProvider abstraction

`EmailProvider` is the runtime contract:

- `name` — `'forward-email' | 'development'`
- `isConfigured()` — token present (Forward Email) or always true (development)
- `send(request, signal?)` — accepts `to`, `from`, optional `fromName`, `subject`, `text` / `html`, `replyTo`, `correlationId`

Factory: `createEmailProvider()` / `loadEmailRuntimeConfig()` in `@poc-plattform-kit/notifications`.

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
| `EMAIL_FROM_ADDRESS` | `app:notifications:emailFromAddress` | e.g. `noreply@plattform-kit.poc.singletonsd.com` |
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

Mail domain (PoC default): **`plattform-kit.poc.singletonsd.com`** under hosted zone **`singletonsd.com`**.

| Record | Purpose |
| --- | --- |
| MX `mx1.forwardemail.net` (10), `mx2.forwardemail.net` (20) | Inbound / forwarding |
| TXT `forward-email-site-verification=…` | Domain ownership |
| TXT SPF `include:spf.forwardemail.net` | Merge into existing SPF; preserve other includes / unrelated TXT |
| TXT DKIM (name/value from API `smtp_dns_records.dkim`) | Outbound auth |
| CNAME Return-Path (from API `smtp_dns_records.return_path`) | Bounce path |
| TXT DMARC (from API `smtp_dns_records.dmarc`) | Only if no conflicting organisational DMARC on that exact name |

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
  -Domain plattform-kit.poc.singletonsd.com `
  -ZoneDomain singletonsd.com `
  -Alias noreply `
  -AliasRecipient hello@singletonsd.com `
  -MaxVerifyAttempts 6 `
  -VerifyDelaySeconds 20
```

| Parameter | Default | Role |
| --- | --- | --- |
| `Domain` | `plattform-kit.poc.singletonsd.com` | Forward Email domain |
| `ZoneDomain` | `singletonsd.com` | Route53 parent zone |
| `Alias` / `AliasRecipient` | `noreply` / `hello@singletonsd.com` | Ensure forwarding alias |
| `HostedZoneId` | (lookup) | Optional zone id override |
| `WhatIf` | off | Print change batch; no Route53 UPSERT |
| `SkipDns` / `SkipVerify` | off | Skip Route53 or verify API calls |
| `ForceDmarc` | off | Overwrite conflicting DMARC on the exact API name |
| `MaxVerifyAttempts` / `VerifyDelaySeconds` | `6` / `20` | verify-records + verify-smtp retries |

Behaviour highlights:

1. GET domain → POST if missing.
2. Read `verification_record` + `smtp_dns_records`.
3. List existing Route53 TXT/MX/CNAME for relative names; merge SPF; UPSERT MX; verification TXT; DKIM; Return-Path; DMARC only without organisational conflict (unless `-ForceDmarc`).
4. Multiple TXT on the same name: GET current set, merge values, UPSERT the full set.
5. verify-records / verify-smtp with limited retries; **exit 0** if still pending (clear message — re-run later).
6. Ensure alias after listing existing aliases.
7. Change batches written **UTF-8 without BOM**. Token / Authorization never logged.

TypeScript helpers used by tests / tooling live in `pillars/notifications/src/provisioning/forward-email-management.ts` (`getRequiredDnsRecords`, `mergeSpfInclude`). Prefer the PowerShell script for live Route53 writes.

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

## Known DNS constraint (marketing CNAME)

`plattform-kit.poc.singletonsd.com` currently has a **CNAME** to Azure Static Web Apps (marketing).
RFC 1034 forbids MX/TXT on the same name as a CNAME, so Forward Email **apex** verification TXT, SPF, and MX cannot be published there until the website hostname is moved (for example to `www.`) or a dedicated mail hostname is chosen.

`scripts/provision-forward-email.ps1` detects this conflict, skips apex MX/TXT, and still upserts child records:

- DKIM TXT (`fe-*._domainkey.plattform-kit.poc`)
- Return-Path CNAME (`fe-bounces.plattform-kit.poc`)
- DMARC TXT (`_dmarc.plattform-kit.poc`)

Follow-up ticket: Resolve marketing CNAME vs Forward Email DNS conflict (https://app.clickup.com/t/86d3znh28).

