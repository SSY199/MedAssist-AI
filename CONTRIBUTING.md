# Contributor workflow

Start with [AGENTS.md](AGENTS.md) and [project context](docs/PROJECT_CONTEXT.md).
The README remains the original setup guide; the context review documents drift.

## Git collaboration

1. Run `git status --short --branch` and inspect the current diff before editing.
   Preserve unrelated changes; do not stash or reset another contributor's work.
2. For a new task, use a focused branch such as `codex/chat-stream-fix` from the
   agreed base. Do not switch branches with unrelated uncommitted work.
3. Keep one concern per change. Coordinate before editing shared files such as
   auth, chat contracts, package manifests, lockfiles, and global styles.
4. Before integration, fetch and inspect the current target branch and agree on
   merge/rebase strategy. Resolve overlapping edits deliberately and rerun the
   affected checks. Do not automatically rebase shared history or force-push.
5. Review `git diff --check`, the file list, and the complete diff before committing.
   Stage explicit paths. Check new files for secrets, generated data, and real PHI.

Separate branches cannot guarantee conflict-free merges. Small diffs and
coordination reduce risk. Never merge or deploy merely to finish local setup.

## Local environment

Frontend: use the committed npm lockfile (`npm ci`), then `npm run dev` from the
repo root. This review does not install dependencies or configure credentials.
Read the relevant Next.js guides in `node_modules/next/dist/docs/` before coding.
Use the versions and engine constraints in the installed packages/lockfile.

Backend: from `backend/`, use `uv venv --python 3.13`, then
`uv pip install -r requirements.txt`. Start with
`uv run uvicorn app.main:app --reload --port 8000` after configuring settings.
Python dependencies are currently unpinned; no reproducible lock is provided.

Create local environment files without overwriting existing ones. The root
`.env.example` omits `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`; the backend example also
contains frontend-only fields. Refer to backend settings and README variable
descriptions when configuring them. The root example uses `medassist_db`, while the Python default is
`medassistai`: set `MONGODB_DB_NAME` identically in both services. Use your own
credentials; never copy real keys into documentation or chat.

Do not run ingestion as a routine setup check: it sends seed text for embedding
and writes the persistent Chroma collection. Agree on the target store first.

## Validation matrix

| Change | Checks |
| --- | --- |
| Documentation only | Diff/whitespace review, relative link checks, confirm no application/config/data changes |
| Frontend | `npm run lint`; `npx --no-install tsc --noEmit --incremental false`; `npm run build`; manually exercise the affected UI |
| Python | Parse changed source with `ast.parse`; exercise affected routes with synthetic data and configured services; add focused behavioral tests for logic changes |
| Auth/profile/chat contract | Check sign-in, onboarding/save/edit, token bridge, ownership isolation, history/resume, SSE, and urgent UI behavior as affected |
| Health prompts/retrieval/urgency | Review evidence provenance, missing evidence, uncertainty, escalation and provider failures; agree expected cases before implementation |

There is no `npm test`, pytest configuration, or CI workflow. SOS has focused
standard-library tests: from `backend/`, run
`PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m unittest discover -s tests -v`;
from the root on Node 22, run
`node --experimental-strip-types --test tests/*.test.mjs`. These mock external
services and do not cover the whole app. Add focused tests for substantive logic
changes without bundling a testing-infrastructure project.

For a backend syntax check without imports, writes, or network calls, run from
the repo root:

```bash
python3 - <<'PY'
import ast
from pathlib import Path
files = sorted(Path("backend/app").rglob("*.py"))
files += sorted(Path("backend/ingestion").rglob("*.py"))
for path in files:
    ast.parse(path.read_text(), filename=str(path))
print(f"Parsed {len(files)} Python files")
PY
```

`/health` reports liveness, not MongoDB/Gemini/Mapbox readiness. Runtime imports
initialize Chroma and require settings. Builds can also require environment
configuration and network access for `next/font/google`. Record these limitations
instead of inserting dummy secrets or weakening checks to obtain a green result.

## Handoff

Describe the problem and resulting behavior, changed interfaces, checks actually
run, and any pre-existing failures. Call out changes to health-related prompts,
knowledge sources, and urgency behavior explicitly. Update project context when
status changes; keep future ideas separate from implemented behavior.

## Local medication reminder worker

See [the reminder feature record](docs/features/REMINDERS.md) for timing, privacy,
limits and validation. Start the existing Next.js and FastAPI services as usual,
then use a separate terminal from `backend/`:

```bash
PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m app.workers.reminders
```

The worker creates indexes only in the new reminder collections and persists a
heartbeat. Keep the laptop awake and the process/network running. Closing the
website tab does not stop the worker; closing/suspending the laptop does. The
Reminders page reports recent worker activity. Stop this terminal with Ctrl+C.
Do not start workers against another person's database for a demonstration.

Generic email uses the existing server-only Gmail app-password sender. Configure
`REMINDERS_EMAIL_ENABLED=true` in ignored `backend/.env`, and restart both backend
and worker after changes. The template defaults to false. A schedule must separately
opt in to generic mail to the signed-in user's verified account. No medication
names/instructions appear in the email. SMTP accepted is not delivered/read.
Use a clearly labelled synthetic schedule for demonstrations, only with an agreed
test recipient; no profile or actual medication edits are needed.

## Disease awareness content and local checks

The signed-in dashboard renders its public educational bundle from
`backend/app/data/awareness.json`; FastAPI validates the same file. See
[the awareness delivery record](docs/features/DISEASE_AWARENESS.md) for provenance,
source/translation limits, content expiry and validation. No additional worker,
package or environment variable is needed for awareness. Run existing Next/FastAPI
services; Mongo is required for saved progress, and the configured Gemini account
is used only for explicit prepared explanations.

Keep source IDs, claim mappings and both languages aligned. Recheck source dates,
applicability and reuse before editing; changing a fetch date does not renew review.
Never use the placeholder Chroma texts as verified awareness sources. A content
version change deliberately starts new learning progress. Account reset affects
only `awarenessProgress`, while hashed `awarenessUsage` quotas stay in effect.
The current counter collection has no scheduled retention cleanup.

Weekly outbreak documents are read through an authenticated Next route and a
pinned PDF.js reader. Node 22.13+ (or 24+) is required by the PDF package; local
validation used 22.17.1. Original reports remain English. The archive loader reads
only NCDC's fixed root/year directories and accepts matching year/week PDF names.
Listings use a bounded per-process one-hour cache; cold starts may fetch again.
Source outages use a labelled stale listing or reviewed seed fallback where available.
Only the selected PDF is downloaded. `weeklyReports` now supplies reviewed metadata
and outage fallback; extend it only after checking original dates/page counts and
official URLs. Newly discovered reports have no inferred reporting dates or review.
Do not turn
the byte endpoint into an arbitrary URL proxy, forward user cookies upstream,
or remove its PDF/size/redirect checks. No extra Python dependency is required.

Run the existing Python unittest and Node helper commands above; awareness tests
mock provider/DB effects and use synthetic accounts. Live prepared AI requests
must contain public authored evidence only, with no profile/history/free text.
