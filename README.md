<div align="center">

# 🔍 ClientAnchor

### AI-Powered Lead Discovery & Outreach Platform

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://prisma.io)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?logo=clerk&logoColor=white)](https://clerk.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Describe who you're looking for — ClientAnchor finds them, enriches their contact details, and helps you reach out, all in one workflow.**

[Features](#-features) · [Quick Start](#-quick-start) · [Architecture](#-architecture) · [API Reference](#-api-reference) · [Environment Variables](#-environment-variables)

---

</div>

## ✨ Features

| Feature | Description |
|---|---|
| 🤖 **Natural Language Search** | Type what you're looking for — the platform infers intent (business / job / partnership) and fans out across multiple data sources |
| 🗺️ **Multi-Source Discovery** | Aggregates from Google Places API, SerpAPI knowledge graph, and Adzuna Jobs in a single pass |
| 📊 **Smart Result Cards** | Per-type KPI panels — ratings for businesses, salary bands for jobs, executive data for corporations |
| 🔎 **Contact Enrichment** | Three-tier email extraction (JSON-LD → `mailto:` hrefs → regex) + Hunter.io domain search |
| 📤 **CSV / XLSX Export** | 17-column export with dark-themed Excel sheet, hyperlinks, and auto-filter |
| ✉️ **Cold Outreach** | Three battle-tested email templates (Direct Value / PAS / Partnership) sent via Resend |
| 🕓 **Search History Hub** | Pause, refresh, duplicate, or archive any previous search |
| 🔄 **Background Refresh** | Re-run any saved search to surface new leads without losing old ones |
| 🔐 **Auth + Guest Mode** | Clerk auth for logged-in users; anonymous searches stored under a shared guest account |

---

## 🖥️ UI Walkthrough

### 1 — Home / Search Entry

```
┌─────────────────────────────────────────────────────────────┐
│  🔍  ClientAnchor                          [History] [Sign In] │
│                                                              │
│         Find your next client, partner, or hire.            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Find SaaS companies hiring product managers in ...  │   │
│  └──────────────────────────────────────────────────────┘   │
│  [📍 Geo]  [💰 Budget]  [💼 Work type]      [Search →]      │
└─────────────────────────────────────────────────────────────┘
```

Type any plain-English description. Optional filters narrow by location, salary/budget, and work type. Hit **Search** — results appear within seconds.

---

### 2 — Results Dashboard

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ 🏢 Acme Corp     │  │ 💼 SWE @ TechCo  │  │ 🌐 GloboCorp     │
│ ★★★★☆ 4.2  •  🟢│  │ £60k – £80k      │  │ HQ: New York     │
│ Business Consult │  │ Full-time Remote  │  │ 2,400 employees  │
│                  │  │                  │  │                  │
│ [🗺 Maps][Details]│  │ [Apply][Details] │  │ [Visit][Details] │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

Cards are **type-aware**: businesses show star ratings and operational status; jobs show salary range and contract type; corporations surface HQ, headcount, and revenue from the knowledge graph.

---

### 3 — Result Detail Modal + Enrichment

```
┌───────────────────────────────────────────────────────────────┐
│  Acme Corp                                       [✉ Outreach] │
│  ───────────────────────────────────────────────────────────  │
│  ★★★★☆  4.2  •  381 reviews  •  🟢 OPERATIONAL               │
│  Category: Business Consulting                                │
│  Website:  acmecorp.com                                       │
│  Maps:     📍 View on Google Maps                             │
│                                                               │
│  ✦ Enrich Contacts                                            │
│  ─────────────────                                            │
│  📧 jane@acmecorp.com   Jane Smith  — CEO                     │
│  📧 bob@acmecorp.com    Bob Lee     — CTO                     │
│  📞 +44 20 1234 5678                                          │
└───────────────────────────────────────────────────────────────┘
```

Click **✦ Enrich** to trigger the three-tier scraper + Hunter.io lookup. Contacts appear live — no page reload needed.

---

### 4 — Outreach Panel

```
┌───────────────────────────────────────┐
│  Send Outreach                    ✕   │
│  ───────────────────────────────────  │
│  [⚡ Direct]  [📈 PAS]  [🤝 Partner]  │
│                                       │
│  To:      jane@acmecorp.com ▾         │
│  Subject: Quick question about Acme   │
│                                       │
│  Hi Jane,                             │
│  I came across Acme Corp while ...    │
│                                       │
│  ⚠  Unfilled: {{industry}}            │
│                                       │
│            [Edit ↔ Preview]           │
│                    [Send Email →]     │
└───────────────────────────────────────┘
```

Three templates selectable by tab. Variables auto-seeded from enrichment data. Amber border highlights any unfilled `{{token}}`. Switch between Edit and Preview. Sent emails are logged as `OutreachEvent` records.

---

### 5 — Search History Hub

```
┌─────────────────────────────────────────────────────────────────┐
│  My Searches                    [Newest ▾]  [All intents ▾]     │
│  ─────────────────────────────────────────────────────────────  │
│  🟢 SaaS companies London        12 results  2 hours ago        │
│     [google_places] [serpapi]    [Open] [↻ Refresh] [⧉] [✕]    │
│                                                                  │
│  🟡 Fintech partnerships Berlin  8 results   2 days ago         │
│     [serpapi] [adzuna]           [Open] [↻ Refresh] [⧉] [✕]    │
│                                                                  │
│  🔵 Running...  AI consultancies NY                              │
│     (spinner)                                                    │
└─────────────────────────────────────────────────────────────────┘
```

Status dots: 🟢 active / 🟡 stale (>7 days) / 🔵 running / 🔴 failed.
**Refresh** re-runs the original query and appends only new results. **⧉ Duplicate** clones the prompt into a new search. **✕** archives (not deletes).

---

## 🏗️ Architecture

### System Overview

```
                        ┌─────────────────────────────────┐
                        │         ClientAnchor             │
                        │      Next.js 16 App Router       │
                        └────────────┬────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                       │
    ┌─────────▼────────┐   ┌────────▼────────┐   ┌─────────▼────────┐
    │  Clerk Auth      │   │  Prisma ORM     │   │  External APIs   │
    │  (JWT + Guest)   │   │  PostgreSQL DB  │   │  Places/SERP/    │
    └──────────────────┘   └─────────────────┘   │  Adzuna/Hunter   │
                                                  └──────────────────┘
```

### Data Flow — Full Pipeline

```mermaid
flowchart TD
    A([User types natural-language query]) --> B[POST /api/search]
    B --> C{Intent Detection\nAnthropic Claude}
    C -->|business| D[Google Places API v1]
    C -->|job| E[Adzuna Jobs API]
    C -->|general / partnership| F[SerpAPI Knowledge Graph]
    D & E & F --> G[Deduplicate + Score Results]
    G --> H[(PostgreSQL — Result rows)]
    H --> I[GET /api/results/:id → Dashboard]

    I --> J{Click Details}
    J --> K[ResultDetail Modal\nType-specific KPIs]
    K --> L{Click Enrich ✦}
    L --> M[POST /api/enrich/:id]
    M --> N[Web Scraper\nJSON-LD → mailto → regex]
    N --> O[Hunter.io Domain Search]
    O --> P[(Contact rows saved)]
    P --> K

    K --> Q{Click Outreach}
    Q --> R[OutreachPanel slide-over]
    R --> S[Pick template · fill variables]
    S --> T[POST /api/outreach]
    T --> U[Resend SDK → email delivered]
    U --> V[(OutreachEvent — status: sent)]

    I --> W[GET /api/export/:id?format=xlsx]
    W --> X[ExcelJS 17-col workbook\ndark header · hyperlinks]
    X --> Y([Browser download])

    I --> Z[POST /api/refresh/:id]
    Z --> G
```

### Enrichment Pipeline (3-Tier)

```
POST /api/enrich/:resultId
        │
        ├─► 1. Fetch result.website HTML
        │         └─► Parse JSON-LD structured data
        │               → emails, phone numbers
        │
        ├─► 2. Scan anchor hrefs for mailto: links
        │         → deduplicated email list
        │
        ├─► 3. Regex scan visible text
        │         → catch any remaining addresses
        │
        ├─► Follow sub-pages: /contact  /about  /team
        │         → same 3-tier extraction on each
        │
        └─► Hunter.io /domain-search
              → up to 3 professional contacts
              → saved to Contact table
              → result.enriched = true
```

### Database Schema

```
Account ──< SearchQuery ──< Result ──< Contact
Account ──< EmailTemplate            └──< OutreachEvent
```

```
Account               SearchQuery           Result
─────────────         ───────────────       ──────────────────────
id (PK, cuid)         id (PK, cuid)         id (PK, cuid)
userId (unique)       userId → Account      searchId → SearchQuery
email                 prompt (Text)         name
name                  intent                type  (business/job/person/corporation)
createdAt             filters (JSON)        description
                      status                website · email · phone
                      resultCount           address · city · country
                      avgScore              matchScore · matchReason
                      createdAt             source · sourceUrl
                      updatedAt             rawData (JSON)
                                            enriched (Boolean)
                                            createdAt

Contact               EmailTemplate         OutreachEvent
───────────           ─────────────         ───────────────
id                    id                    id
resultId → Result     userId → Account      resultId
name                  name · subject        templateId
title                 body (Text)           subject · body (Text)
email · linkedin      approachType          status (draft/sent/opened)
isPrimary             variables (String[])  sentAt
                      createdAt             createdAt
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+**
- **PostgreSQL** — local, or cloud: [Neon](https://neon.tech), [Supabase](https://supabase.com), [Railway](https://railway.app)
- API accounts: Clerk · Google Cloud · SerpAPI · Adzuna · Hunter.io · Resend

### 1. Clone & Install

```bash
git clone https://github.com/prateeks0221-code/Client-Anchor.git
cd Client-Anchor
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# open .env.local and fill in all values
```

### 3. Push Database Schema

```bash
npx prisma generate
npx prisma db push
```

### 4. Start Dev Server

```bash
npm run dev
# → http://localhost:3000
```

### 5. (Optional) Seed Email Templates

```bash
node scripts/seed-templates.js
```

---

## 🔑 Environment Variables

| Variable | Required | Purpose | Where to get |
|---|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection | Your DB provider |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk client key | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | ✅ | Clerk server key | Same |
| `ANTHROPIC_API_KEY` | ✅ | Intent detection | [Anthropic Console](https://console.anthropic.com) |
| `GOOGLE_PLACES_API_KEY` | ✅ | Business discovery | GCP → Enable **Places API (New)** |
| `SERPAPI_API_KEY` | ✅ | Web + knowledge graph | [serpapi.com/manage-api-key](https://serpapi.com/manage-api-key) |
| `ADZUNA_APP_ID` | ✅ | Job listings | [developer.adzuna.com](https://developer.adzuna.com) |
| `ADZUNA_APP_KEY` | ✅ | Job listings | Same |
| `HUNTER_API_KEY` | ✅ | Email enrichment | [hunter.io/api-keys](https://hunter.io/api-keys) |
| `RESEND_API_KEY` | ✅ | Email sending | [resend.com/api-keys](https://resend.com/api-keys) |
| `RESEND_FROM_EMAIL` | ✅ | Sender address | Any email on a verified Resend domain |
| `UPSTASH_REDIS_REST_URL` | ❌ | Rate limiting (optional) | [console.upstash.com](https://console.upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ | Rate limiting (optional) | Same |

```env
# .env.local — copy this and fill in your values

DATABASE_URL="postgresql://user:pass@host:5432/clientanchor"

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."

ANTHROPIC_API_KEY="sk-ant-..."

GOOGLE_PLACES_API_KEY="AIza..."
SERPAPI_API_KEY="..."
ADZUNA_APP_ID="..."
ADZUNA_APP_KEY="..."

HUNTER_API_KEY="..."

RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="you@yourdomain.com"

# Optional
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

---

## 📡 API Reference

### Search & Results

| Method | Endpoint | Body / Params | Returns |
|---|---|---|---|
| `POST` | `/api/search` | `{ prompt, filters }` | `{ searchId, intent, results[], count }` |
| `GET` | `/api/results/:searchId` | — | `DashboardResult[]` |
| `GET` | `/api/searches` | — | `SearchQuery[]` (current user) |
| `PATCH` | `/api/searches/:id` | `{ status: "archived" \| "completed" }` | `{ success, id, status }` |
| `POST` | `/api/refresh/:searchId` | — | `{ newResults, totalCount }` |

### Enrichment & Export

| Method | Endpoint | Params | Returns |
|---|---|---|---|
| `POST` | `/api/enrich/:resultId` | — | `{ email, phone, enriched, contacts[] }` |
| `GET` | `/api/export/:searchId` | `?format=csv` | CSV file download |
| `GET` | `/api/export/:searchId` | `?format=xlsx` | Excel file download |

### Outreach

| Method | Endpoint | Body / Params | Returns |
|---|---|---|---|
| `POST` | `/api/outreach` | `{ resultId, templateId, subject, body, to }` | `{ id, status: "sent" }` |
| `GET` | `/api/outreach` | `?resultId=:id` | `OutreachEvent[]` |

### Example: Run a Search

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Find SaaS startups in Berlin hiring senior engineers",
    "filters": { "geo": "Berlin, Germany", "workType": "hybrid" }
  }'
