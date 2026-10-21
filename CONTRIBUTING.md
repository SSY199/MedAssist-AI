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
`.env.example` omits `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`; the backend example is
empty. Refer to backend settings and README variable descriptions when configuring
them. The root example uses `medassist_db`, while the Python default is
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

There is currently no `npm test`, pytest configuration, or CI workflow. Do not
claim automated coverage exists. Add focused tests when changing substantive
behavior, with a minimal runner choice agreed as part of that work.

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
