# ClickUp sources of truth

Workspace: `90161394355` (space PoC). Do not invent a new Platform Kit space/list.

Repo mirror: `AGENTS.md` § ClickUp (locked).

## Tickets

- Ops list (only): https://app.clickup.com/90161394355/v/li/901616287298
  (`list_id=901616287298`)
- Tickets must include `[repo=singleton-sd/poc-plattform-kit]`
- Branch / PR naming: `feature/<clickup-task-id>-<kebab-title>`
- Status flow: TO DO → IN PROGRESS / READY FOR AI → READY FOR REVIEW → READY FOR HUMAN → COMPLETE
- Humans merge; agents never merge

## Documents

- Architecture Doc: https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- Docs / decisions folder: https://app.clickup.com/90161394355/v/f/901610744236/90165834867
  (`folder_id=901610744236`)

## Review expectations

- Prefer acceptance criteria and Architecture Doc over inventing product requirements
- Flag PRs that contradict locked ClickUp architecture/decisions or ticket AC
- Never request secrets in comments; secrets live in Azure Key Vault only
