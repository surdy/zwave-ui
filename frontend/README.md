# Z-Wave UI — frontend

The new Vue 3 + Vite + TypeScript frontend for [Z-Wave UI](../README.md). It
talks to the existing zwave-js-ui backend over socket.io + REST.

## Prerequisites

- Node.js 20.19+ (22 recommended)
- A running zwave-js-ui backend to develop against. The easiest is a **local
  mock-stick backend** — see
  [docs/05-implementation/agent-guide.md](../docs/05-implementation/agent-guide.md).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server on **:8092** (proxies `/socket.io`, `/api`, `/health`, `/version` to the backend). |
| `npm run build` | Type-check and build static assets to `dist/`. |
| `npm run preview` | Serve the production build locally on :8092. |
| `npm run type-check` | Run `vue-tsc` type checking. |
| `npm run lint` / `npm run lint:fix` | Lint (and auto-fix) with ESLint. |
| `npm run format` | Format `src/` with Prettier. |
| `npm run test` / `npm run test:watch` | Run unit tests with Vitest. |
| `npm run test:e2e` | Boot a local mock-stick backend + run the Playwright integration smoke test. |

## Backend proxy target

The dev proxy points at `http://localhost:8091` by default. Override it:

```bash
VITE_BACKEND=http://localhost:8091 npm run dev
```

> You may point it at a remote instance for **read-only** visual comparison, but
> never trigger mutating actions against a production controller.

## Integration smoke test

A thin end-to-end smoke test (Playwright) proves the whole stack works against a
local **mock-stick** backend: the app loads, the realtime socket connects, the
shell/nav renders, the mock device is listed, the theme toggle applies, and
nothing throws.

```bash
npm run test:e2e
```

This single command (`scripts/e2e.mjs`):

1. Locates an upstream `zwave-js-ui` checkout — adjacent to this repo by default,
   or set `ZWAVE_JS_UI_DIR=/path/to/zwave-js-ui` (run `npm ci` in it once).
2. Starts the fake controller (`fake-stick`, `tcp://127.0.0.1:5555`) and the
   backend server (`:8091`) — **or reuses them if already running** — writing a
   throwaway `store/settings.json` (restored on exit).
3. Builds the frontend and serves it with `vite preview` on `:8092`, then runs
   the Playwright suite in `e2e/`.

It only ever talks to the local mock backend — never a live instance. To run
just the browser test against an already-served frontend + backend, use
`npm run test:e2e:pw`.

It also runs in CI on every PR and on `main` (`.github/workflows/e2e.yml`),
where it checks out and installs the pinned upstream backend automatically.

## Structure

```
src/
├── api/         # socket.io client + ZWAVE_API wrapper + REST (issue #3)
├── stores/      # Pinia stores: nodes, controller, ui (issue #3)
├── components/  # design-system + feature components (issue #4+)
├── views/       # routed screens
├── router/      # Vue Router
└── styles/      # design tokens + base CSS
```

See [docs/05-implementation/](../docs/05-implementation/) for the architecture,
backend API contract, and contributor guide.
