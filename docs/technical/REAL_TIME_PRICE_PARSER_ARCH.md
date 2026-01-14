# Architecture: Visual Price Inspector ("Digital Vision")

## 1. Problem Statement

Marketplace APIs (WB/Ozon) return the **Seller's Price** (unit price set in backend).
However, the **Buyer's Price** is often lower due to:

- **WB:** SPP (Sale by Platform Payment) - usually 15-25% funded by WB.
- **Ozon:** Ozon Card Price - funded partly by Ozon, partly by seller.
- **Regional Logistics:** Prices vary by viewer's geo-location (Moscow vs Vladivostok).

**Goal:** Enable the Agent to "see" the product page exactly as a buyer does to calculate true competitive standing.

## 2. Technical Challenges

1.  **Anti-Bot Protection:** Cloudflare, DDOS-Guard, generic fingerprinting. Simple `fetch()` or `curl` is blocked immediately.
2.  **Vercel Limitations:** Our current backend runs on Vercel Serverless Functions.
    - Max execution time: 10s (Hobby) / 60s (Pro).
    - No native Chromium support (too large for function bundle).
3.  **Dynamic Rendering:** Prices are often loaded via JS after initial HTML load (SPA).

## 3. Proposed Architecture

### A. The "Browser Service" (External)

Since Vercel cannot host a heavy browser, we need an external execution environment.
**Options:**

1.  **Browserless.io / ZenRows / ScraperAPI:** SaaS solutions that handle rotation and rendering. (Easiest, paid).
2.  **Self-Hosted Microservice:** A small Docker container running Playwright/Puppeteer + Stealth Plugin on a VPS (Railway/Fly.io/DigitalOcean).

### B. The "Vision" Workflow

Instead of fragile CSS selectors (which break when WB changes layout), we use a Multimodal approach:

1.  **Agent Action:** `get_real_price(url)`
2.  **Browser Service:**
    - Opens URL.
    - Human-like scrolling (to trigger lazy load).
    - Takes a **Screenshot** (Full page or viewport).
    - Extracts visible text (Accessibility Tree).
3.  **Vision Analysis (LLM):**
    - The Screenshot is sent to a Vision Model (e.g., GPT-4o or specialized OCR).
    - Prompt: _"Identify the main price (large font), the Ozon Card price (green text), and the 'before discount' price."_
4.  **Result:** Structured JSON returned to Viktor Agent.

## 4. Implementation Steps (MVP)

### Phase 1: The Tool Interface (Mocked)

- Add `GetRealPriceTool` to Agent V5.
- Define Input: `url`, `marketplace`.
- Define Output: `current_price`, `card_price`, `spp_percent`.

### Phase 2: The Browser Bridge

- Use a robust scraping API (e.g., **ScraperAPI** or **ZenRows** - they offer free tiers for testing).
- Implement `BrowserService` in `src/api-lib/services/browser-service.ts`.
- **Why proxy?** To simulate "Moscow Buyer" vs "Regional Buyer".

### Phase 3: Agent Integration

- When user asks _"Why are reviews bad?"_ -> Agent visits page to read latest reviews visually.
- When user asks _"Check my price index"_ -> Agent compares API price vs Visual price to calculate implied SPP.

## 5. Cost & Performance

- **Latency:** ~5-10 seconds per check (Browser launch + Navigation).
- **Cost:**
  - Self-hosted: ~$5/mo for VPS.
  - SaaS API: ~$49/mo for production volume.
- **Optimization:** Cache results for 1-3 hours.
