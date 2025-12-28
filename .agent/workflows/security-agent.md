---
description: Security Agent implementation workflow - follow the 7-day sprint plan
---

# /security-agent — Security Agent Implementation Workflow

// turbo-all

When working on Security Agent, ALWAYS:

## Step 1: Read Full Specification

```
Read file: .agent/SECURITY_AGENT_SPEC.md
```

This is the source of truth. Follow it exactly.

## Step 2: Check Current Progress

Review the "ТЕКУЩИЙ ПРОГРЕСС" section in the spec to see what's done.

## Step 3: Implementation Rules

**CRITICAL RULES:**

1. **NO MOCKS** — Every implementation must be production-ready
2. **NO DEMOS** — Real integrations only (Vault, ClickHouse, etc.)
3. **NO PLACEHOLDERS** — Complete implementations or nothing
4. **FOLLOW ACCEPTANCE CRITERIA** — Test against them explicitly
5. **UPDATE PROGRESS** — Check off completed items in the spec

## Step 4: Day-by-Day Execution

Follow the 7-day plan in order:

- **Day 1:** Secrets Guard (Vault, SDK, pre-commit hooks)
- **Day 2:** Audit & Immutability (ClickHouse, HMAC signing)
- **Day 3:** Authorization Guard (Permissions, JWT, Rate Limiting)
- **Day 4:** n8n Guardian (Workflow signing, credential injection)
- **Day 5:** Regression Shield (SAST, Canary, Auto-rollback)
- **Day 6:** AI Agent Guard (LLMGuard, prompt validation)
- **Day 7:** Emergency Response (Lockdown, playbooks)

## Step 5: After Each Module

1. Run all tests: `npm test`
2. Verify acceptance criteria from spec
3. Update progress in `.agent/SECURITY_AGENT_SPEC.md`
4. Commit with proper message: `feat(security): implement X module`

## Step 6: Tech Stack Reference

- **Vault:** HashiCorp Vault for secrets
- **ClickHouse:** Audit logs storage
- **Upstash Redis:** Policy decision cache
- **OPA/Rego:** Policy engine
- **Vercel Edge:** Agent runtime

## Step 7: Directory Structure

```
security-agent/
├── src/
│   ├── secrets.ts      # Secrets Guard SDK
│   ├── audit.ts        # Audit Logger SDK
│   ├── authz.ts        # Authorization Guard SDK
│   ├── regression.ts   # Regression Shield SDK
│   ├── n8n.ts          # n8n Guardian SDK
│   └── index.ts        # Agent Core
├── policies/           # OPA/Rego policies
├── tests/              # Test suite
└── docker-compose.yml  # Local security stack
```
