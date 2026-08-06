# API app (Bugbot)

Repo architecture: `AGENTS.md`. Root rules: [`.cursor/BUGBOT.md`](../../.cursor/BUGBOT.md).

Stack: NestJS + Swagger on Azure App Service (OIDC → Key Vault / App Config). Swagger UI `/docs`, OpenAPI JSON `/docs-json`.

## Hard rules (flag violations)

| Rule | Expect |
|------|--------|
| OpenAPI | Update Swagger decorators / DTOs when HTTP surface changes (routes, bodies, status codes) |
| Pillars | No cross-pillar write HTTP or DB joins from API handlers — call owning pillar contracts / events |
| Secrets | Config from App Configuration + Key Vault references; never hardcode connection strings or tokens |
| AuthZ | Fine-grained authZ belongs to Permissions / OpenFGA — do not embed authZ rules as ad-hoc SQL in other pillars |
| Validation | Prefer Nest ValidationPipe + DTO class-validator for request bodies |
| Tests | Behavior changes: add/adjust Jest specs (failing test first when practical) |

## Review checklist

- [ ] New/changed controllers and DTOs reflected in Swagger
- [ ] No committed secrets or raw `DATABASE_URL` / Service Bus connection strings
- [ ] Mutations that notify others go through pillar local Outbox pattern (not fire-and-forget cross-pillar writes)
- [ ] Health and public docs paths remain intentional (`/health`, `/docs`)
