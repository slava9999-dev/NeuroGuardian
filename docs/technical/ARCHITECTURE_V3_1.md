# 🏭 NeuroGUARDIAN V3.1 — Industrial Architecture

**Дата:** 2026-01-15  
**Версия:** 3.1.0 (Industrial)  
**Статус:** DESIGN COMPLETE

---

## 📁 Новая структура проекта

```
src/
├── vision/                        # 🆕 VisionCore + RenderFactory
│   ├── index.ts                   # Module exports
│   ├── VisionService.ts           # Gemini Vision analysis
│   ├── RenderFactory.ts           # Image generation (Replicate)
│   ├── MediaQueueService.ts       # Async job queue (QStash)
│   ├── types.ts                   # MediaAsset types + Strict IDs
│   ├── WatermarkService.ts        # 🔜 TODO: Watermark overlay
│   └── StorageService.ts          # 🔜 TODO: Cloud storage (R2/S3)
│
├── agent/                         # AI Agent (existing)
├── infrastructure/                # LLM, RAG (existing)
├── integrations/                  # WB, Ozon (existing)
├── sentinel/                      # Price protection (existing)
└── ...
```

---

## 🔌 Новые зависимости

```json
{
  "dependencies": {
    "@upstash/qstash": "^2.7.0", // Async job queue
    "replicate": "^0.31.0", // AI image generation
    "sharp": "^0.33.0" // Image processing (watermarks)
  }
}
```

### Установка:

```bash
npm install @upstash/qstash replicate sharp
```

---

## 🔑 Новые ENV переменные

```bash
# Vision & Render
REPLICATE_API_KEY=r8_...              # Replicate.com API
QSTASH_TOKEN=...                      # Upstash QStash token
QSTASH_CURRENT_SIGNING_KEY=...        # For webhook verification
MEDIA_WEBHOOK_URL=https://neuro-guardian.vercel.app/api/webhooks/media

# Storage (выбрать один)
CLOUDFLARE_R2_ACCESS_KEY=...          # Option A: Cloudflare R2
CLOUDFLARE_R2_SECRET_KEY=...
CLOUDFLARE_R2_BUCKET=neuroguardian-media

# OR
AWS_S3_ACCESS_KEY=...                 # Option B: AWS S3
AWS_S3_SECRET_KEY=...
AWS_S3_BUCKET=neuroguardian-media
```

---

## 🧠 VisionCore — Модуль анализа

### Workflow: Image Quality Check

```
[RAW Photo] → VisionService.analyzeImage()
                    ↓
            Gemini 2.0 Vision API
                    ↓
            ┌──────────────────────────────────────────┐
            │ VisionAnalysisResult                     │
            │ ├── Lighting Score: 8/10                │
            │ ├── Sharpness: 9/10                     │
            │ ├── Material: "metal" (95% conf)         │
            │ ├── Texture Tags: ["natural", "grain"]  │
            │ ├── WB Compliant: false                  │
            │ │   └── Issues: ["Нужен белый фон"]     │
            │ ├── SEO Tags: ["стол", "интерьер"...]    │
            │ └── Processing Time: 2.3s               │
            └──────────────────────────────────────────┘
```

### API Usage:

```typescript
import { visionService } from '@/vision';

// Full analysis
const result = await visionService.analyzeImage({
  imageUrl: 'https://storage.example.com/raw/table-001.jpg',
  checkType: 'full',
  targetMarketplace: 'both',
});

// Quick quality check
const { pass, score, issues } = await visionService.quickQualityCheck(imageUrl);

// Marketplace compliance only
const compliance = await visionService.checkCompliance(imageUrl, 'WB');

// Generate SEO from image
const seo = await visionService.generateSEODescription(imageUrl);
```

---

## 🎨 RenderFactory — Генерация контента

### Workflow A: White Background (WB/Ozon Main Card)

```
[RAW] → Remove BG (rembg) → White BG + Shadow → Upscale 2x → [WB Ready]
         ~3 sec              ~1 sec              ~5 sec

Total: ~10-15 seconds
```

### Workflow B: Lifestyle Shot

```
[RAW] → Remove BG → Generate Scene (Flux) → Composite → Harmonize → [Marketing]
         ~3 sec         ~15 sec              ~2 sec      ~3 sec

Total: ~25-35 seconds
```

### API Usage:

```typescript
import { renderFactory } from '@/vision';

// White background for WB
const result = await renderFactory.workflowWhiteBackground(imageUrl, {
  shadowIntensity: 0.3,
  upscale: true,
});

// Lifestyle shot
const lifestyle = await renderFactory.workflowLifestyle(imageUrl, {
  scenePrompt: 'Luxury loft interior, concrete walls, warm lighting',
  lightingStyle: 'warm',
});

// Add watermark
const watermarked = await renderFactory.addWatermark(imageUrl, {
  opacity: 0.25,
  position: 'corner',
});
```

---

## ⚡ Async Queue Architecture

### Flow:

```
┌─────────────────┐
│  User uploads   │
│  photo via API  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ API: POST       │     │ Database:       │
│ /api/media      │────▶│ media_jobs      │
│ Returns: 202    │     │ status=pending  │
│ + jobId         │     └────────┬────────┘
└─────────────────┘              │
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Upstash QStash          │
                    │ ─────────────────────── │
                    │ Reliable delivery       │
                    │ Auto-retry (3x)         │
                    │ DLQ for failures        │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Webhook: /api/webhooks/ │
                    │ media-processor         │
                    │ ─────────────────────── │
                    │ 1. VisionService.analyze│
                    │ 2. RenderFactory.render │
                    │ 3. Upload to Storage    │
                    │ 4. Update DB status     │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Result:                 │
                    │ status=completed        │
                    │ result_url=https://...  │
                    └─────────────────────────┘
```

