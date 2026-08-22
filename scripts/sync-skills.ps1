# DEPRECATED — use `pnpm skills:install:pin`

This script copied skills from a hardcoded local path
(`C:\00Personal\singleton-sd\ai-plattform\skills`), which does not work for
cloud agents.

Use instead:

```powershell
pnpm skills:install:pin
```

See `.skills/manifest.json` and `scripts/install-skills.mjs`.
Source: `https://github.com/singleton-sd/ai-plattform-skills`
