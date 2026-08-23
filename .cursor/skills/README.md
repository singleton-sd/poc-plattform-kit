# Curated skills (legacy path)

Canonical skills live in [`singleton-sd/ai-plattform-skills`](https://github.com/singleton-sd/ai-plattform-skills).

Install / refresh (multi-agent — Cursor, Claude, Grok, Codex):

```powershell
pnpm skills:install:pin
```

Manifest: [`.skills/manifest.json`](../../.skills/manifest.json)  
Profile: [`.skills/profile`](../../.skills/profile) (`engineeringHost: github`)

Preferred committed locations after install:

| Agent | Folder |
|-------|--------|
| Cursor / Codex | `.agents/skills/` |
| Claude Code | `.claude/skills/` |
| Grok | `.grok/skills/` |

This `.cursor/skills/` tree may remain during migration. Prefer the folders above.
Do not run install inside feature PRs — use a dedicated skills chore PR.

**Engineering tracker: GitHub Issues**, not ClickUp Delivery. ClickUp is for product
features and optional tracking tickets only. See
[`docs/github-source-of-truth.md`](../../docs/github-source-of-truth.md).
