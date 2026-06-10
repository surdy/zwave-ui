# Z-Wave UI

[![CI](https://github.com/surdy/zwave-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/surdy/zwave-ui/actions/workflows/ci.yml) [![Container](https://github.com/surdy/zwave-ui/actions/workflows/container.yml/badge.svg)](https://github.com/surdy/zwave-ui/actions/workflows/container.yml)

A modern, clean, mobile-friendly UI for [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui).

> **Simple by default, powerful when you need it.**

Z-Wave UI is a ground-up redesign of the Z-Wave JS UI frontend. It keeps the
proven [zwave-js-ui](https://github.com/zwave-js/zwave-js-ui) backend (which wraps
[zwave-js](https://github.com/zwave-js/zwave-js)) and replaces only the user
interface — so you get full feature parity with a friendlier, responsive
experience. It is designed to run as a **drop-in replacement container** for
`zwave-js-ui`.

## Why

The existing Z-Wave JS UI is feature-complete and powerful, but its interface
exposes every advanced control at once, which can be overwhelming. Z-Wave UI
reorganizes the same capabilities around a **three-tier progressive disclosure
model**:

- 🟢 **Basic** — everyday tasks, always visible
- 🔵 **Advanced** — one toggle away
- 🔴 **Expert** — available but guarded

## Goals

- Modern, clean visual design
- Fully responsive for mobile use
- Simple by default, powerful when needed
- **Full feature compatibility** with Z-Wave JS UI
- Same backend (`zwave-js` / `@zwave-js/server` via `zwave-js-ui`)

## Architecture

```
┌─────────────────────────────┐
│   Z-Wave UI (new frontend)  │  Vue 3 + Vite + TypeScript + Pinia
│   served as static assets   │  custom CSS design system
└──────────────┬──────────────┘
               │ socket.io  +  REST  (ZWAVE_API)
┌──────────────▼──────────────┐
│  zwave-js-ui backend (reused)│  Node + Express + socket.io + MQTT
│  ZwaveClient / Gateway / HA  │
└──────────────┬──────────────┘
               │ @zwave-js/server / Serial
┌──────────────▼──────────────┐
│        Z-Wave controller     │
└─────────────────────────────┘
```

The container image builds the new frontend and overlays it on the official
`zwavejs/zwave-js-ui` image, so all backend behavior (Z-Wave, MQTT, Home
Assistant integration, store, etc.) is preserved.

## Repository layout

| Path | Description |
|------|-------------|
| `frontend/` | The new Vue 3 frontend application |
| `Dockerfile` / `docker-compose.yml` / `docker/` | Drop-in container build, compose example, and run docs |
| `docs/` | Research, competitive analysis, UX design, and mockups |
| `.github/workflows/` | CI: lint, test, build, publish container image |

## Documentation

All research and design work lives in [`docs/`](./docs/):

- [`docs/01-feature-analysis/`](./docs/01-feature-analysis/) — full feature catalog of zwave-js-ui (parity checklist)
- [`docs/02-competitive-analysis/`](./docs/02-competitive-analysis/) — SmartThings, Hubitat, Homey, Home Assistant, Apple/Google Home
- [`docs/03-ux-design/`](./docs/03-ux-design/) — design principles, information architecture, design system, user flows
- [`docs/04-mockups/`](./docs/04-mockups/) — responsive HTML mockups

## Status

🚧 Early development. Progress is tracked in
[GitHub Issues](https://github.com/surdy/zwave-ui/issues).

## License

[MIT](./LICENSE) © Harpreet Singh Gulati
