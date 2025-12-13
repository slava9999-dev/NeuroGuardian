# 🛡️ NeuroGUARDIAN (Arborius Guardian)

## Margin Defense System for WB & Ozon Sellers

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Firebase CLI (`npm install -g firebase-tools`)
- Google Cloud SDK (optional, for gcloud commands)

### Installation

```bash
# Clone the repository
git clone https://github.com/slava9999-dev/NeuroGuardian.git
cd NeuroGuardian

# Install frontend dependencies
npm install

# Install functions dependencies
cd functions && npm install && cd ..
```

### Development

```bash
# Start frontend dev server
npm run dev

# Start Firebase emulators (optional)
firebase emulators:start
```

### Build & Deploy

```bash
# Build frontend
npm run build

# Deploy to Vercel (automatic via GitHub)
git push origin main

# Deploy Cloud Functions
cd functions && npm run build
firebase deploy --only functions
```

---

## 📋 Environment Variables

### Frontend (.env)

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=arbarea-mobile-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=arbarea-mobile-app
VITE_FIREBASE_STORAGE_BUCKET=arbarea-mobile-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=146520926544
VITE_FIREBASE_APP_ID=1:146520926544:web:66400a01a273ce895702455
VITE_FIREBASE_MEASUREMENT_ID=G-EDX3X5QY1R
VITE_USE_EMULATORS=false
VITE_API_BASE_URL=https://us-central1-arbarea-mobile-app.cloudfunctions.net
```

### Functions (.env)

```env
TELEGRAM_BOT_TOKEN=your_bot_token
CLOUDPAYMENTS_API_SECRET=your_secret
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    TELEGRAM MINI APP                        │
│                   (React + Vite + TWA)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  FIREBASE CLOUD FUNCTIONS                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Gatekeeper  │  │    Sync      │  │   Sentinel   │      │
│  │  (Auth/Pay)  │  │  (API Fetch) │  │  (Defense)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Firestore     │  │ Secret Manager  │  │  Cloud Tasks    │
│   (Database)    │  │  (API Keys)     │  │  (Job Queue)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 📡 API Endpoints

| Endpoint              | Method     | Description                            |
| --------------------- | ---------- | -------------------------------------- |
| `/telegramAuth`       | POST       | Authenticate via Telegram initData     |
| `/paymentWebhook`     | POST       | CloudPayments webhook handler          |
| `/saveApiKey`         | POST       | Save WB/Ozon API key to Secret Manager |
| `/getProducts`        | GET        | Get user's products                    |
| `/updateSettings`     | POST       | Update protection settings             |
| `/updateMinPrice`     | POST       | Update product minPrice                |
| `/sentinelDispatcher` | Scheduler  | Dispatch worker tasks                  |
| `/sentinelWorker`     | Cloud Task | Check prices & execute defense         |

---

## 🛡️ Defense Modes

### 1. Zero Stock Mode

When price drops below minPrice, product stock is set to 0 (removed from sale).

### 2. Price Correction Mode

When price drops below minPrice, price is automatically corrected back to minPrice.

---

## 🔒 Security

- **Telegram Auth**: HMAC-SHA256 validation of initData
- **API Keys**: Stored in Google Cloud Secret Manager
- **Firestore Rules**: Users can only access their own data
- **Payment Webhooks**: Signature validation

---

## 📱 Telegram Bot Setup

1. Create bot via [@BotFather](https://t.me/BotFather)
2. Enable Mini Apps (Web App)
3. Set Web App URL to your Vercel deployment
4. Configure payment provider (optional)

---

## 🚀 Production Checklist

- [ ] Set real Firebase API Key in .env
- [ ] Configure Vercel Environment Variables
- [ ] Deploy Cloud Functions
- [ ] Create Cloud Tasks queue: `sentinel-worker-queue`
- [ ] Enable Secret Manager API
- [ ] Enable Artifact Registry API
- [ ] Set up Telegram Bot
- [ ] Configure payment webhook URL
- [ ] Test full flow in Telegram

---

## 📊 Monitoring

- Firebase Console: https://console.firebase.google.com/
- Vercel Dashboard: https://vercel.com/
- Cloud Functions Logs: `firebase functions:log`

---

## 📄 License

MIT

---

## 👨‍💻 Author

NeuroExpert Team
