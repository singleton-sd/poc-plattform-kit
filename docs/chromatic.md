# Chromatic visual regression

Chromatic publishes the web Storybook for visual review. It complements the
assembled-app Azure Static Web Apps preview; it does not replace that preview or
its human test plan. Story conventions and the baseline catalogue Definition of
Done live in [`docs/storybook.md`](./storybook.md).

## Workflow policy

- `.github/workflows/chromatic.yml` runs for pull requests and `main` pushes
  that change `apps/web/**`, `packages/**`, workspace metadata, or the workflow.
- TurboSnap (`onlyChanged`) limits captures to affected stories. The global
  Storybook configuration uses one 1280 px Chromium viewport; add another
  viewport to a specific story only when its behavior requires it.
- Feature branches never auto-accept visual changes. A visual difference keeps
  the check actionable until a reviewer accepts or rejects it in Chromatic.
- A successful `main` build is auto-accepted and becomes the comparison baseline
  for later pull requests. Humans still merge; agents never approve or merge.
- Fork pull requests do not receive Azure OIDC credentials or the Chromatic
  token. Their workflow emits an explicit safety notice instead of executing
  untrusted code with credentials.
- Missing OIDC variables, Key Vault access, or `chromatic-project-token` fails
  with an actionable error. A skipped or unavailable external visual run must
  not be described as a successful regression test.

Build or interaction failures are reported by the Chromatic action. Expected
visual differences are reviewed at the build URL attached to its pull-request
check; `exitZeroOnChanges` remains disabled so an unreviewed change is not a
false success.

## One-time bootstrap

1. Create the Chromatic project from `singleton-sd/poc-plattform-kit` and copy
   its project token without placing it in a shell history, issue, or PR.
2. Store the value directly in Key Vault without placing the value in shell
   history:

   ```bash
   read -rsp 'Chromatic project token: ' token && echo
   az keyvault secret set \
     --vault-name ssd-pocpk-kv-dev-ae \
     --name chromatic-project-token \
     --value "$token" >/dev/null
   unset token
   ```

3. Confirm the repository Variables `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and
   `AZURE_SUBSCRIPTION_ID` are configured. They are identifiers, not secrets.
4. Confirm the GitHub OIDC service principal has **Key Vault Secrets User** on
   `ssd-pocpk-kv-dev-ae` and federated credentials for pull requests and the
   `main` branch. See `SETUP.md` for the accepted subject forms.
5. Run the workflow on a story-only PR. Verify a no-change build, then make one
   controlled visual change and confirm it requires explicit Chromatic review.

Never put `CHROMATIC_PROJECT_TOKEN` in GitHub Secrets, repository Variables,
workflow YAML, `.env` files, ClickUp, or PR comments.

## Local verification

Local development does not require Chromatic credentials:

```bash
pnpm --filter @poc-plattform-kit/web run build-storybook
```

Use the Chromatic workflow for baseline comparison and hosted visual approval.
