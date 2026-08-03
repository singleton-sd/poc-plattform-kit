# SETUP — human checklist

## 1. GitHub

- [ ] Repo exists: `https://github.com/singleton-sd/poc-plattform-kit` (SSH: `git@github.com:singleton-sd/poc-plattform-kit.git`)
- [ ] Push `main` from `C:\00Personal\singleton-sd\poc-plattform-kit`
- [ ] Branch protection on `main`: require PR, **require human approval**, disallow AI/bot merge if possible
- [ ] Connect repo in [Cursor Integrations](https://cursor.com/dashboard/integrations)

## 2. ClickUp (workspace `90161394355`) — locked locations

- **Tickets list (only):** https://app.clickup.com/90161394355/v/li/901616287298 (`901616287298`) in space PoC
- **Architecture Doc:** https://app.clickup.com/90161394355/docs/2kz0kcnk-1416
- **Decisions / Docs folder:** https://app.clickup.com/90161394355/v/f/901610744236/90165834867 (`folder_id=901610744236`)
- Do **not** create a new Platform Kit space/list
- Statuses already on the list: **TO DO**, **IN PROGRESS**, **READY FOR AI**, **READY FOR REVIEW**, **READY FOR HUMAN**, **COMPLETE**
- Ticket template includes `[repo=singleton-sd/poc-plattform-kit]`, acceptance criteria, tests
- [ ] Connect ClickUp ↔ Cursor (App Center + Cursor API key); default repo = this GitHub repo

## 3. Agent automations

- [ ] Implementer: pick tickets in **READY FOR AI**
- [ ] Reviewer: pick tickets in **READY FOR REVIEW** (must be a different AI than implementer)
- [ ] Humans only: merge PR when **READY FOR HUMAN**, then set **COMPLETE**

## 4. Azure (can wait until foundation tickets)

- [ ] Resource group for PoC
- [ ] Azure SQL Database
- [ ] App Service (API)
- [ ] Static Web Apps (web)
- [ ] Service Bus namespace + topics per publishing pillar

## 5. Skills

Curated skills are committed under `.cursor/skills/`. Refresh from local source:

```powershell
pnpm sync:skills
```

Source: `C:\00Personal\singleton-sd\ai-plattform\skills` (also on GitHub `singleton-sd/ai-plattform-skills`).
