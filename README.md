# MedAssistAI

A web-first, patient-centric AI health companion. One app that combines a personal health profile, an AI chatbot grounded in that profile, a nearby-care map, and (planned) medicine/lab ordering, medication reminders, wearable sync, and emergency SOS.

> **Not a medical device.** MedAssistAI provides general health information only. It does not diagnose, and nothing in it replaces a licensed clinician. The built-in knowledge base is **placeholder content**, not verified clinical literature. Do not put this in front of real patients as-is.

- **Repo:** https://github.com/SSY199/MedAssist-AI
- **Frontend deployment (Vercel):** https://med-assist-ai-kohl.vercel.app
- **Backend deployment:** not deployed yet (planned: Render). Anything that calls FastAPI (chat, map search) only works locally for now.

---

## Table of contents

- [MedAssistAI](#medassistai)
  - [Table of contents](#table-of-contents)
  - [Tech stack](#tech-stack)
  - [Current status](#current-status)
  - [Architecture](#architecture)
    - [Auth flow](#auth-flow)
    - [Chat flow (per message)](#chat-flow-per-message)
  - [Project structure](#project-structure)
  - [Getting started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [1. Clone](#1-clone)
    - [2. Google OAuth client](#2-google-oauth-client)
    - [3. Frontend](#3-frontend)
    - [4. Backend (separate terminal)](#4-backend-separate-terminal)
    - [5. VS Code (Python)](#5-vs-code-python)
  - [Environment variables](#environment-variables)
    - [Frontend (`.env` in the repo root)](#frontend-env-in-the-repo-root)
    - [Backend (`backend/.env`)](#backend-backendenv)
    - [Local vs production](#local-vs-production)
  - [API reference](#api-reference)
  - [Data model](#data-model)
  - [Conventions and gotchas](#conventions-and-gotchas)
  - [Known issues](#known-issues)
  - [Troubleshooting](#troubleshooting)
  - [Roadmap and where to help](#roadmap-and-where-to-help)
  - [Contributing](#contributing)
    - [Safety rules for this project](#safety-rules-for-this-project)
  - [License](#license)

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router, Turbopack), React 19, TypeScript |
| Styling | Tailwind CSS v4 (config lives in CSS, **no `tailwind.config.ts`**), shadcn/ui, lucide-react, react-icons |
| Auth | [Better-Auth](https://www.better-auth.com) with Google OAuth, MongoDB adapter, JWT plugin |
| Backend | FastAPI (Python 3.13), run with `uv` |
| Primary DB | MongoDB (Atlas) via Motor (async) on the backend, native driver in Next.js |
| Vector DB | ChromaDB, embedded and persisted to `backend/chroma_data` (no external service) |
| LLM | Google Gemini via the `google-genai` SDK (chat: `gemini-2.5-flash`, urgency classifier: `gemini-2.5-flash-lite`) |
| Embeddings | `gemini-embedding-001` |
| Maps | Mapbox GL JS (`react-map-gl`) on the frontend, Mapbox Search Box API on the backend |

---

## Current status

| Feature | Status | Notes |
|---|---|---|
| Landing page | Done | Dark "patient monitor" design system |
| Google sign-in | Done | Better-Auth, session in MongoDB |
| Route protection | Done | Two layers: `proxy.ts` (cookie check) and the `(dashboard)` layout (real session check) |
| Onboarding + profile (EHR) | Done | Age, gender, conditions, medications, allergies, past incidents, emergency contact |
| Dashboard home | Done | Reads the saved profile |
| Navbar | Done | SOS button is a visual placeholder |
| Map: nearby care | Done | Hospitals, pharmacies, clinics, labs, ER. **No ratings or open/closed status** (see gotchas) |
| FastAPI to Next.js auth bridge | Done | FastAPI verifies Better-Auth JWTs via JWKS |
| Chat: multi-conversation, history, resume | Implemented, needs verification | See [Known issues](#known-issues) |
| Chat: token streaming (SSE) | Implemented, needs verification | See [Known issues](#known-issues) |
| Chat: urgency scoring + Red Alert banner | Implemented, needs verification | Separate fast classifier call before streaming |
| Chat: RAG over ChromaDB | Working with **placeholder** KB | 6 self-written demo documents |
| Marketplace (medicines and lab tests) | Stub | "Coming soon" page |
| Medication reminders | Stub | Needs worker + Twilio/WhatsApp |
| Wearable sync | Stub | Needs Terra API OAuth + webhooks |
| Emergency SOS | Placeholder button | No geolocation, routing, or alerting yet |
| Lab report summarizer (PDF/image) | Not started | |
| "Export profile for doctor" PDF | Not started | |

---

## Architecture

```
┌────────────────────────────┐        ┌─────────────────────────────┐
│  Next.js (Vercel / :3000)  │        │  FastAPI (:8000)            │
│                            │        │                             │
│  UI + Better-Auth          │  JWT   │  /chat   /map   /ehr        │
│  Server Actions ──► Mongo  │ ─────► │  verifies JWT via JWKS      │
│  /api/auth/*  (JWKS here)  │ ◄───── │  fetches /api/auth/jwks     │
└─────────────┬──────────────┘        └───────┬─────────┬───────────┘
              │                               │         │
              ▼                               ▼         ▼
         MongoDB Atlas  ◄──────────────────────┘     ChromaDB (local)
   user, session, account, jwks,                     + Gemini API
   patientProfiles, conversations, messages          + Mapbox API
```

### Auth flow

1. User clicks "Continue with Google" on `/login`. Better-Auth handles OAuth and writes `user`, `session`, `account` to MongoDB.
2. The callback lands on `/post-login`, which checks for a `patientProfiles` document. **No profile** sends the user to `/onboarding`. **Profile exists** sends them to `/dashboard` (or the originally requested page).
3. For backend calls, the browser asks Better-Auth for a short-lived **JWT** (`/api/auth/token`) and sends it as `Authorization: Bearer <jwt>` via `lib/api-client.ts`.
4. FastAPI verifies the JWT against Better-Auth's public keys (`/api/auth/jwks`), so **no secret is shared between the two services**. The user id is `user["sub"]`.

### Chat flow (per message)

1. Save the user message to `messages` immediately.
2. Auto-title the conversation from the first message.
3. Load the last 20 messages as context and the user's `patientProfiles` document.
4. **Classify urgency (1-5)** with a fast non-streaming call. If **4 or 5**, emit an `urgent` event and stop. The UI pauses chat and shows the Red Alert banner linking to `/map`.
5. Otherwise retrieve the top 3 chunks from ChromaDB, build the system prompt (patient context + retrieved context), and **stream** the reply token by token as Server-Sent Events.
6. Save the full assistant reply when the stream finishes.

Urgency is classified in a separate call because partial JSON can't be streamed. The tradeoff is **two Gemini calls per message**.

SSE event types: `chunk` (`{text}`), `urgent` (`{urgencyScore}`), `error` (`{message}`), `done`.

---

## Project structure

```
medassist-ai/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── post-login/page.tsx   # routes new vs returning users
│   ├── (dashboard)/              # protected; layout verifies session + renders Navbar
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── chat/
│   │   │   ├── layout.tsx        # conversation sidebar
│   │   │   ├── page.tsx          # empty state
│   │   │   └── [conversationId]/page.tsx
│   │   ├── map/page.tsx
│   │   ├── marketplace/page.tsx  # stub
│   │   ├── reminders/page.tsx    # stub
│   │   └── wearables/page.tsx    # stub
│   ├── onboarding/page.tsx
│   ├── api/auth/[...all]/route.ts   # Better-Auth handler
│   ├── globals.css               # Tailwind v4 + design tokens
│   ├── layout.tsx
│   └── page.tsx                  # landing page
├── components/
│   ├── Navbar.tsx  SignOutButton.tsx  EhrForm.tsx
│   ├── ChatWindow.tsx  ChatSidebar.tsx  HealthMap.tsx
│   ├── BackendTest.tsx           # debug helper for the JWT bridge
│   └── ui/                       # shadcn components
├── lib/
│   ├── auth.ts                   # Better-Auth server config (+ exports `db`)
│   ├── auth-client.ts            # client hooks, signInWithGoogle
│   ├── api-client.ts             # apiFetch / apiFetchStream (attach JWT)
│   └── profile-actions.ts        # server actions: saveProfile, getMyProfile
├── proxy.ts                      # route protection (named middleware.ts before Next.js 16)
└── backend/
    ├── app/
    │   ├── main.py               # FastAPI app, CORS, router registration
    │   ├── core/
    │   │   ├── config.py         # pydantic-settings, reads backend/.env
    │   │   ├── db.py             # Motor client
    │   │   ├── security.py       # get_current_user (JWT via JWKS)
    │   │   ├── gemini_client.py  # embeddings, urgency classifier, streaming
    │   │   └── vector_store.py   # ChromaDB + Gemini embedding function
    │   └── routers/
    │       ├── ehr.py  map.py  chat.py
    ├── ingestion/
    │   ├── load_medical_kb.py    # seeds ChromaDB (run once)
    │   ├── list_models.py        # lists Gemini models your key can use
    │   └── inspect_types.py      # prints accepted SDK config fields
    ├── requirements.txt
    └── .env.example
```

---

## Getting started

### Prerequisites

- Node.js 20+ and npm
- Python 3.13 and [`uv`](https://docs.astral.sh/uv/)
- A MongoDB Atlas cluster (free tier is fine)
- A Google Cloud project with an **OAuth 2.0 Web client** (for sign-in)
- A [Mapbox](https://www.mapbox.com) access token
- A Gemini API key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)

### 1. Clone

```bash
git clone https://github.com/SSY199/MedAssist-AI.git
cd MedAssist-AI
```

### 2. Google OAuth client

In Google Cloud Console, go to **APIs & Services, then Credentials, then Create credentials, then OAuth client ID, then Web application**, and add:

- Authorised JavaScript origin: `http://localhost:3000`
- Authorised redirect URI: `http://localhost:3000/api/auth/callback/google`

Copy the client ID and secret into your frontend `.env`.

### 3. Frontend

```bash
npm install
cp .env.example .env      # then fill in values (see below)
npm run dev               # http://localhost:3000
```

### 4. Backend (separate terminal)

```bash
cd backend
uv venv
uv pip install -r requirements.txt
cp .env.example .env      # then fill in values (see below)

# one-time: embed the placeholder knowledge base into ChromaDB
uv run python -m ingestion.load_medical_kb

uv run uvicorn app.main:app --reload --port 8000
```

Check it's alive: http://localhost:8000/health returns `{"status":"ok"}`. Interactive API docs are at http://localhost:8000/docs.

### 5. VS Code (Python)

Select the interpreter at `backend/.venv/Scripts/python.exe` (Windows) or `backend/.venv/bin/python` (macOS/Linux). Without this, Pylance will flag every import as unresolved.

---

## Environment variables

> **Never commit `.env` files.** Each contributor creates their own keys. Don't paste keys into issues, PRs, or chat.

### Frontend (`.env` in the repo root)

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_SECRET` | Session signing secret. Generate with `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | `http://localhost:3000` locally |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From your OAuth client |
| `MONGODB_URI` | Atlas connection string |
| `MONGODB_DB_NAME` | Defaults to `medassistai` |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:8000` locally |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Public Mapbox token |

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `BETTER_AUTH_URL` | Where the Next.js app runs (used to fetch JWKS). `http://localhost:3000` locally |
| `MONGODB_URI` / `MONGODB_DB_NAME` | **Must match the frontend values** (same database) |
| `MAPBOX_ACCESS_TOKEN` | Used by `/map/nearby` |
| `GEMINI_API_KEY` | Used for chat, urgency classification, embeddings |
| `CHROMA_DB_PATH` | Defaults to `./chroma_data` |

### Local vs production

`.env` always describes **where you are running right now**. A previous bug came from `NEXT_PUBLIC_APP_URL` pointing at the production Vercel URL while developing on `localhost`, which broke every auth fetch. Production values belong in the **Vercel dashboard**, not in your local `.env`.

Anything prefixed `NEXT_PUBLIC_` is shipped to the browser. Never put a secret behind that prefix.

---

## API reference

All routes except `/health` require `Authorization: Bearer <Better-Auth JWT>`.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/ehr/me` | Returns the caller's user id and email (used to verify the auth bridge) |
| GET | `/map/nearby?lat=&lng=&category=` | `category` is one of `hospital`, `pharmacy`, `clinic`, `lab`, `er` |
| GET | `/chat/conversations` | List the caller's conversations, newest first |
| POST | `/chat/conversations` | Create a conversation |
| DELETE | `/chat/conversations/{id}` | Delete a conversation and its messages |
| GET | `/chat/conversations/{id}/messages` | Full message history (this is "resume chat") |
| POST | `/chat/conversations/{id}/message` | Send a message. Responds with `text/event-stream` |

---

## Data model

MongoDB database `medassistai`.

**Managed by Better-Auth** (don't hand-edit): `user`, `session`, `account`, `verification`, `jwks`.

**`patientProfiles`** (one per user, upserted by the `saveProfile` server action)

```
userId, age, gender, chronicIllnesses[], pastMedicalIncidents,
currentMedications[], allergies[], emergencyContactName,
emergencyContactPhone, createdAt, updatedAt
```

**`conversations`**: `userId, title, createdAt, updatedAt`

**`messages`**: `conversationId, userId, role ("user" | "assistant"), content, urgencyScore, createdAt`

Keep app data in its own collections keyed by the Better-Auth user id. Don't extend Better-Auth's `user` document.

---

## Conventions and gotchas

- **Motor collection access:** use `db["patientProfiles"]`, **not** `db.collection("patientProfiles")`. The `.collection()` form is the Node.js driver; Motor doesn't have it.
- **Gemini role names:** past assistant turns are sent as role `"model"`, not `"assistant"`. The router maps this.
- **Model names go stale.** If a Gemini call 404s, run `uv run python -m ingestion.list_models` and use a name from that list.
- **Embedding model consistency:** whatever model seeds ChromaDB must also embed queries. If you change `EMBEDDING_MODEL`, delete `backend/chroma_data` and re-run the ingestion script.
- **Mapbox gives no ratings or live hours.** The API returns `rating: null` and `openNow: null` and the UI hides those badges. **Never fabricate these values.** A wrong "Open now" on a pharmacy in an emergency is a real harm, not a cosmetic bug.
- **Profile writes happen in Next.js** (`lib/profile-actions.ts`, a Server Action writing straight to MongoDB). FastAPI only reads `patientProfiles` (for chat context).
- **Tailwind v4:** design tokens are CSS variables in `app/globals.css` (`--nirog-*` mapped through `@theme inline`). Utility classes like `bg-bg`, `text-trace`, `border-panel-border`, `font-display` come from there. The `nirog` prefix is a leftover from an earlier working name. It's internal only, and renaming it is a fine first PR.
- **Two layers of route protection** are intentional. `proxy.ts` only checks that a session cookie exists (cheap, edge-safe). The `(dashboard)` layout calls `auth.api.getSession` for real. When you add a protected route, add it to the matcher in `proxy.ts` and put it under `(dashboard)`.
- **Windows:** use PowerShell-friendly commands (`Remove-Item -Recurse -Force .next`).

---

## Known issues

1. **Gemini SDK config parameters (chat may not work yet).** Pylance reports `No parameter named "response_mime_type"` and `No parameter named "system_instruction"` on `types.GenerateContentConfig(...)` in `backend/app/core/gemini_client.py`. That means the installed `google-genai` version doesn't accept those names the way the code assumes, so urgency classification and streaming can fail at runtime. To investigate:
   ```bash
   cd backend
   uv run python -m ingestion.inspect_types
   ```
   This prints the field names your installed version really accepts. Fix the two calls to match. Also verify `client.aio.models.generate_content_stream` against the current SDK docs.
2. **`embed_text` null safety.** `result.embeddings[0].values` assumes the response always contains embeddings. A defensive check with a clear error would be better.
3. **Urgency classifier fails safe to 2 ("mild").** If the model returns unparseable output, a genuinely urgent message could be scored low. This is a known tradeoff, and it's worth revisiting before any real use.
4. **Placeholder knowledge base.** `load_medical_kb.py` holds six short, self-written demo documents. Real clinical sources must be sourced and licensed before real use.
5. **Pylance false positive:** `Arguments missing for parameters "MONGODB_URI", ...` on `settings = Settings()` in `config.py`. This is safe to ignore. Pylance doesn't know `BaseSettings` reads environment variables at runtime.
6. **Chat is stateless across the classifier.** Only the last 20 messages are sent as context. There is no long-term memory yet.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| A route that clearly exists returns 404 (e.g. `/login`) | Stale Next.js cache after adding layouts or dynamic routes. Stop the dev server, delete `.next`, restart |
| `Failed to fetch` on every auth call | `NEXT_PUBLIC_APP_URL` doesn't match the origin in your address bar (`localhost` vs LAN IP vs production URL) |
| `redirect_uri_mismatch` from Google | Redirect URI in Cloud Console must be exactly `http://localhost:3000/api/auth/callback/google` |
| Backend returns 401 | Token invalid or `BETTER_AUTH_URL` in `backend/.env` is wrong (FastAPI can't reach `/api/auth/jwks`) |
| Browser blocks backend calls (CORS) | Your frontend origin must be in the `origins` list in `backend/app/main.py` |
| Gemini `404 NOT_FOUND` for a model | Model name is stale. Run `ingestion.list_models` |
| Chat replies always empty or `error` event | See [Known issues](#known-issues) #1 |
| Map shows "No results found nearby" | Check the FastAPI terminal for the Mapbox error (bad token or no results for that category) |
| `.env` change not picked up | Restart the relevant dev server. `NEXT_PUBLIC_*` values are baked in at startup |
| Pylance flags imports as unresolved | Wrong interpreter. Select `backend/.venv` |

---

## Roadmap and where to help

Good places for contributors to jump in, roughly easiest first:

**Small / well-scoped**
- Rename the internal `--nirog-*` CSS variables to something neutral
- Render assistant replies as Markdown in `ChatWindow`
- Chat polish: rename a conversation, "stop generating", copy message, empty/error states
- Replace the SOS `alert()` placeholder with a proper confirmation dialog
- Make `embed_text` null-safe; add tests for the SSE parser and `classify_urgency` fallback
- Mobile layout for the chat sidebar and the dashboard Navbar

**Medium**
- **Marketplace** UI: medicine and lab-test search with a price/speed comparison (needs a data source first, so design the `Facility`-style response type up front and use mock data)
- **Medication reminders:** schedule model, worker, and WhatsApp/SMS via Twilio
- **"Export profile for doctor"** PDF
- **Emergency SOS:** geolocation, EHR snippet, nearest ER routing, emergency-contact alerts
- Route plotting and travel time on the map (Mapbox Directions)

**Larger / architectural**
- **Hybrid RAG pipeline:** PDF upload, loader, chunker, embedder, FAISS + BM25 with Reciprocal Rank Fusion
- **Lab report summarizer:** upload a PDF/image, extract text, plain-language summary with abnormal values highlighted
- **LangGraph** for tool calling and MCP support (the chat orchestration is currently hand-written on the raw Gemini SDK; this is the point where a framework starts to pay off)
- **Observability:** LangSmith tracing
- **Redis** (e.g. Upstash): short-term chat memory cache, rate limiting on `/chat`, background job queue for reminders, pub/sub for streaming across workers
- **Wearables:** Terra API OAuth and webhook ingestion
- Long-term memory for the assistant
- Deploy FastAPI (Render or similar) and tighten CORS and key restrictions for production

---

## Contributing

1. Create a branch from `main`: `git checkout -b feat/short-description`
2. Keep PRs small and focused on one feature or fix.
3. Run `npm run lint` before pushing. For backend changes, run the server and hit the endpoint you touched through `/docs`.
4. Describe in the PR what you tested and what you could **not** test (for example, "needs a real Gemini key").
5. Never commit secrets, `.env` files, `backend/.venv`, or `backend/chroma_data`. Make sure `.gitignore` covers them.
6. If you touch anything health-related (urgency logic, prompts, disclaimers, the knowledge base), call it out explicitly in the PR so it gets a careful review.

### Safety rules for this project

- No fabricated medical data in the UI (ratings, hours, dosages, "open now"). If the source doesn't provide it, show nothing.
- Keep the non-diagnostic disclaimer visible in the chat UI.
- Don't weaken the urgency Red Alert behavior without discussing it first.

---

## License

TBD. Add a license before accepting outside contributions.