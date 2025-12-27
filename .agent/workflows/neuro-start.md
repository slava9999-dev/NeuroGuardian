---
description: Start a new development session with full context restoration
---

# /neuro start — Session Start Protocol

When user says `/neuro start`, execute these steps:

## Step 1: Read Project Memory

// turbo

```
Read file: CLAUDE.md
```

## Step 2: Read Current State

// turbo

```
Read file: .agent/PROJECT_STATE.md
```

## Step 3: Check Recent Git History

// turbo

```bash
git log --oneline -10
```

## Step 4: Acknowledge Context

Respond with:

```
🟢 **Session Started**

**Project:** NeuroGUARDIAN
**Last Session:** [date from PROJECT_STATE.md]
**Current Phase:** [phase from PROJECT_STATE.md]

**Recent Progress:**
- [list from PROJECT_STATE.md]

**Priority TODO:**
- [P0 items from PROJECT_STATE.md]

**Ready to continue. What's the focus today?**
```

## Step 5: Wait for User Direction

Do not start any work until user provides specific task or confirms continuing from TODO list.
