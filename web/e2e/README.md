# End-to-end tests (Playwright)

Browser-level tests for the Next.js founder workbench and FastAPI backend. The default suite is **deterministic**: no Ollama, DeepSeek, Tavily, or other external model providers are required.

## What this covers

| Area | Covered | Deliberately skipped |
| --- | --- | --- |
| App boot + navigation | Smoke spec (`@core`) | — |
| API health in UI | Smoke spec | — |
| Isolated SQLite data | `.e2e-data/` wiped before each run | Developer `data/*.db` |
| API fixture helpers | `fixtures/*.ts` | — |
| Workspace creation + tabs + refresh | `workspace-create.spec.ts` (`@core`) | Paste-to-draft LLM path |
| Validation CRUD + checklist | `validation-crud.spec.ts` (`@extended`) | AI suggest/scan buttons |
| Worksheet versioning | `worksheet-versioning.spec.ts` (`@extended`) | Revise-from-evidence AI |
| Readiness gate + launch | `judges-readiness.spec.ts` (`@core`) | Real LLM pipeline |
| Stub judge runs + SSE run view | `run-view.spec.ts` (`@core`) | Real LLM pipeline |
| History + exports + settings | `history-settings.spec.ts` (`@extended`) | — |
| CI lint + build + E2E | `.github/workflows/ci.yml` | Real LLM on PRs |
| Optional real LLM smoke | `real-llm.spec.ts` (`@real-llm`) | Default / PR CI |

## Design decisions

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

Local default E2E uses **`next dev`** (fast feedback). CI uses **`next build && next start`** via `E2E_WEB_MODE=start` (build runs once in CI; `E2E_SKIP_BUILD=true` avoids a second build during E2E).

### CI tiers

| Trigger | `E2E_CI_TIER` | Tests run |
| --- | --- | --- |
| Pull request | `pr` | `@core` only (smoke, workspace, readiness, stub run view) |
| Push to `main` | `full` | All deterministic specs except `@real-llm` |
| Local default | `full` | Same as main |

CI job (`.github/workflows/ci.yml` → `web-e2e`): `npm ci`, `npm run lint`, `npm run build:e2e`, `npm run test:e2e`. Chromium only, one worker, two retries. Failed runs upload `playwright-report/` and `test-results/` artifacts.

Production E2E uses `npm run build:e2e` so `NEXT_PUBLIC_API_URL` matches the API port baked at compile time.

Simulate the PR tier locally:

```bash
E2E_CI_TIER=pr npm run test:e2e
# or
npm run test:e2e:core
```

### Fixture strategy

1. **Setup via API** when the behavior under test is not “user fills a form” (`seed-sample`, `createWorkspace`, `getReadiness`).
2. **Browser actions** for navigation and forms.
3. **Deterministic runs** via backend `E2E_TEST_MODE` stub pipeline (`E2E_TEST_MODE=true` in Playwright API env). `createStubRun` is safe in default CI.
4. **Cleanup**: full-suite reset by wiping `.e2e-data/` in global setup. No workspace delete API — per-test cleanup is not required for serial smoke/fixture specs.

### CI browser

Chromium only (`Desktop Chrome` project). Firefox/WebKit can be added after database isolation is proven under parallel workers.

## Prerequisites

1. Python venv at repo root with `pip install -r requirements.txt`
2. Node 18+ and `cd web && npm ci`
3. Playwright Chromium: `npx playwright install chromium`
4. **Stop** any dev servers on ports `3000` and `8000` — E2E starts fresh servers (`reuseExistingServer: false`).

   If a `next dev` lock blocks a second dev server, either stop the running dev process or use production mode:

   ```bash
   E2E_API_URL=http://127.0.0.1:8010 npm run build:e2e
   E2E_WEB_MODE=start E2E_WEB_PORT=3010 E2E_API_PORT=8010 E2E_SKIP_BUILD=true npm run test:e2e
   ```

   Override ports with `E2E_WEB_PORT` / `E2E_API_PORT` when defaults are busy.

## Run locally

```bash
cd web
npm run test:e2e
```

Other commands:

```bash
npm run test:e2e:core   # PR-tier subset (@core)
npm run test:e2e:ui     # Playwright UI mode
npm run test:e2e:headed # Headed Chromium
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
    build-e2e.mjs
    load-frontend-env.mjs
    reset-data.mjs
    start-web.mjs
    run-real-llm.mjs
    require-real-llm-prereqs.mjs
    fixtures/
      api.ts
      workspace.ts
      validation.ts
      worksheet.ts
      readiness.ts
      run.ts
      real-llm.ts
    specs/
      smoke.spec.ts
      fixtures-isolation.spec.ts
      workspace-create.spec.ts
      validation-crud.spec.ts
      worksheet-versioning.spec.ts
      judges-readiness.spec.ts
      run-view.spec.ts
      history-settings.spec.ts
      real-llm.spec.ts
```

## Optional real LLM tier

Not part of the default or PR CI suite. Requires Ollama with the configured `LOCAL_MODEL` (default `ollama:qwen3.5:9b`) **or** `DEEPSEEK_API_KEY`.

```bash
cd web
node e2e/require-real-llm-prereqs.mjs   # verify prerequisites first
npm run test:e2e:real-llm
# equivalent:
E2E_REAL_LLM=true npm run test:e2e -- --grep @real-llm
```

The spec skips with a clear message when prerequisites are missing. Nightly/manual CI: `.github/workflows/e2e-real-llm.yml` (`workflow_dispatch` or schedule). That workflow fails fast when neither Ollama nor `DEEPSEEK_API_KEY` is configured.
