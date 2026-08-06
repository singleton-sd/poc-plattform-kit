# Custom domains — Platform Kit PoC

DNS stays in **AWS Route53** (`singletonsd.com`). Azure only receives CNAMEs /
validation TXT and custom-domain bindings.

Reusable tooling:

| File | Role |
| --- | --- |
| [`infra/custom-domains.pocpk.json`](../infra/custom-domains.pocpk.json) | This product's record + binding map |
| [`infra/custom-domains.schema.json`](../infra/custom-domains.schema.json) | Shape for other products |
| [`scripts/apply-route53-dns.ps1`](../scripts/apply-route53-dns.ps1) | UPSERT Route53 from any config |
| [`scripts/bind-custom-domains.ps1`](../scripts/bind-custom-domains.ps1) | Bind SWA / App Service + managed cert |
| [`scripts/deploy-swa-from-kv.ps1`](../scripts/deploy-swa-from-kv.ps1) | Deploy static folder via KV SWA token |

## Apply (this PoC)

```powershell
powershell -File ./scripts/apply-route53-dns.ps1
# wait for DNS
powershell -File ./scripts/bind-custom-domains.ps1
powershell -File ./scripts/deploy-swa-from-kv.ps1 -DeployName marketing
```

## Apply to another domain / product later

1. Copy `infra/custom-domains.pocpk.json` → `infra/custom-domains.<app>.json`
2. Edit `zoneDomain`, `records[]`, `bindings[]`, optional `deploys[]`
3. Run the same scripts with `-ConfigPath`:

```powershell
powershell -File ./scripts/apply-route53-dns.ps1 -ConfigPath ./infra/custom-domains.other.json
powershell -File ./scripts/bind-custom-domains.ps1 -ConfigPath ./infra/custom-domains.other.json
powershell -File ./scripts/deploy-swa-from-kv.ps1 -ConfigPath ./infra/custom-domains.other.json -DeployName marketing
```

## Locked public URLs (this PoC)

- Marketing: https://plattform-kit.poc.singletonsd.com
- App: https://app.plattform-kit.poc.singletonsd.com
- API: https://api.plattform-kit.poc.singletonsd.com (`/health`, `/docs`)

Live CNAME/TXT values live in `infra/custom-domains.pocpk.json` (source of truth
for re-apply). App Service verification TXT uses Azure
`customDomainVerificationId` (lowercased in Route53).
