# NeuroGUARDIAN Architecture Visualization Plan

## 1. Overview

The NeuroGUARDIAN system has evolved from a simple webhook-based system (using n8n) to a complex **Multi-Modal Hybrid Architecture**. This document outlines the plan to visualize this new architecture to improve observability, debugging, and system comprehension.

## 2. Legacy Cleanup (Completed)

- **n8n Removal**: All n8n webhooks and routes have been disabled in `api/index.ts` and `n8n-client.ts`. The system no longer relies on external low-code tools for core logic, moving to internal robust orchestration.

## 3. The New Multi-Modal Topology

The system now consists of the following "Modes" or "Nodes" that need visualization:

### A. Core Intelligence (MoE Layer)

- **Router (MoE)**: Classifies intent (Agent vs Sentinel vs System).
- **Local LLM**: Handles inference for fast/private tasks.
- **Cloud LLM (OpenAI/Anthropic)**: Handles complex reasoning (V5 Agent).
- **Memory (ChromaDB)**: Vector store for long-term context.

### B. Execution Layer

- **Agent Orchestrator (V5)**: Manages multi-step plans and tool execution.
- **Sentinel Service**: Runs background loops for price monitoring and defense.
- **Inngest Queue**: Handles async background jobs (replacing n8n workflows).

### C. Interface Layer

- **Telegram Gateway**: Main user entry point.
- **API Gateway**: Handles webhooks and REST requests.

## 4. Proposed Visualization Solution: "NeuroSystem Monitor"

### Goal

Create a visual "Mission Control" dashboard that renders the live state of these nodes.

### Technology Stack

- **Frontend**: React + `react-flow-renderer` (for the graph) + `framer-motion` (animations).
- **Backend**: Existing `ops-dashboard` endpoints extended to return "Node Health".
- **Data Source**: `ops_events` table (for execution tracing) and `sentinel_logs` (for monitoring).

### Implementation Steps

#### Phase 1: Data Aggregation (Backend)

Create a new generic endpoint `GET /api?action=get-system-topology` that returns:

```json
{
  "nodes": [
    { "id": "router", "status": "healthy", "lastActive": "2s ago" },
    { "id": "sentinel", "status": "running", "lastActive": "1m ago", "stats": { "threats": 0 } },
    { "id": "chroma", "status": "connected", "latency": "12ms" }
  ],
  "edges": [
    { "from": "router", "to": "sentinel", "activity": "low" },
    { "from": "router", "to": "agent_v5", "activity": "high" }
  ]
}
```

#### Phase 2: Visualization UI (Frontend)

Build `SystemTopology.tsx` component:

1.  **Visual Graph**: Nodes arranged automatically.
2.  **Live Status**: Nodes pulse Green (Active), Red (Error), or Grey (Idle).
3.  **Interactive Debug**:
    - Click **Sentinel Node** -> Opens Sentinel Log view.
    - Click **Agent Node** -> Opens active Thinking Process (Plan).
    - Click **Router** -> Shows recent classification confidence scores.

## 5. Benefits

- **Instant Diagnostics**: See immediately if ChromaDB is down or Sentinel is stuck.
- **Flow Comprehension**: Visual proof of how the "Multi-Modal" routing works (e.g., verifying a query went to Local LLM vs Cloud Agent).
- **Zero External Dependencies**: Replaces n8n's visualizer with a native, integrated solution.

## 6. Next Steps

1.  Approve this plan.
2.  Implement `handleGetSystemTopology` in `analytics.ts`.
3.  Create the React component in the frontend.
