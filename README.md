# Professor Mohammad Mahdi AI (منصة بروفيسور محمد مهدي AI)

> An intelligent, high-performance web and mobile application powering interactive growth campaigns, verified community engagement, and AI-assisted audience interactions.

---

## 🌟 Overview (نظرة عامة)

**Professor Mohammad Mahdi AI** is a full-stack platform designed to facilitate organic, verified social interactions (Instagram, TikTok) through a transparent, gamified points and campaign ecosystem. Built with a high-performance React + Vite frontend and an enterprise-grade Express.js backend with optional PostgreSQL and Redis clustering, it guarantees strict user isolation, zero-credential follower growth, and server-side Gemini AI integration.

---

## 🚀 Key Features (أهم المميزات)

- **Strict Multi-User Isolation**: Each user session is uniquely identified with tamper-proof anonymous IDs, ensuring 100% segregated balances and histories.
- **Fair Points Economy**: Every new user receives a one-time onboarding bonus of 10 points to launch their first campaign. Zero inflation, no unearned daily bonuses.
- **Verified Social Campaigns**: Creators spend 10 points to launch a verified campaign (+10 followers) across TikTok and Instagram.
- **Community Task Completion**: Users complete real engagement tasks to earn +1 point per task with strict anti-duplicate submission controls.
- **Double-Spend & Concurrency Protection**: High-speed transaction mutexes prevent race conditions and duplicate balance deductions.
- **Server-Side Gemini AI Integration**: Conversational assistant with automatic exponential backoff, rate-limit resilience, and zero client-side credential exposure.
- **Cloud Run & Container Ready**: Optimized single-bundle Node.js server (`dist/server.cjs`) with native health probes and graceful shutdown.

---

## 🛠️ Technology Stack (التقنيات المستخدمة)

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti
- **Backend**: Node.js, Express, TypeScript (`tsx` for dev, `esbuild` for production bundle)
- **AI Engine**: Google Gen AI SDK (`@google/genai`) executed exclusively on the server
- **Data & Caching**: Multi-tiered storage engine (Transactional In-Memory + File Persistence with optional PostgreSQL and Redis clustering)
- **Security**: Rate Limiting (`express-rate-limit`), CORS Whitelisting, Compression, Input Sanitization with Zod

---

## ⚙️ Environment Variables (المتغيرات البيئية)

The project uses environment variables strictly for backend services. **Never commit actual credentials to version control.**

Copy `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Optional | Google Gemini AI API key for server-side chat and analysis. |
| `APP_URL` | Optional | Public URL of the hosted application. |
| `DATABASE_URL` | Optional | PostgreSQL connection string for distributed multi-instance deployment. |
| `DATABASE_SSL` | Optional | Set to `'true'` if your PostgreSQL provider requires SSL encryption. |
| `REDIS_URL` | Optional | Redis connection string for distributed mutex locking and cache. |
| `INSTAGRAM_GRAPH_TOKEN` | Optional | Meta Graph API Bearer token for automated business discovery. |
| `INSTAGRAM_ACCOUNT_ID` | Optional | Meta Instagram Business account ID. |
| `TIKTOK_ACCESS_TOKEN` | Optional | TikTok Open API Bearer token for profile validation. |

*Note: In Google AI Studio and Cloud Run environments, secrets are securely injected at runtime and never hardcoded in the codebase.*

---

## 📦 Installation & Setup (التثبيت والتشغيل المحلي)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/professor-mohammad-mahdi-ai.git
cd professor-mohammad-mahdi-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
The development server will start on `http://localhost:3000` with hot-module reloading and full API routing.

---

## 🏗️ Building for Production (بناء المشروع للإنتاج)

To build both the React frontend and the bundled backend server for production:

```bash
npm run build
```

This executes:
1. `vite build`: Compiles and minifies the client-side SPA into static assets in `dist/`.
2. `esbuild server.ts`: Bundles the backend server into a standalone CommonJS file `dist/server.cjs` with sourcemaps.

To verify code quality and TypeScript types before deployment:
```bash
npm run lint
```

---

## 🚢 Running in Production (تشغيل الإنتاج)

To start the production server:

```bash
npm start
```
This executes `node dist/server.cjs` and binds to `0.0.0.0:3000` (serving both the API routes and static frontend).

---

## ☁️ Google Cloud Run Deployment (النشر على Cloud Run)

The application is fully architected for Google Cloud Run:

1. **Port Binding**: Binds to port `3000` on host `0.0.0.0` to match Cloud Run container routing.
2. **Container Health Probes**:
   - `GET /health` (Root container liveness probe)
   - `GET /api/health` (Detailed subsystem readiness probe)
3. **Graceful Shutdown**: Intercepts `SIGTERM` and `SIGINT` signals to flush transactions before terminating.
4. **Security Best Practice**: All secrets must be mounted via Google Secret Manager or Cloud Run Environment Variables—never committed to Git.

---

## 📡 Core API Endpoints (واجهات برمجة التطبيقات الأساسية)

All endpoints reside under the `/api` prefix and require no user passwords:

| Endpoint | Method | Description |
|---|---|---|
| `/health` | `GET` | Root container ingress health probe. |
| `/api/health` | `GET` | Full diagnostic health check (DB, memory, uptime). |
| `/api/version` | `GET` | Application build ID and anti-cache headers. |
| `/api/user/me` | `GET` | Retrieves or initializes the isolated anonymous user profile. |
| `/api/tasks` | `GET` | Lists available community engagement tasks. |
| `/api/tasks/:id/submit` | `POST` | Submits task proof to claim +1 point. |
| `/api/campaigns` | `GET` | Lists active growth campaigns. |
| `/api/campaigns` | `POST` | Creates a new growth campaign (deducts 10 points). |
| `/api/points` | `GET` | Returns points balance and transaction history. |
| `/api/chat` | `POST` | Communicates with the AI assistant (proxied safely via Gemini). |

---

## 🔒 Security & Privacy (الأمان والخصوصية)

- **Zero Passwords**: Users never enter social media passwords or private tokens.
- **Client-Side Sanitization**: Zero API keys, secrets, or internal configs are exposed to the browser.
- **Protection Against Race Conditions**: Mutex locks ensure points cannot be double-spent across concurrent requests.
- **Data Protection**: Strict `.gitignore` excludes all `.env*` files, local caches, and credentials.

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
