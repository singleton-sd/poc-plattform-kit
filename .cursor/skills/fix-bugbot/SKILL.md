---
name: Fix Bugbot
description: >-
  Fix Bugbot (or similar PR bot) findings on a pull request, then reply on the
  original review comment. Use when the user clicks a Bugbot fix action, asks to
  address Bugbot feedback, or says to fix a selected Bugbot finding.
tags: [engineering, review, bugbot, github, pr-hygiene]
audience: [engineers, tech-leads]
status: stable
---

# Fix Bugbot findings

When fixing a Bugbot (or other PR review-bot) finding:

1. Verify the reported issue still exists in the current branch/workspace.
2. Apply a focused fix — no unrelated changes.
3. Commit and push to the PR branch when the user asked to fix (so the PR updates).
4. **Reply to the original review comment** on GitHub after the fix lands.
   - Prefer a threaded reply on the exact review comment (`in_reply_to` / reply API).
   - If that fails, leave a PR comment that quotes the finding title and links the fixing commit.
   - Say what changed and which commit/PR tip contains the fix.
5. Do not mark the finding fixed in chat only — the PR thread is the source of truth for reviewers.

## Reply template

```text
Fixed in <sha>: <one-line what changed>.
```

## Fetching the comment to reply to

```bash
gh api repos/{owner}/{repo}/pulls/{n}/comments \
  --jq '.[] | {id,user:.user.login,path,line,body,html_url}'
```

Reply (review comment thread):

```bash
gh api repos/{owner}/{repo}/pulls/{n}/comments \
  -f body='Fixed in <sha>: <summary>.' \
  -F in_reply_to=<comment_id>
```

Use the GitHub account that can see the repo (switch with `gh auth switch` if needed).
