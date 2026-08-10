# Notifications pillar

Owns: outbound messaging across channels (email, SMS, WhatsApp).

## Channels (locked)

| Channel | Provider | Adapter |
| --- | --- | --- |
| Email | [Forward Email API](https://forwardemail.net/en/email-api) | `EmailProvider` |
| SMS | [android-sms-gateway](https://github.com/capcom6/android-sms-gateway) (self-hosted HTTP) | `SmsProvider` |
| WhatsApp | **Meta WhatsApp Cloud API** (default) | `WhatsAppProvider` — adapter may swap later |

## Messaging

- **Consumes** domain events via Service Bus subscriptions (e.g. `contact.*`, `user.*` on publishing topics).
- **Commands:** other pillars enqueue explicit send jobs on queue `notifications.send`.
- **Publishes:** `notification.sent`, `notification.failed` on topic `notifications.events`.
- Same transaction pattern where appropriate: send attempt + **local Audit** + **Outbox**.

## Secrets & config (locked)

| Kind | Store | Example names (not values) |
| --- | --- | --- |
| API keys / tokens | Azure Key Vault `ssd-pocpk-kv-dev-ae` | `forwardemail-api-key`, `sms-gateway-username`, `sms-gateway-password`, `whatsapp-cloud-access-token` |
| Non-secret URLs / IDs | Azure App Configuration `ssd-pocpk-appcs-dev-ae` | Forward Email base URL, SMS gateway base URL, WhatsApp phone-number-id, Graph API version |
| Secret refs in App Config | Key Vault references | never inline secret strings |

Never put provider API keys in GitHub Secrets or git.

## Providers

```
src/providers/
  email-provider.ts      # EmailProvider + Forward Email HTTP client
  sms-provider.ts        # SmsProvider + android-sms-gateway stub
  whatsapp-provider.ts   # WhatsAppProvider + Meta Cloud API stub
```

`ForwardEmailProvider` sends via `POST https://api.forwardemail.net/v1/emails` when
`FORWARDEMAIL_API_KEY` is set (KV `forwardemail-api-key`). Marketing Contact inquiries
use Nest `POST /contact`, which either sends immediately or enqueues `notifications.send`.

A dedicated queue consumer for `notifications.send` is tracked separately.
