# Security Policy

## Supported Versions

Current supported versions of NeuroGUARDIAN:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

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

1. **API Key Encryption**: All marketplace keys are encrypted properly using AES-256-GCM.
2. **Telegram Auth Validation**: `initData` is validated using HMAC-SHA256 according to Telegram standards.
3. **Rate Limiting**: API limits are enforced to prevent abuse.
4. **Input Sanitization**: Basic input sanitization is applied to requests.
5. **No Hardcoded Secrets**: Secrets are managed via Environment Variables.

## CI/CD Security

We run automated security audits on every commit:

- `npm audit` for dependencies.
- Static code analysis (Linting/TypeChecking).
