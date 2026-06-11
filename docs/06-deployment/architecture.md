# Deployment architecture

This page explains how Z-Wave UI is deployed and how the pieces communicate.
For how the *frontend application* itself is built, see
[`docs/05-implementation/architecture.md`](../05-implementation/architecture.md).

## The frontend is a pure client

The Z-Wave UI frontend is a static Single-Page App. It talks to its backend
**only** over same-origin, **relative** paths — it has no hard-coded backend URL:

| Path | Protocol | Purpose |
|------|----------|---------|
| `/socket.io` | WebSocket (+ polling fallback) | realtime updates + the `ZWAVE_API` |
| `/api/*` | HTTP REST | auth, store, backup, etc. |
| `/health`, `/version` | HTTP | probes |

Because the app only uses relative paths, **whatever origin serves the app must
also answer those paths**. That single fact produces the two deployment modes.

## Mode 1 — all-in-one (drop-in)

`ghcr.io/surdy/zwave-ui` is the official `zwave-js-ui` image with our static
build overlaid on its `dist/`. The backend serves both the UI and the API from
the same origin, so no proxy is needed.

```
┌─────────────────────────────────────────────┐
│  ghcr.io/surdy/zwave-ui  (one container)      │
│  ┌───────────────┐   serves    ┌───────────┐ │   serial   ┌────────────┐
│  │ Z-Wave UI SPA │◄───same─────│ zwave-js- │ │◄──────────►│ Z-Wave stick│
│  └───────────────┘   origin    │ ui backend│ │ (1 driver) └────────────┘
│        /socket.io, /api ───────►└───────────┘ │
└─────────────────────────────────────────────┘
```

## Mode 2 — split (frontend + separate backend)

`ghcr.io/surdy/zwave-ui-frontend` is a small **nginx** image that serves the SPA
and **reverse-proxies** `/socket.io`, `/api`, `/health`, `/version` to a separate
backend selected by the `BACKEND_URL` environment variable. To the browser there
is still a single origin (the proxy), so there is **no CORS** and the SPA is
unchanged.

```
        browser
          │  http(s)  (single origin)
┌─────────▼──────────────────────────┐
│  zwave-ui-frontend (nginx)          │
│  • GET /            → static SPA     │
│  • /socket.io (ws)  ┐                │
│  • /api, /health,   ├─ proxy_pass ──► $BACKEND_URL
│    /version         ┘                │
└──────────────────────────────────────┘
                                        │ socket.io + REST
                              ┌─────────▼──────────┐  serial  ┌────────────┐
                              │ zwave-js-ui backend │◄────────►│ Z-Wave stick│
                              └─────────┬──────────┘ (1 driver)└────────────┘
                                        │ Z-Wave JS WebSocket server
                              ┌─────────▼──────────┐
                              │   Home Assistant    │
                              └────────────────────┘
```

The nginx config is rendered at container start from
[`docker/nginx/default.conf.template`](../../docker/nginx/default.conf.template)
by the stock nginx entrypoint (`envsubst` substitutes only `$BACKEND_URL`). It:

- serves the SPA with `try_files ... /index.html` so client-side routing and deep
  links work;
- upgrades the `/socket.io` connection to a WebSocket (`Upgrade`/`Connection`
  headers + long read timeout);
- forwards `/api`, `/health`, `/version` unchanged.

## One driver, many clients

The Z-Wave stick is a single-master serial device: only **one** `zwave-js`
driver may hold the port. So the split mode never adds a second backend — it adds
more **clients** to the same backend:

- the Z-Wave UI frontend (this project),
- optionally the stock `zwave-js-ui` UI (same backend port),
- Home Assistant via the backend's **Z-Wave JS WebSocket server**.

All of them are read/write clients of the **one** driver. You cannot point two
backends at one stick — see
[the one-driver-per-stick note](./README.md#one-driver-per-stick).

## Image targets

Both images come from one multi-stage [`Dockerfile`](../../Dockerfile):

| Target | Image | Base | Contents |
|--------|-------|------|----------|
| `frontend-build` | — (intermediate) | `node:22-alpine` | builds `dist/` |
| `standalone` | `ghcr.io/surdy/zwave-ui-frontend` | `nginx:1.27-alpine` | SPA + reverse proxy |
| `dropin` (default) | `ghcr.io/surdy/zwave-ui` | `zwavejs/zwave-js-ui` | backend + SPA |

See [development.md](./development.md) for building them locally.
