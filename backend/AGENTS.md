# Backend agent guide

Inherits the root AGENTS.md. Read this before modifying backend code.

## Execution and persistence

- Run backend commands from `backend/`: settings load `.env` relative to the
  working directory, and Chroma defaults to `./chroma_data`.
- Python 3.13 is documented by the project. Use an isolated `.venv` and uv;
  requirements.txt is currently unpinned. Do not introduce dependency upgrades
  or a new orchestration framework as incidental cleanup.
- Required settings are `MONGODB_URI`, `MAPBOX_ACCESS_TOKEN`, and `GEMINI_API_KEY`.
  Defaults: `BETTER_AUTH_URL=http://localhost:3000`,
  `MONGODB_DB_NAME=medassistai`, `CHROMA_DB_PATH=./chroma_data`.
  Match the frontend database explicitly; its example uses a different name.
- Check `backend/.env.example` against settings: it includes frontend-only fields
  that FastAPI does not consume. Never copy real credentials into the template.
- Importing main.py loads settings, DB/SDK clients, and the Chroma collection.
  Even `/health` therefore requires application initialization. Use AST parsing
  for a service-free syntax check; it does not prove imports or runtime behavior.
- Chroma data and Python bytecode are already tracked in the baseline. Do not
  change or remove them incidentally; cleanup requires its own scoped change.

## Interfaces

- Routers registered in app/main.py: ehr.py, map.py, chat.py, sos.py. mapbox_map.py is
  not registered. Preserve the active import path when fixing maps.
- Protected routes use `Depends(get_current_user)`. User identity comes from the
  verified JWT `sub`; conversation access uses `_get_owned_conversation`.
- Use Motor access `db["collection"]` and await database operations. Node's
  `db.collection(...)` syntax belongs only to the frontend server code.
- Preserve conversation IDs, message roles, and SSE payload compatibility with
  ChatWindow. Gemini history roles are `user` and `model`.
- Current chat uses the last 20 messages, selected profile fields, urgency
  classification, top-three Chroma retrieval, and streamed Gemini generation.
  This is not a LangGraph implementation or a verified multi-agent workflow.
- Classifier and embedding calls are synchronous inside the async chat path.
  Malformed classifier output falls back to 2; provider exceptions propagate
  before the generation-only error handler. Do not describe this as fail-safe.
- Keep ingestion/query embedding models compatible. Rebuilding stored vectors
  is a separate data operation, never an automatic fix during testing.

## Verification

Use the root contributor guide. Future chat changes should exercise ownership
isolation, split SSE frames, urgent termination, malformed/out-of-range classifier
output, provider failures, and message persistence with synthetic data. Tests
should mock external providers by default; live checks need configured services.
Report any changed health prompts, knowledge sources, or escalation behavior.

## SOS boundary

- `sos.py` uses verified JWT identity, a per-user Mongo `_id` claim, and only the
  latest incident metadata; the full health message is not stored or logged.
- `services/sos_email.py` owns verified-TLS Gmail SMTP. Optional server-only
  settings are `SOS_GMAIL_ADDRESS` and `SOS_GMAIL_APP_PASSWORD`.
- Accepted SMTP submission does not confirm delivery/read status. Keep ambiguous
  outcomes non-retryable and retain cooldown/attempt limits for explicit retries.
- Run `PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -v`
  from backend for the synthetic SOS suite; SMTP and Mongo are mocked.
