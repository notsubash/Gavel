# End-to-end tests (Playwright)

Browser-level tests for the Next.js founder workbench and FastAPI backend. The default suite is **deterministic**: no Ollama, DeepSeek, Tavily, or other external model providers are required.

## What this covers (Phases 0–2)

| Area | Covered | Deliberately skipped |
| --- | --- | --- |
| App boot + navigation | Smoke spec | — |
| API health in UI | Smoke spec | — |
| Isolated SQLite data | `.e2e-data/` wiped before each run | Developer `data/*.db` |
| API fixture helpers | `fixtures/*.ts` | — |
| Workspace creation UI | Phase 3 | — |
| Stub judge runs + SSE | Phase 6 (`E2E_TEST_MODE`) | Real LLM pipeline |

## Phase 0 decisions (locked)

### Database path environment variables

| Variable | Purpose | Default (non-E2E) |
| --- | --- | --- |
| `RUNS_DB_PATH` | Judge run persistence | `data/runs.db` |
| `WORKSPACES_DB_PATH` | Workspaces + validation data | `data/workspaces.db` |
| `IDEAS_DB_PATH` | Semantic memory store | `data/ideas.db` |

E2E points all three at `../.e2e-data/*.db` (repo root). `e2e/reset-data.mjs` wipes that folder immediately before the API server starts.

### Pinned `NEXT_PUBLIC_*` flags

Set in `web/.env.e2e` and passed to the Next dev server:

- `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`
- `NEXT_PUBLIC_UI_SHELL_V2=true`
- `NEXT_PUBLIC_CONFIDENCE_ENGINE=true`
- `NEXT_PUBLIC_WORKSPACE_HISTORY=true`
- `NEXT_PUBLIC_EXPERIMENT_ENTITY=true`
- `NEXT_PUBLIC_JUDGE_IDENTITY=true`

### Server mode

Local default E2E uses **`next dev`** (fast feedback). CI can switch to `next build && next start` in Phase 9 without changing specs.

### Fixture strategy

1. **Setup via API** when the behavior under test is not “user fills a form” (`seed-sample`, `createWorkspace`, `getReadiness`).
2. **Browser actions** for navigation and forms (smoke spec today; workspace CRUD in Phase 3+).
3. **Deterministic runs** via backend `E2E_TEST_MODE` stub pipeline (Phase 6). `createStubRun` exists but must not be used in default CI until the stub ships.
4. **Cleanup**: full-suite reset by wiping `.e2e-data/` in global setup. No workspace delete API — per-test cleanup is not required for serial smoke/fixture specs.

### CI browser (phase one)

Chromium only (`Desktop Chrome` project). Firefox/WebKit can be added after database isolation is proven under parallel workers.

## Prerequisites

1. Python venv at repo root with `pip install -r requirements.txt`
2. Node 18+ and `cd web && npm ci`
3. Playwright Chromium: `npx playwright install chromium`
4. **Stop** any dev servers on ports `3000` and `8000` — E2E starts fresh servers (`reuseExistingServer: false`).

   If a `next dev` lock blocks a second dev server, either stop the running dev process or use production mode:

   ```bash
   npm run build
   E2E_WEB_MODE=start E2E_WEB_PORT=3010 E2E_API_PORT=8010 npm run test:e2e
   ```

   Override ports with `E2E_WEB_PORT` / `E2E_API_PORT` when defaults are busy.

## Run locally

```bash
cd web
npm run test:e2e
```

Other commands:

```bash
npm run test:e2e:ui      # Playwright UI mode
npm run test:e2e:headed  # Headed Chromium
npx playwright show-trace playwright-report/trace.zip  # after a retry failure
```

HTML report: `web/playwright-report/index.html`

## File layout

```text
web/
  playwright.config.ts
  .env.e2e
  e2e/
    README.md
    env.ts
    load-frontend-env.mjs
    reset-data.mjs
    start-web.mjs
    fixtures/
      api.ts
      workspace.ts
      run.ts
    specs/
      smoke.spec.ts
      fixtures-isolation.spec.ts
```

## Optional real LLM tier (Phase 10)

Not part of the default suite:

```bash
E2E_REAL_LLM=true npm run test:e2e -- --grep @real-llm
```
