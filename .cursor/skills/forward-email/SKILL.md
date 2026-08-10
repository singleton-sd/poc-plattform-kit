---
name: Forward Email
description: Provision and diagnose Forward Email domains, Route53 DNS (MX/SPF/DKIM/DMARC/Return-Path), aliases, and token/config wiring for poc-plattform-kit. Not for email HTML or template design.
tags: [ops, email, dns, route53, forward-email, notifications, provisioning]
audience: [engineers, agents]
status: stable
---

# Forward Email

You help provision and diagnose **Forward Email** for `poc-plattform-kit` (domains, DNS, aliases, tokens, verify). You do **not** design email HTML, MJML, or marketing copy.

Read [`docs/email-forward-email.md`](../../../docs/email-forward-email.md) for the full reference. Prefer that doc + this skill over inventing API shapes.

## Project facts (locked)

| Fact | Value |
| --- | --- |
| API base | `https://api.forwardemail.net` |
| Auth | HTTP Basic — token as username, **empty** password |
| Runtime env token | `FORWARD_EMAIL_TOKEN` (legacy accepted: `FORWARDEMAIL_API_KEY`) |
| KV secret name | `forwardemail-api-key` (unchanged) |
| App Config secret key | `secret:forwardemail-api-key` → maps to `FORWARD_EMAIL_TOKEN` |
| Default mail domain | `plattform-kit.poc.singletonsd.com` |
| Route53 zone | `singletonsd.com` |
| Default alias | `noreply` → `hello@singletonsd.com` |
| From (PoC) | `noreply@plattform-kit.poc.singletonsd.com` / name `Plattform Kit` |
| Safe default provider | `EMAIL_PROVIDER=development` |
| Production send | `EMAIL_PROVIDER=forward-email` **and** `EMAIL_ALLOW_PRODUCTION_SEND=true` |
| Provision script | `scripts/provision-forward-email.ps1` |
| TS management helpers | `packages/email/src/provisioning/forward-email-management.ts` |
| Runtime sender | `ForwardEmailProvider` in `@poc-plattform-kit/email` |

Marketing contact HTTP uses the marketing-edge Function App and depends on
`@poc-plattform-kit/email` only — see `docs/marketing-edge.md`. Do not wire
brochure Contact onto Nest or the Notifications pillar runtime as the
long-term surface.

## Safety rules

1. **Never** print, commit, or paste `FORWARD_EMAIL_TOKEN` / Authorization headers / KV secret values into ClickUp, PRs, logs, or chat.
2. Prefer **User/Process** env for local ops; production loads via App Config + KV references.
3. **PR previews / local** stay on the development email provider — do not enable `EMAIL_ALLOW_PRODUCTION_SEND` there.
4. DNS changes go through `provision-forward-email.ps1` (or reviewed Route53 batches). Merge SPF; do not blank unrelated TXT.
5. Do **not** overwrite organisational DMARC on the exact Forward Email DMARC name when an existing `v=DMARC1` differs — warn and skip unless the operator passes `-ForceDmarc`.
6. Do not hand-edit `pnpm-lock.yaml` or unrelated hubs while fixing email DNS.
7. Exit 0 with a clear “pending DNS — re-run” message is success for propagation; do not treat it as a hard failure.
8. This skill is **not** for email HTML design, brand templates, or form copy.

## Provisioning workflow

```powershell
# Token must already be set (never echo it)
# $env:FORWARD_EMAIL_TOKEN = '…'   # Process scope for this shell only

powershell -File ./scripts/provision-forward-email.ps1 -WhatIf
powershell -File ./scripts/provision-forward-email.ps1
```

Script steps (idempotent):

1. Require `FORWARD_EMAIL_TOKEN` (Process → User → Machine).
2. Ensure domain (GET, POST if missing).
3. Read `verification_record` + `smtp_dns_records`.
4. Unless `-SkipDns`: resolve hosted zone; merge SPF; UPSERT MX (mx1/10, mx2/20), verification TXT, DKIM TXT, Return-Path CNAME; DMARC only if safe.
5. Unless `-SkipVerify`: `verify-records` + `verify-smtp` with retries (`MaxVerifyAttempts` / `VerifyDelaySeconds`).
6. Ensure alias (`noreply` → `hello@singletonsd.com` by default) after listing aliases.
7. Prefer `aws` CLI; fallback `python -m awscli`. UTF-8 **no BOM** change batches.

## Diagnostics workflow

When email or DNS is broken, work in this order:

1. **Config** — Is `EMAIL_PROVIDER` development vs forward-email? Is `EMAIL_ALLOW_PRODUCTION_SEND` set only on prod? Is `FORWARD_EMAIL_TOKEN` present in the **target** process (without printing it)?
2. **Domain** — `GET /v1/domains/{domain}` — does `verification_record` / `smtp_dns_records` exist?
3. **DNS** — Compare Route53 TXT/MX/CNAME for the relative name under `singletonsd.com` with API expectations (SPF include `spf.forwardemail.net`, mx1/mx2, verification TXT, DKIM, Return-Path).
4. **Verify** — Re-run provision script or call verify-records / verify-smtp; allow propagation.
5. **Alias** — List aliases; confirm `noreply` recipients include `hello@singletonsd.com`.
6. **Send path** — Development provider captures only; Forward Email 401 → rotate KV; 429/5xx → retry/backoff already in provider.

Useful commands:

```powershell
powershell -File ./scripts/provision-forward-email.ps1 -SkipDns -WhatIf
powershell -File ./scripts/provision-forward-email.ps1 -SkipVerify
# Inspect zone (no secrets):
aws route53 list-resource-record-sets --hosted-zone-id <id> --query "ResourceRecordSets[?contains(Name, 'plattform-kit.poc')]"
```

## Example prompts

- “Provision Forward Email for `plattform-kit.poc.singletonsd.com` with noreply → hello@singletonsd.com.”
- “Why is verify-smtp still failing after DNS upsert? Diagnose without printing the token.”
- “Merge SPF for Forward Email without clobbering existing TXT on the apex relative name.”
- “Rotate `forwardemail-api-key` in Key Vault and confirm App Config still maps to `FORWARD_EMAIL_TOKEN`.”
- “Add a second alias `support` → `hello@singletonsd.com` using the provision script.”
- “Confirm PR preview cannot send real mail.”

## Out of scope

- Email HTML / template design / brand layouts
- Implementing marketing-oauth Contact Azure Functions (separate ticket/agent)
- Approving PRs or writing secrets into git
