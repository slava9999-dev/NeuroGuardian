# ⚡ NeuroGUARDIAN: God Mode Implementation Plan

## 1. Vision & Philosophy

**"God Mode"** (System Control Center) is a dedicated, secure interface designed solely for the Super Admin (You). It transforms the application from a "black box" into a transparent, controllable organism.

**Core Philosophy:**

- **Total Visibility**: See everything (Sentinel cycles, Agent thoughts, Database locks).
- **Total Control**: Trigger actions manually that typically run on cron (Force Sync, Force Defense).
- **Safety**: Dangerous buttons are guarded (e.g., "Reset Database" requires double confirmation).
- **Aesthetics**: "Cyberpunk/Command Center" interface. Dark mode, monospace fonts, high-contrast status lights.

---

## 2. Architecture & Security

### 2.1. Access Layer

- **Route**: `/ops/god-mode` (Hidden from main navigation).
- **Security**:
  - **Middleware**: Strict `verifyAdminAccessAsync` check on every API call.
  - **Frontend**: The route wraps in a `<GodModeGuard>` component. If a non-admin accesses it, they get a 404 (Security by Obscurity) or a "Access Denied" screen.
  - **Identity**: Hardcoded `ADMIN_IDS` in `backend` env vars + `supertokens` verification.

### 2.2. Tech Stack

- **Frontend**: React, TailwindCSS, `framer-motion` (animations), `recharts` (stats), `react-flow` (system map).
- **Backend**: Node.js/TypeScript Vercel Functions.

---

## 3. The "God Mode" Dashboard Layout

### 📍 Section 1: The "H.U.D." (Heads-Up Display)

_Located at the top, always visible._

- **System Status**: 🟢 OK | 🟡 DEGRADED | 🔴 DOWN (Global health aggregate).
- **Sentinel State**: "Idle" / "Scanning (12/450)" / "Defending".
- **Agent V5 State**: "Thinking..." or "Standby".
- **DB Latency**: Real-time ping to Postgres (ms).

### 📍 Section 2: Interactive System Map (The "Brain")

- **Visualization**: Interactive node graph (React Flow).
- **Nodes**: User Input -> MoE Router -> [Agent V5 / Sentinel / Local LLM] -> Action.
- **Interaction**:
  - Nodes pulse when active.
  - Clicking a node opens its strict "Inspector" panel (logs specific to that node).
- **Edges**: Show data flow volume.

### 📍 Section 3: War Room (Sentinel Control)

- **Live Feed**: Scrolling terminal-like log of the current/last Sentinel cycle.
- **Kill Switches**:
  - `[STOP PROTECTION]` (Emergency stop of all price changes).
  - `[FORCE SCAN]` (Run Sentinel cycle immediately outside schedule).
  - `[RESET STUCK LOCKS]` (If the system thinks it's running but isn't).

### 📍 Section 4: Agent Intelligence

- **Thought Stream**: View the raw "Chain of Thought" (CoT) logs from the last 5 user requests.
- **Model Switcher**: Toggle between efficient (GPT-4o-mini) and smart (Claude-3.5-Sonnet) models on the fly without deploying code.

---

## 4. Implementation Steps

### Phase 1: The Foundation (Backend)

1.  **API**: Create `api/admin/god-mode.ts` handler.
    - `GET /stats`: Aggregated system metrics.
    - `POST /control`: Dispatcher for actions (`force_sentinel`, `clear_cache`, `kill_switch`).
2.  **Security**: Update `auth.ts` to support specific "God Mode" permissions.

### Phase 2: The Interface (Frontend)

3.  **Layout**: Build the `GodModeLayout.tsx` with the cyberpunk aesthetic.
4.  **Components**:
    - `StatusBadge.tsx`: Animated pulsing indicators.
    - `TerminalView.tsx`: For logs (style: black bg, green text).
    - `ControlDeck.tsx`: Critical buttons with "Hold to Confirm" interactions.

### Phase 3: "System Visualizer" Integration

5.  **React Flow**: Implement the MoE visualization planned previously, but embed it here as the central widget.

### Phase 4: Data Engineering

6.  **Ops Events**: Ensure `logOpsEvent` is used _everywhere_. The Dashboard is only as good as the data it receives.
7.  **Real-time**: Use polling (swr) every 2-5 seconds for "Live" feel (WebSockets overkill for Vercel).

---

## 5. Critical Details & Edge Cases

- **Mobile Support**: The panel should be usable on mobile (for emergency "Stop" actions while away).
- **Cost**: Polling detailed stats can be database-heavy. We will cache stats in Redis (Vercel KV) for 10-30 seconds.
- **Error Handling**: If the API is down, the God Mode must fail gracefully and show "Manual Override" instructions (e.g., direct DB links).

## 6. Execution Order

1.  **Approve** this plan.
2.  **Backend**: Build the `admin-system` API endpoints.
3.  **Frontend**: Build the UI.
