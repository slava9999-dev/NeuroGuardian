# 🧠 Hybrid AI & Scalability Architecture Spec (Draft)

**Target Phase:** Phase 5 (Infrastructure & AI Evolution)
**Context:** Transition from MVP (Synchronous/Cloud-only) to Production Scale (Async/Hybrid).

## 1. Problem Statement

Current load tests reveal that the synchronous API architecture fails (`ECONNRESET`) at ~20 concurrent heavy requests (Sentinel checks). Additionally, relying solely on Cloud LLMs (Gemini/OpenAI) for 100+ active users will likely lead to cost explosions and latency issues.

## 2. Solution: Hybrid Architecture

### A. Async Queue System (The "Spine")

**Goal:** Decouple User Request from Execution.

- **Tech Stack:** Inngest (Serverless Queue) or BullMQ (Redis).
- **Flow:**
  1. User clicks "Check Prices".
  2. API returns `202 Accepted` + `taskId`.
  3. **Producer:** Adds job to Queue.
  4. **Consumer (Worker):**
     - Runs on separate thread/container.
     - Controls concurrency (e.g., max 5 parallel jobs).
     - Updates DB status.

### B. Hybrid AI "MoE" Router (The "Brain")

**Goal:** Offload cheap logic to Local LLM, keep Cloud for reasoning.

- **Local Node:** workstation with RTX 4070 (8GB VRAM).
- **Serving:** Ollama (`llama3:8b` or `phi-3-mini`).
- **Router Logic:**
  ```typescript
  async function routeIntent(userQuery: string) {
    // 1. Local fast check (0ms cost, 200ms latency)
    const intent = await localLLM.classify(userQuery);

    if (intent === 'CHECK_PRICES') return queue.add('sentinel-check');
    if (intent === 'GET_LOGS') return db.getLogs();

    // 2. Fallback to Cloud for complex reasoning
    if (intent === 'COMPLEX_ANALYSIS') return cloudLLM.generate(userQuery);
  }
  ```

## 3. Implementation Steps (Next Session)

1. **Dockerize Ollama:** Ensure Ollama runs inside the `docker-compose` stack and is accessible by the API container.
2. **Install AI SDK for Ollama:** `@ai-sdk/ollama`.
3. **Refactor Agent Handler:** Split `handleAgentV4` into `Classifier` -> `Executor`.
4. **Queue Setup:** Install Redis (if using BullMQ) or setup Inngest SDK.

## 4. Hardware Constraints

- **VRAM:** 8GB limit. Use Quantized models (q4_k_m).
- **RAM:** 16GB limit. Ensure Docker memory limits are set to avoid OOM.
