# 🛡️ NeuroGUARDIAN Security Agent

> **Production-ready security layer for NeuroGUARDIAN**

Security Agent provides centralized management for secrets, authorization, audit logging, and security policies.

## 📋 Modules

| Module                  | Description                              | Status         |
| ----------------------- | ---------------------------------------- | -------------- |
| **Secrets Guard**       | Vault integration, no process.env        | ✅ Implemented |
| **Audit Logger**        | ClickHouse, HMAC signing, immutable logs | ✅ Implemented |
| **Authorization Guard** | Permissions, rate limiting, ownership    | ✅ Implemented |
| **n8n Guardian**        | Workflow signing, credential injection   | 🔄 Day 4       |
| **Regression Shield**   | SAST, canary, auto-rollback              | 🔄 Day 5       |
| **AI Agent Guard**      | LLMGuard, prompt validation              | 🔄 Day 6       |

## 🚀 Quick Start

### 1. Start Local Infrastructure

```bash
cd security-agent
docker-compose up -d
```

This starts:

- **Vault** (port 8200) - Secrets management
- **ClickHouse** (port 8123, 9000) - Audit logs
- **Redis** (port 6379) - Policy cache
- **Grafana** (port 3001) - Monitoring dashboard
- **Loki** (port 3100) - Log aggregation

### 2. Initialize Vault

```bash
npm run vault:init
```

This creates:

- Security policies
- Secret structure
- Development credentials

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Tests

```bash
npm test
```

## 📖 Usage

### Secrets

```typescript
import { getSecurityAgent } from '@neuroguardian/security-agent';

const agent = getSecurityAgent();
await agent.initialize();

// Get a secret
const apiKey = await agent.secrets.get({
  userId: 'user_123',
  key: 'wb_api_key',
  purpose: 'price_sync',
  ttl: 300, // 5 minutes
});

// Use the secret
console.log(apiKey.value); // Never log in production!
console.log(apiKey.expiresAt);
console.log(apiKey.leaseId);
```

### Authorization

```typescript
// Check permissions
await agent.authz.check({
  userId: 'user_123',
  requiredPermissions: ['price:update', 'inventory:read'],
});

// Check rate limit
await agent.authz.checkRateLimit({
  key: 'price-update',
  limit: 10,
  windowSeconds: 60,
  userId: 'user_123',
});
```

### Audit Logging

```typescript
// Log an event
await agent.audit.log({
  event: 'price.update',
  category: 'data',
  severity: 'info',
  userId: 'user_123',
  before: { price: 100 },
  after: { price: 150 },
});

// Log price change (helper)
await agent.audit.logPriceChange('user_123', 'product_456', 'wildberries', 100, 150);
```

### Middleware

```typescript
import { securityMiddleware } from '@neuroguardian/security-agent';

export default securityMiddleware(
  {
    requiredPermissions: ['price:update'],
    rateLimit: { limit: 10, windowSeconds: 60 },
    auditEvent: 'price.update',
  },
  async (req, res) => {
    // Your handler code
  }
);
```

## 🔐 Permissions

### Roles

| Role    | Description                          |
| ------- | ------------------------------------ |
| `admin` | Full access to everything            |
| `pro`   | All business features, no admin      |
| `basic` | Limited features, no bulk operations |
| `free`  | Read-only + chat                     |

### Available Permissions

```typescript
// Price operations
('price:read', 'price:update', 'price:bulk_update');

// Inventory
('inventory:read', 'inventory:update');

// Stop-loss
('stoploss:read', 'stoploss:set', 'stoploss:delete');

// Products
('product:read', 'product:sync');

// Analytics
('analytics:read', 'analytics:export');

// Admin
('admin:read', 'admin:write', 'admin:users', 'admin:secrets');

// Workflows
('workflow:read', 'workflow:execute', 'workflow:modify');

// AI Agent
('agent:chat', 'agent:execute', 'agent:confirm');
```

## 🗄️ ClickHouse Tables

- `audit_logs` - Main immutable audit log
- `policy_decisions` - AuthZ decision cache
- `secret_access_logs` - Secret access tracking
- `rate_limit_events` - Rate limiting events
- `workflow_executions` - n8n execution logs
- `security_incidents` - P0/P1/P2 incidents

## 📁 Directory Structure

```
security-agent/
├── src/
│   ├── types.ts        # TypeScript types & Zod schemas
│   ├── secrets.ts      # Secrets Guard (Vault)
│   ├── audit.ts        # Audit Logger (ClickHouse)
│   ├── authz.ts        # Authorization Guard
│   └── index.ts        # Main entry point
├── tests/
│   ├── secrets.test.ts # Secrets tests
│   └── authz.test.ts   # Authorization tests
├── scripts/
│   ├── init-vault.js   # Vault initialization
│   └── scan-secrets.js # Pre-commit secret scanner
├── policies/           # OPA Rego policies (Day 5)
├── clickhouse/
│   └── init.sql        # ClickHouse schema
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- secrets.test.ts
```

## 🔒 Security Scanning

Secret scanning is integrated into the pre-commit hook:

```bash
# Manual scan
node scripts/scan-secrets.js

# Scan specific files
node scripts/scan-secrets.js src/api/handler.ts
```

## ⚙️ Configuration

See `.env.example` for all configuration options.

Key settings:

- `VAULT_ADDR` - Vault server address
- `CLICKHOUSE_HOST` - ClickHouse server
- `SECURITY_SIGNING_KEY` - HMAC key for audit signatures
- `SECURITY_PERMISSIVE_MODE` - Allow operations on failure (testing only!)

## 📊 Monitoring

### Grafana Dashboard

Access at http://localhost:3001 (admin/admin_password_change_me)

Dashboards:

- Security Overview
- Audit Events
- Rate Limiting
- Secret Access

## 🚨 Incident Response

When a security incident is detected:

1. **P0 (Critical)**: Automatic lockdown + PagerDuty alert
2. **P1 (High)**: Telegram notification + incident logged
3. **P2 (Medium)**: Logged for review

## 📝 License

MIT