```

```json
{
  "searchId": "clx1a2b3c4...",
  "intent": "job",
  "count": 18,
  "results": [
    {
      "id": "clx9z...",
      "name": "TechStack GmbH",
      "type": "job",
      "description": "Senior Backend Engineer — Kotlin / Kafka",
      "website": "https://techstack.de/careers",
      "matchScore": 92,
      "source": "adzuna",
      "rawData": { "salaryMin": 75000, "salaryMax": 110000, "contractType": "permanent" }
    }
  ]
}
```

---

## 🧱 Tech Stack

| Layer | Choice |
|---|---|
| **Framework** | Next.js 16 App Router |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS v4 |
| **UI components** | shadcn/ui + Radix UI |
| **Animation** | Framer Motion |
| **State** | Zustand + TanStack React Query |
| **Database** | PostgreSQL + Prisma ORM |
| **Auth** | Clerk v7 |
| **AI** | Anthropic Claude (intent detection) |
| **Email delivery** | Resend + React Email |
| **Web scraping** | Cheerio |
| **Excel export** | ExcelJS |
| **Toasts** | Sonner |
| **Icons** | Lucide React |

---

## 📁 Project Structure

```
my-app/
├── app/
│   ├── api/
│   │   ├── search/            # POST  — fan-out search
│   │   ├── results/[id]/      # GET   — result set
│   │   ├── enrich/[id]/       # POST  — scrape + Hunter.io
│   │   ├── export/[id]/       # GET   — CSV / XLSX
│   │   ├── outreach/          # POST/GET — email & log
│   │   ├── searches/
│   │   │   └── [id]/          # PATCH — archive / restore
│   │   └── refresh/[id]/      # POST  — re-run search
│   ├── dashboard/[id]/        # Results view
│   ├── hub/                   # Search history
│   └── page.tsx               # Home
│
├── components/
│   ├── ResultCard.tsx          # Grid card — score badge, type KPIs
│   ├── ResultDetail.tsx        # Full modal — enrichment, outreach trigger
│   └── OutreachPanel.tsx       # Right slide-over — templates, send
│
├── lib/
│   ├── searchers/
│   │   ├── google-places-searcher.ts
│   │   ├── serpapi-searcher.ts
│   │   ├── adzuna-searcher.ts
│   │   └── index.ts           # runAllSearchers() — parallel fan-out
│   ├── enricher.ts            # 3-tier extractor + Hunter.io
│   ├── email-templates.ts     # Template library + renderer
│   └── prisma.ts              # Singleton client
│
├── prisma/schema.prisma        # DB models
├── types/index.ts              # Shared TypeScript types
└── proxy.ts                    # Clerk middleware (Next.js 16)
```

---

## 🛠️ Developer Notes

### Guest / Anonymous Mode
Unauthenticated users can run searches. Results are stored under a singleton `guest` account (`userId: 'guest'`). Signing in gives each user an isolated search history.

### Middleware File Name
Next.js 16 uses `proxy.ts`, not `middleware.ts`. All routes are public — Clerk is used for identity only, not route-level access control.

### ExcelJS + Next.js 16
`workbook.xlsx.writeBuffer()` returns a `Uint8Array`-like buffer. The export route wraps it in a `Blob` before passing to `NextResponse` to satisfy the stricter `BodyInit` type constraints:

```typescript
const raw = await workbook.xlsx.writeBuffer()
const buf = raw instanceof ArrayBuffer
  ? raw
  : (raw as unknown as Uint8Array).buffer.slice(0) as ArrayBuffer
return new NextResponse(
  new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
  { headers: { 'Content-Disposition': `attachment; filename="results.xlsx"` } }
)
```

### Maps URLs
Google Places results link to `https://www.google.com/maps/place/?q=place_id:ChIJ...` — this opens an exact pinned marker rather than a coordinate blob.

---

## 🤝 Contributing

1. Fork the repo
2. `git checkout -b feat/your-feature`
3. Make your changes
4. `npm run build` — must pass with 0 TypeScript errors
5. Open a PR with a clear description of what changed and why

---

## 📜 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">
Built by <a href="https://github.com/prateeks0221-code">prateeks0221-code</a>
</div>
