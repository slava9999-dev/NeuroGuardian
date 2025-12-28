# Ops Panel & AI SysAdmin Specification

## Overview

The Ops Panel provides a centralized internal dashboard for monitoring NeuroGUARDIAN system health, viewing audit logs, and performing administrative actions via an AI interface.

## 1. Database Schema

- **ops_events**: High-volume system logs (info/warning/error).
- **ops_audit**: Immutable record of operator actions.

## 2. API Endpoints

- `GET /api?action=ops-dashboard`: Aggregated metrics.
- `GET /api?action=ops-events`: Recent system events.
- `GET /api?action=ops-audit`: Audit logs.
- `POST /api?action=agent-v4`: Integrated AI SysAdmin (requires Admin Key).

## 3. Security

- Access protected by `X-Admin-Key` header with `ADMIN_API_KEY`.
- Rate limiting applies.
- Failed authentication attempts are logged.

## 4. AI SysAdmin Tool

- **Tool**: `get_system_logs`
- **Executor**: `executeGetSystemLogs` (Requires `admin` role or `ADMIN_TELEGRAM_ID` match).
- **Features**: Filter logs by severity and entity type.

## 5. Deployment

- Environment variables: `ADMIN_API_KEY`, `POSTGRES_URL`.
- Frontend entry point: Settings -> Admin Panel.
