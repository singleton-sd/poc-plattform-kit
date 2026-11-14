# Local Keycloak (test realm)

Dockerised Keycloak for Platform Kit login smoke tests. It is **not** production
Singleton Auth (`https://auth.singletonsd.com/realms/singletonsd`).

```bash
docker compose -f infra/keycloak/docker-compose.yml up
```

| Item | Value |
| --- | --- |
| Issuer | `http://127.0.0.1:8080/realms/plattform-kit-test` |
| Admin | `admin` / `admin` |
| Web client (public) | `platform-kit-web` |
| API client (confidential) | `platform-kit-api` / `plattform-kit-test-api-secret` |
| Test user | `testuser@example.test` / `testuser-password` |

Unit tests sign RS256 JWTs locally with `jose` and do **not** need this
container. Production client IDs are created by Singleton Auth and come from
env / App Config only — never hardcode them here.
