# Web app (Bugbot)

Repo architecture: `AGENTS.md`. Root rules: [`.cursor/BUGBOT.md`](../../.cursor/BUGBOT.md).

Stack target: Next.js PWA SPA + Tailwind + `@singleton-sd/tokens` (`--ssd-*` CSS; npm, not the token CDN).

## Hard rules (flag violations)

| Rule | Expect |
|------|--------|
| Styling | Token CSS variables + Tailwind utilities only — no hardcoded palette hex (`#RGB` / `#RRGGBB`) for brand/UI colors |
| Tokens | Prefer design-token CSS vars from Singleton SD; do not invent a parallel color system |
| Secrets | No API keys, connection strings, or Entra secrets in client code or committed env files |
| Preview / CI | SWA preview via OIDC → Key Vault; never commit `AZURE_STATIC_WEB_APPS_API_TOKEN` or other deploy secrets |
| Architecture | Web talks to Nest API / published contracts — do not embed cross-pillar write logic or raw SQL in the frontend |

## Review checklist

- [ ] New UI colors use token CSS vars / Tailwind theme, not raw hex
- [ ] No secrets or `.env` values committed under `apps/web`
- [ ] Client-only code does not call Azure SQL or Key Vault directly
- [ ] PWA / SWA config changes stay compatible with Free SKU preview path
