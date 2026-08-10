# Notifications pillar

Owns: outbound messaging orchestration across channels (email, SMS, WhatsApp).

Email **providers and contact helpers** live in the neutral package
[`@poc-plattform-kit/email`](../../packages/email) (`packages/email`). This
pillar re-exports that surface for Nest / queue consumers and keeps SMS /
WhatsApp adapters here.

## Channels (locked)

| Channel | Provider | Adapter |
| --- | --- | --- |
| Email | [Forward Email API](https://forwardemail.net/en/email-api) (production) + **development** capture provider (local / PR previews) | `EmailProvider` via `@poc-plattform-kit/email` → `createEmailProvider()` |
| SMS | [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) (self-hosted HTTP) | `SmsProvider` |
| WhatsApp | **Meta WhatsApp Cloud API** (default) | `WhatsAppProvider` — adapter may swap later |

Full email/DNS/ops guide: **[docs/email-forward-email.md](../../docs/email-forward-email.md)**.

## Email runtime (shared package)

| Piece | Location |
| --- | --- |
| Types + errors | `packages/email/src/providers/email-types.ts` |
| Forward Email HTTP sender | `packages/email/src/providers/forward-email.provider.ts` |
| Development / capture sender | `packages/email/src/providers/development-email.provider.ts` |
| Factory + config | `packages/email/src/providers/create-email-provider.ts` |
| Contact inquiry helper | `packages/email/src/contact/contact-email.ts` |
| Domain / alias management (deploy-time) | `packages/email/src/provisioning/forward-email-management.ts` |
| Route53 provision script | `scripts/provision-forward-email.ps1` |
| Pillar facade | `pillars/notifications` re-exports `@poc-plattform-kit/email` |

### Config (env)

| Env | Purpose | Safe default |
| --- | --- | --- |
| `FORWARD_EMAIL_TOKEN` | API token (KV secret name remains `forwardemail-api-key`) | unset locally |
| `FORWARD_EMAIL_BASE_URL` | API base | `https://api.forwardemail.net` |
| `EMAIL_PROVIDER` | `development` \| `forward-email` | `development` |
| `EMAIL_FROM_ADDRESS` / `EMAIL_FROM_NAME` | Envelope From | `noreply@plattform-kit.poc.singletonsd.com` / `Plattform Kit` |
| `CONTACT_INBOX_ADDRESS` | Contact delivery inbox | `hello@singletonsd.com` |
| `EMAIL_ALLOW_PRODUCTION_SEND` | Must be `true` for live send on production hosts | unset / false |

PR previews and local runs should stay on the **development** provider. Production App Service / Functions set `EMAIL_PROVIDER=forward-email` and `EMAIL_ALLOW_PRODUCTION_SEND=true`.

Legacy aliases still accepted by the client: `FORWARDEMAIL_API_KEY`, `FORWARDEMAIL_BASE_URL`, `CONTACT_FROM_EMAIL`, `CONTACT_INBOX_EMAIL`.

## Messaging

- **Consumes** domain events via Service Bus subscriptions (e.g. `contact.*`, `user.*` on publishing topics).
- **Commands:** other pillars enqueue explicit send jobs on queue `notifications.send`.
- **Publishes:** `notification.sent`, `notification.failed` on topic `notifications.events`.
- Same transaction pattern where appropriate: send attempt + **local Audit** + **Outbox**.

## Secrets & config (locked)

| Kind | Store | Example names (not values) |
| --- | --- | --- |
| API keys / tokens | Azure Key Vault `ssd-pocpk-kv-dev-ae` | `forwardemail-api-key`, `sms-gateway-username`, `sms-gateway-password`, `whatsapp-cloud-access-token` |
| Non-secret URLs / IDs | Azure App Configuration `ssd-pocpk-appcs-dev-ae` | `app:notifications:forwardEmailBaseUrl`, `app:notifications:emailFromAddress`, `app:notifications:emailFromName`, `app:notifications:contactInboxAddress`, `app:notifications:emailProvider`, `app:notifications:emailAllowProductionSend` |
| Secret refs in App Config | Key Vault references | `secret:forwardemail-api-key` → runtime `FORWARD_EMAIL_TOKEN` |

App Config keys keep the `app:notifications:*` prefix for ops continuity; they are **shared email runtime settings**, not a Nest-only concern.

Never put provider API keys in GitHub Secrets or git. See also [docs/marketing-edge.md](../../docs/marketing-edge.md) for marketing-edge contact delivery wiring.

## Layout

```
packages/email/src/          # @poc-plattform-kit/email (neutral)
  contact/
  providers/
  provisioning/

pillars/notifications/src/
  index.ts                   # re-exports email + SMS/WhatsApp
  providers/
    sms-provider.ts
    whatsapp-provider.ts
```

Marketing brochure Contact (`apps/marketing-oauth`) depends on
**`@poc-plattform-kit/email` only** — not this pillar. Function zip deploy
vendors the built email package into `node_modules` (see
`scripts/deploy-decap-oauth.ps1`) so `workspace:*` is not required at runtime
on Azure.

`EmailProvider` requires `isConfigured()` — any Nest/queue stub or mock must implement it (not only `send`).