### API Usage:

```typescript
import { mediaQueue } from '@/vision';

// Enqueue job
const jobId = await mediaQueue.enqueue('render_white_bg', imageUrl, {
  productId: 'prod_123',
  metadata: { shadowIntensity: 0.3 },
});

// Poll status
const job = await mediaQueue.getJob(jobId);
// { status: 'processing', attempts: 1, ... }

// Get stats
const stats = await mediaQueue.getStats();
// { pending: 5, processing: 2, completed: 150, failed: 3 }
```

---

## 🗄️ Database Schema Updates

### 1. Strict ID Types

Все ID теперь **STRING** на уровне приложения:

```typescript
// Before (dangerous)
user_id: number; // Overflow risk for Telegram IDs > 2^31
nm_id: number;

// After (safe)
user_id: string; // "7548070478" as string
nm_id: string; // "123456789" as string

// Type-safe helpers
import { toUserId, toNmId } from '@/vision';
const userId = toUserId(7548070478); // Branded type
```

### 2. Media Assets Table

```sql
CREATE TABLE media_assets (
  id VARCHAR(100) PRIMARY KEY,
  product_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(50) NOT NULL,  -- String for BIGINT safety

  type VARCHAR(20) NOT NULL,     -- 'original' | 'white_bg' | 'lifestyle'
  status VARCHAR(20) NOT NULL,   -- 'processing' | 'ready' | 'failed'

  original_url TEXT NOT NULL,
  processed_url TEXT,
  thumbnail_url TEXT,

  vision_metadata JSONB,         -- Full VisionAnalysisResult

  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  mime_type VARCHAR(50),

  created_at TIMESTAMP,
  analyzed_at TIMESTAMP,
  processed_at TIMESTAMP
);
```

### 3. Media Jobs Table

```sql
CREATE TABLE media_jobs (
  id VARCHAR(100) PRIMARY KEY,
  type VARCHAR(50) NOT NULL,     -- 'vision_analyze' | 'render_white_bg'
  status VARCHAR(20) NOT NULL,

  product_id VARCHAR(100),
  source_image_url TEXT NOT NULL,
  result_image_url TEXT,

  metadata JSONB,
  error TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,

  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  processing_time_ms INTEGER
);
```

---

## 🛡️ Security: Watermarking

### NeuroGuardian Watermark Implementation:

```typescript
import sharp from 'sharp';

async function addArbaeraWatermark(
  imageBuffer: Buffer,
  options: { opacity: number; position: 'corner' | 'center' }
): Promise<Buffer> {
  const watermarkSvg = `
    <svg width="200" height="50">
      <text x="10" y="35" 
            font-family="Inter, sans-serif" 
            font-size="24" 
            fill="rgba(255,255,255,${options.opacity})">
        NEUROGUARDIAN
      </text>
    </svg>
  `;

  const watermark = Buffer.from(watermarkSvg);
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();

  const position =
    options.position === 'corner'
      ? { top: metadata.height! - 70, left: metadata.width! - 220 }
      : { top: Math.floor(metadata.height! / 2) - 25, left: Math.floor(metadata.width! / 2) - 100 };

  return image.composite([{ input: watermark, ...position }]).toBuffer();
}
```

---

## 📋 Implementation Checklist

### Phase 1: Core (Week 1)

- [x] VisionService.ts — Gemini Vision integration
- [x] RenderFactory.ts — Replicate workflows
- [x] MediaQueueService.ts — QStash integration
- [x] types.ts — MediaAsset schema + Strict IDs

### Phase 2: Infrastructure (Week 2)

- [ ] StorageService.ts — R2/S3 upload/download
- [ ] WatermarkService.ts — Sharp-based watermarking
- [ ] API endpoints: `/api/media/*`
- [ ] Webhook handler: `/api/webhooks/media-processor`

### Phase 3: Integration (Week 3)

- [ ] Product upload flow integration
- [ ] Dashboard: Media gallery component
- [ ] Auto-generate on product creation
- [ ] Retry failed jobs cron

### Phase 4: Polish (Week 4)

- [ ] ControlNet integration (preserve geometry)
- [ ] A/B test lifestyle scenes
- [ ] Analytics: conversion by image type
- [ ] Cost optimization (batch processing)

---

## 💰 Cost Estimates

| Service            | Operation      | Cost     |
| ------------------ | -------------- | -------- |
| Gemini Vision      | Per analysis   | ~$0.002  |
| Replicate RemoveBG | Per image      | ~$0.01   |
| Replicate Flux     | Per generation | ~$0.03   |
| Replicate Upscale  | Per image      | ~$0.02   |
| QStash             | Per message    | ~$0.0001 |

**Per product full processing:** ~$0.06-0.10

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install @upstash/qstash replicate sharp

# 2. Add env variables to Vercel
vercel env add REPLICATE_API_KEY production
vercel env add QSTASH_TOKEN production

# 3. Run migration
npx tsx scripts/migrate-media-tables.ts

# 4. Test locally
npx tsx scripts/test-vision.ts
```

---

_Architecture Document — NeuroGUARDIAN V3.1 Industrial_
