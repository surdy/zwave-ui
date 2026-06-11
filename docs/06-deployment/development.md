# Development & building the images

This page covers deployment-related development: pointing the frontend at any
backend, the proxy contract the production image must honor, and building both
images locally. For the full dev/test loop (mock stick, unit tests, e2e), see
[`docs/05-implementation/agent-guide.md`](../05-implementation/agent-guide.md).

## Run the frontend against any backend

In development, Vite proxies the backend paths for you. Choose the backend with
the `VITE_BACKEND` environment variable (default `http://localhost:8091`):

```bash
cd frontend
npm ci

# Against a local mock-stick backend (see the agent guide):
npm run dev

# Against any reachable zwave-js-ui backend:
VITE_BACKEND=http://192.168.1.50:8091 npm run dev

# `vite preview` (serves the production build) mirrors the same proxy:
npm run build
VITE_BACKEND=http://192.168.1.50:8091 npm run preview
```

The dev server listens on **`http://localhost:8092`**.

> The live instance at **zwave.clusterfault.com is read-only** — use it only as a
> visual/structural reference, never for mutating calls.

## The proxy contract

Whatever serves the SPA in production must answer these paths on the **same
origin** (the SPA only ever uses relative paths):

| Path | Notes |
|------|-------|
| `/socket.io` | WebSocket upgrade required (realtime + `ZWAVE_API`) |
| `/api/*` | REST (auth, store, backup, …) |
| `/health`, `/version` | probes |

Three implementations of this same contract must stay in sync:

- **dev/preview** — [`frontend/vite.config.ts`](../../frontend/vite.config.ts)
  (`server.proxy` / `preview.proxy`).
- **split image** —
  [`docker/nginx/default.conf.template`](../../docker/nginx/default.conf.template).
- **all-in-one image** — the `zwave-js-ui` backend serves these natively.

If you add a new top-level backend path, update **both** the Vite proxy and the
nginx template.

## Build the images locally

Both images are produced from one multi-stage [`Dockerfile`](../../Dockerfile)
via `--target`:

```bash
# Standalone frontend (split mode): nginx + SPA, proxies to $BACKEND_URL
docker build --target standalone -t zwave-ui-frontend .

# All-in-one drop-in (default target): backend + SPA in one image
docker build -t zwave-ui .
# (equivalent to: docker build --target dropin -t zwave-ui .)
```

Run the standalone image, pointing it at a backend:

```bash
docker run --rm -p 8092:8080 \
  -e BACKEND_URL=http://host.docker.internal:8091 \
  zwave-ui-frontend
# open http://localhost:8092
```

### Environment variables

| Image | Variable | Default | Purpose |
|-------|----------|---------|---------|
| `standalone` | `BACKEND_URL` | `http://backend:8091` | backend the nginx proxy forwards to |
| `dropin` | *(all standard `zwave-js-ui` env vars)* | — | same as upstream |

> The `standalone` image listens on container port **8080**. `BACKEND_URL` is
> resolved by nginx **at startup**, so the backend hostname must be resolvable
> when the frontend starts (shared Docker/Podman network + start ordering handle
> this — see the compose/quadlet guides).

## CI

There is **no container runtime** available for local development of this repo,
so the image is validated by CI: the `Container` workflow builds the
`standalone` target on every PR and smoke-tests that nginx starts and serves the
SPA, then publishes both images to GHCR on `main`/tags. See
[`.github/workflows/container.yml`](../../.github/workflows/container.yml).
