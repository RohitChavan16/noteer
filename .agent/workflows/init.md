---
description: Initialize Noteer project context - load memory, releases, and current work status
---

# Noteer Project Initialization

When the user says "init" or "inicializuj se", perform these steps:

## 1. Load Project Memory
// turbo
```
Read file: C:\Users\Tomas\.gemini\noteer-memory.md
```

## 2. Check Current Git Status
// turbo
```powershell
git status
git log -n 5 --oneline
```

## 3. Check Latest Release
// turbo
```powershell
gh release list --limit 5
```

## 4. Check Open Issues/PRs
// turbo
```powershell
gh issue list --limit 10
gh pr list --limit 5
```

## 5. Check Docker Images
// turbo
```powershell
docker images | Select-String "noteer"
```

## 6. Read Implementation Plan (if exists)
// turbo
```
Read file: C:\Users\Tomas\.gemini\antigravity\brain\*\implementation_plan.md (current session)
```

## 7. Summarize Current State
After loading all context, provide a summary:
- Current version/release
- Open work items
- Next steps based on implementation plan
- Any blocking issues
