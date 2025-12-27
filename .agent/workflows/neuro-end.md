---
description: End a development session with proper documentation and commit
---

# /neuro end — Session End Protocol

When user says `/neuro end`, execute these steps:

## Step 1: Summarize Accomplishments

List all changes made during this session:

- Files created
- Files modified
- Bugs fixed
- Features implemented

## Step 2: Update PROJECT_STATE.md

Update `.agent/PROJECT_STATE.md` with:

- New date/time
- Move completed items to "Recently Completed"
- Add any new issues discovered to TODO
- Update metrics if changed
- Add session notes

## Step 3: Check for Uncommitted Changes

// turbo

```bash
git status
```

## Step 4: Commit Documentation Updates

If PROJECT_STATE.md was updated:

```bash
git add .agent/PROJECT_STATE.md CLAUDE.md
git commit -m "docs: update project state after session"
git push origin main
```

## Step 5: Final Report

Respond with:

```
🔴 **Session Ended**

**Duration:** [approximate]
**Commits:** [count]

**Completed:**
- [list of accomplishments]

**New Issues Discovered:**
- [if any]

**Next Session Suggestions:**
- [from PROJECT_STATE.md]

**Project state saved. See you next time!**
```
