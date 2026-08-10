# Notifications pillar

Owns: outbound messaging across channels (email, SMS, WhatsApp).

## Channels (locked)

| Channel | Provider | Adapter |
| --- | --- | --- |
| Email | [Forward Email API](https://forwardemail.net/en/email-api) (production) + **development** capture provider (local / PR previews) | `EmailProvider` → `createEmailProvider()` |
| SMS | [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) (self-hosted HTTP) | `SmsProvider` |
| WhatsApp | **Meta WhatsApp Cloud API** (default) | `WhatsAppProvider` — adapter may swap later |

Full email/DNS/ops guide: **[docs/email-forward-email.md](../../docs/email-forward-email.md)**.

## Email runtime

| Piece | Location |
| --- | --- |
| Types + errors | `src/providers/email-types.ts` |
| Forward Email HTTP sender | `src/providers/forward-email.provider.ts` |
| Development / capture sender | `src/providers/development-email.provider.ts` |
| Factory + config | `src/providers/create-email-provider.ts` |
| Contact inquiry helper | `src/contact/contact-email.ts` |
| Domain / alias management (deploy-time) | `src/provisioning/forward-email-management.ts` |
| Route53 provision script | `scripts/provision-forward-email.ps1` |

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

Never put provider API keys in GitHub Secrets or git. See also [docs/marketing-edge.md](../../docs/marketing-edge.md) for marketing-edge contact delivery wiring.

## Layout

```
src/
  contact/                 # contact inquiry validation + send helper
  providers/
    email-types.ts
    forward-email.provider.ts
    development-email.provider.ts
    create-email-provider.ts
    email-provider.ts      # re-exports
    sms-provider.ts
    whatsapp-provider.ts
  provisioning/
    forward-email-management.ts   # domains/aliases/DNS helpers (not runtime Route53)
```

Marketing brochure Contact (`apps/marketing-oauth`) depends on this package. Function zip deploy vendors the built pillar into `node_modules` (see `scripts/deploy-decap-oauth.ps1`) so `workspace:*` is not required at runtime on Azure.

`EmailProvider` requires `isConfigured()` — any Nest/queue stub or mock must implement it (not only `send`).
