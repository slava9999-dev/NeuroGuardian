# Security Policy

## Supported Versions

Current supported versions of NeuroGUARDIAN:

| Version | Supported                     |
| ------- | ----------------------------- |
| 2.1.x   | :white_check_mark:            |
| 2.0.x   | :warning: Security fixes only |
| < 2.0   | :x:                           |

## Reporting a Vulnerability

If you discover a security vulnerability in NeuroGUARDIAN, please report it privately.

**DO NOT** create a public GitHub issue for security vulnerabilities.

### How to report

Please email us at `support@neuroexpert.ai` (or your preferred contact) with:

1. Description of the vulnerability.
2. Steps to reproduce.
3. Potential impact.

We will acknowledge receipt within 48 hours and provide a timeline for the fix.

## Security Measures

This project employs the following security measures:

### 1. API Key Encryption

All marketplace API keys (WB, Ozon) are encrypted using AES-256-GCM before storage.

### 2. Telegram Auth Validation

`initData` is validated using HMAC-SHA256 according to Telegram Mini App standards.

### 3. Rate Limiting

- API rate limits enforced via Vercel KV-backed limiter
- Agent-specific rate limits to prevent abuse
- IP-based limiting with configurable thresholds

### 4. Input Sanitization

- Basic XSS protection via input sanitization
- SQL injection prevention via parameterized queries (@vercel/postgres)
- Zod validation for all tool arguments

### 5. Environment Variable Security

All secrets are managed via Environment Variables:

- **REQUIRED**: `CRON_SECRET`, `ADMIN_API_KEY`, `TELEGRAM_BOT_TOKEN`
- **n8n**: `N8N_BASIC_AUTH_PASSWORD` (must be set in `.env.n8n`)
- No hardcoded secrets in code or docker-compose files

### 6. n8n Security (Dec 2024 Update)

- Basic Auth credentials moved to environment variables
- Webhook URL configurable for production deployment
- See `.env.n8n.example` for required variables

## CI/CD Security

We run automated security audits on every commit:

- `npm audit` for dependency vulnerabilities
- TypeScript strict mode
- ESLint security rules
- Pre-commit hooks via Husky

## Security Changelog

### December 2024

- ✅ Removed hardcoded n8n password from docker-compose
- ✅ Fixed environment variable references in n8n workflows
- ✅ Added input validation via Zod for agent tools
- ✅ Implemented honest data warnings in analytics (prevents misleading users)
