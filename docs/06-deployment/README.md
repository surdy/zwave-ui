# Deployment

Z-Wave UI ships as a container in **two flavours**. Both serve the exact same
UI; they differ only in *where the backend runs*.

| Mode | Image | What's in the container | Use when |
|------|-------|--------------------------|----------|
| **All-in-one (drop-in)** | `ghcr.io/surdy/zwave-ui` | The official `zwave-js-ui` backend **plus** the Z-Wave UI frontend | You just want to replace `zwave-js-ui` with a nicer UI — one container, talks to the stick directly. |
| **Split (frontend only)** | `ghcr.io/surdy/zwave-ui-frontend` | Only the Z-Wave UI frontend (nginx) — reverse-proxies to a **separate** backend | You already run a `zwave-js-ui` backend (or want to), and want one backend/stick to serve multiple frontends. |

## Which should I use?

- **Most people: all-in-one.** It's the simplest drop-in replacement for
  `zwave-js-ui`. See the all-in-one [`docker-compose.yml`](../../docker-compose.yml)
  at the repo root and [`docker/README.md`](../../docker/README.md).
- **Split** is for when you want the frontend and backend on **separate
  containers/hosts** — for example to run **both** the stock `zwave-js-ui` UI
  **and** Z-Wave UI against the **same** backend and stick, or to put the
  frontend on a different machine from the controller.

## Split deployment guides

- 🐳 **[Docker Compose](./docker-compose.md)** — the easiest split setup.
- 🦭 **[Podman Quadlet](./podman-quadlet.md)** — systemd-managed, rootless-friendly.
- 🏗️ **[Architecture](./architecture.md)** — how the pieces fit and talk.
- 🛠️ **[Development](./development.md)** — run the frontend against any backend; build the images.

The ready-to-use manifests live in [`deploy/`](../../deploy/):

```
deploy/
├── compose/    docker-compose.yml + .env.example
└── quadlet/    *.container + *.network + README.md
```

## One driver per stick

A Z-Wave controller (USB stick) is a **single-master serial device**: exactly
**one** `zwave-js` driver may have the port open at a time. Two backends pointed
at the same stick will corrupt protocol framing and fail.

The supported "sharing" model is **one backend, many clients**:

```
                       ┌──────────────────────┐
                       │  Z-Wave UI frontend   │  (this project, split mode)
                       └───────────┬──────────┘
                                   │ socket.io + REST
┌───────────────┐   serial   ┌─────▼──────────────┐   WebSocket   ┌──────────────┐
│  Z-Wave stick │◄──────────►│  zwave-js-ui       │◄─────────────►│ Home Assistant│
└───────────────┘ (1 driver) │  backend           │  (zwave-js    └──────────────┘
                             │                    │   server)
                             └─────▲──────────────┘
                                   │ socket.io + REST
                       ┌───────────┴──────────┐
                       │  stock zwave-js-ui UI │  (optional, same backend)
                       └──────────────────────┘
```

- ✅ **Multiple frontends** (Z-Wave UI + the stock UI) against **one** backend — fine.
- ✅ **Home Assistant** alongside them via the backend's **Z-Wave JS WS server** — fine.
- ❌ **Two backends** on **one** stick — not supported.

See [architecture.md](./architecture.md) for the full picture.
