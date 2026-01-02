---
description: Initialize Noteer project context - load memory, releases, and current work status
---

# Noteer Project Initialization

When the user says "init", perform these steps:

## 1. Load Project Memory & Code Map
// turbo
```bash
cat /home/tomas/Repositories/ai-memory/noteer/noteer-memory.md
cat /home/tomas/Repositories/ai-memory/noteer/code_map.md
```

## 2. Check Current Git Status
// turbo
```bash
git status
git log -n 5 --oneline
```

## 3. Check Latest Release
// turbo
```bash
gh release list --limit 5
```

## 4. Check Open Issues/PRs
// turbo
```bash
gh issue list --limit 10
gh pr list --limit 5
```

## 5. Check Docker Images
// turbo
```bash
docker images | grep "noteer"
```

## 6. Summarize Current State
After loading all context, provide a summary:
- Current version/release
- Open work items
- Next steps based on implementation plan
- Any blocking issues