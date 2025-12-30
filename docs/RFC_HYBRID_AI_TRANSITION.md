# 🦅 Request for Comments (RFC): NeuroGUARDIAN Hybrid AI Architecture

**Topic:** Transitioning to Hybrid MoE (Mixture of Experts) Architecture with Local Hardware Acceleration.

## 1. Context & Constraints

We are scaling **NeuroGUARDIAN**, an automated extensive e-commerce management system for sellers (Wildberries/Ozon).

**Current Stack:**

- **Backend:** Node.js (Next.js/Vercel), PostgreSQL (Neon).
- **AI:** Google Gemini 1.5 (Cloud).
- **Logic:** "Sentinel" (Heavy math/price checks) + "Agent" (Chat).
- **Load:** Synchronous API chokes at ~20 concurrent heavy requests (`ECONNRESET`).
- **Goal:** Support **100+ concurrent users** (Sentinel checks + Chat) cost-effectively.

**Available Hardware (Local Node):**

- **GPU:** NVIDIA RTX 4070 (8GB VRAM).
- **RAM:** 16GB System RAM.
- **OS:** Windows + Docker.

## 2. Proposed "Hybrid MoE" Architecture

We aim to implement a **Router-Worker** pattern to offload costs and latency from Cloud APIs.

### The Flow:

1.  **Ingress:** User sends request (Chat or Button click).
2.  **Local Router (The "Gatekeeper"):**
    - Runs on **RTX 4070** (Docker/Ollama).
    - Model: Small, fast, function-calling capable (e.g., Llama-3-8B-Instruct or Phi-3).
    - **Job:** Classify Intent -> `CHECK_PRICE` | `GENERAL_CHAT` | `COMPLEX_ANALYSIS`.
3.  **Execution (The "Experts"):**
    - **Simple/Deterministic:** Handled immediately by code (e.g., SQL query, JSON config update).
    - **Heavy/Async:** Sent to **Queue** (Inngest/BullMQ).
    - **Complex/Creative:** Forwarded to **Cloud LLM** (Gemini 1.5 Pro).

## 3. The "Consortium" Questions

We request expert recommendations on the following:

### A. Best "Router" Model for 8GB VRAM

We need reliable **JSON Output** and **Intent Classification**.

- **Options:**
  1. `Meta-Llama-3-8B-Instruct` (Quantized q4_k_m)
  2. `Mistral-Nemo-12B` (Heavy for 8GB?)
  3. `Phi-3-Mini` (3.8B - smart enough?)
  4. `Hermes-2-Pro-Llama-3` (Agentic fine-tuned?)
- **Question:** Which model provides the best balance of **Function Calling reliability** vs **Latency** on consumer 4070?

### B. "State" Management (Context Window)

For 100 users, loading full chat history into the Context Window is expensive/slow.

- **Hypothesis:** Use "Mamba-style" summarization or Vector DB.
- **Question:** Are there ready-made patterns (LangGraph? MemGPT?) that fit a **Node.js/TypeScript** stack for managing long-term seller context without passing 100k tokens per request?

### C. Ready-Made Orchestration Frameworks

We are currently coding raw API handlers.

- **Question:** Should we adopt an Agent Framework for the "Router" logic?
  - **LangGraph.js:** Good for stateful flows?
  - **AutoGen:** Overkill?
  - **Temporal.io / Inngest:** For durable execution?
  - _Goal:_ Minimal overhead, maximum typesafety (TypeScript).

### D. The "Queue" Dilemma

Vercel Serverless (Next.js) + Local Docker Worker.

- **Question:** Best queue solution that bridges Cloud (Vercel) and Local (GPU Workstation)?
  - **Inngest:** (HTTP based, Vercel native).
  - **Redis/BullMQ:** (Requires exposing Local Redis to Cloud or hosting Redis in Cloud).

## 4. Success Criteria

1.  **Zero `ECONNRESET`** at 100 concurrent users.
2.  **60% Cost Reduction** on Cloud LLM API (by routing 60% of traffic to Local LLM/Code).
3.  **<2s Latency** for "Simple" intents.
