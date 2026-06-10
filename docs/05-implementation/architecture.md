# Architecture

This document describes how **Z-Wave UI** (this project) is built and how it
relates to the upstream [zwave-js-ui](https://github.com/zwave-js/zwave-js-ui)
project.

## Core principle: reuse the backend, replace the frontend

Z-Wave UI is **not** a fork of the whole zwave-js-ui application. It is a new
frontend that talks to the **existing, unchanged** zwave-js-ui backend over the
same socket.io + REST API that the original frontend uses.

```
┌──────────────────────────────────────┐
│  Z-Wave UI  (this repo, frontend/)    │   Vue 3 + Vite + TypeScript
│  - Pinia stores                        │   Pinia + Vue Router 4
│  - custom CSS design system            │   socket.io-client
│  - served as static assets             │
└───────────────┬──────────────────────┘
                │  socket.io  (realtime + ZWAVE_API)
                │  REST       (/api/* — auth, store, etc.)
┌───────────────▼──────────────────────┐
│  zwave-js-ui backend  (reused as-is)  │   Node + Express + socket.io
│  ZwaveClient · Gateway · MQTT · HA     │   (the official image)
└───────────────┬──────────────────────┘
                │  @zwave-js/server / Serial
┌───────────────▼──────────────────────┐
│        Z-Wave controller / stick      │
└──────────────────────────────────────┘
```

### Why this approach

- **Full feature parity is achievable**: every capability is already exposed by
  the backend API. We re-present it, we don't re-implement it.
- **Drop-in replacement**: the container image is the official zwave-js-ui image
  with our static frontend overlaid on top of its `dist/` directory. All Z-Wave,
  MQTT, Home Assistant, store, and backup behavior is preserved.
- **Lower risk**: no changes to the battle-tested Z-Wave logic.

## Tech stack (frontend)

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | **Vue 3** (`<script setup>`, Composition API) | aligns with upstream patterns |
| Build | **Vite** | fast dev server + static build |
| Language | **TypeScript** | typed API layer + stores |
| State | **Pinia** | reactive stores for nodes/values/controller |
| Routing | **Vue Router 4** | history mode |
| Realtime | **socket.io-client** | matches backend socket version |
| Styling | **Custom CSS design system** | tokens from `docs/03-ux-design/design-system.md`; no component framework |
| Icons | lightweight SVG icon set | tree-shakeable |
| Charts | lazy-loaded (e.g. `vis-network`, a charts lib) | only on Network/diagnostics screens |

> We intentionally **do not** use Vuetify. The whole point of the rework is a
> bespoke, lean, modern design system. Port the tokens and the working CSS/JS
> from `docs/04-mockups/assets/`.

## How the container is produced

Multi-stage build (see [`docker/`](../../docker/) and the issue for the
container image):

1. **Stage 1 — build frontend**: `node` image, `npm ci`, `npm run build` in
   `frontend/` → produces static assets in `frontend/dist`.
2. **Stage 2 — overlay**: `FROM zwavejs/zwave-js-ui:<pinned-version>`; copy our
   `frontend/dist` into the location the backend serves static files from
   (`/usr/src/app/dist`).

The result is a single image that runs exactly like zwave-js-ui (same env vars,
same volumes, same ports) but serves our UI. Because Docker is not always
available locally, the image is built and published by CI
(GitHub Actions → GHCR: `ghcr.io/surdy/zwave-ui`).

## Repository layout

```
zwave-ui/
├── frontend/            # Vue 3 app (created by the scaffold issue)
│   ├── src/
│   │   ├── api/         # socket.io client + ZWAVE_API wrapper + REST
│   │   ├── stores/      # Pinia: nodes, controller, ui (theme/advanced mode)
│   │   ├── components/  # design-system + feature components
│   │   ├── views/       # routed screens
│   │   ├── router/
│   │   └── styles/      # design tokens + base CSS
│   └── vite.config.ts   # dev proxy to the backend
├── docker/              # Dockerfile (overlay) + docker-compose.yml
├── docs/                # research, design, mockups, this guide
└── .github/workflows/   # lint, test, build, publish image
```

## Constraints

- The live instance at **zwave.clusterfault.com is READ-ONLY**. Never send
  mutating `ZWAVE_API` calls to it and never change its settings. Use it only as
  a structural/visual reference. For development and testing, run a **local**
  backend with the mock controller (see the agent guide).
