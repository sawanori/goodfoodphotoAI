# BananaDish Backend API

Cloud Run API proxy for BananaDish food photo enhancement app.

## Tech Stack

- Node.js 20 LTS
- Express 4.x
- TypeScript 5.x
- Sharp (image processing)
- Gemini 2.0 Flash Exp API
- Firebase Admin SDK

## Development

### Prerequisites

- Node.js 20+
- npm 10+
- gcloud CLI (for deployment)

### Setup

```bash
npm install
```

### Run Locally

```bash
npm run dev
# Server runs on http://localhost:8080
```

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

## Deployment

See T107 task for Cloud Run deployment instructions.

## Endpoints

- `GET /health`: Health check
- `GET /`: Service info
- `POST /v1/generate`: Generate enhanced food photos (T105)
- `GET /v1/subscription/status`: Get subscription status (T106)
- `POST /v1/subscription/validate-receipt`: Validate Apple IAP receipt (T106)

## Environment Variables

- `PORT`: Server port (default: 8080)
- `GEMINI_API_KEY`: Gemini API key (from Secret Manager)
- `GOOGLE_APPLICATION_CREDENTIALS`: Firebase Admin SDK credentials path
