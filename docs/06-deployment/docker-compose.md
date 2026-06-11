# Split deployment with Docker Compose

Run the **Z-Wave UI frontend** and a stock **`zwave-js-ui` backend** as two
separate containers. Only the backend talks to the Z-Wave stick; the frontend
is a pure reverse-proxy client.

The manifest lives at [`deploy/compose/`](../../deploy/compose/).

## Prerequisites

- Docker Engine + the Compose plugin (`docker compose`).
- A Z-Wave controller plugged into the host.
- The published frontend image `ghcr.io/surdy/zwave-ui-frontend` (built by CI).

## 1. Get the files

```bash
git clone https://github.com/surdy/zwave-ui.git
cd zwave-ui/deploy/compose
cp .env.example .env
```

## 2. Configure `.env`

```dotenv
# Host path to your controller — prefer a stable by-id path:
#   ls -l /dev/serial/by-id/
ZWAVE_DEVICE=/dev/ttyACM0

# Required: a long random string used by the backend to sign sessions.
SESSION_SECRET=change-me-to-a-long-random-string

TZ=UTC
FRONTEND_PORT=8092   # where you browse Z-Wave UI
BACKEND_PORT=8091    # the stock zwave-js-ui UI + Z-Wave JS WS server
```

> Find a stable device path with `ls -l /dev/serial/by-id/` and use that value
> for `ZWAVE_DEVICE` — kernel names like `/dev/ttyACM0` can change across reboots.

## 3. Start it

```bash
docker compose up -d
docker compose ps
```

Then open **`http://<host>:8092`** for Z-Wave UI.

## What you get

| Service | Image | Owns the stick? | Reachable at |
|---------|-------|-----------------|--------------|
| `backend` | `zwavejs/zwave-js-ui:11.19.1` | ✅ yes (`devices:`) | `:8091` (stock UI + WS server) |
| `frontend` | `ghcr.io/surdy/zwave-ui-frontend:latest` | ❌ no (proxy only) | `:8092` (Z-Wave UI) |

The frontend reaches the backend over the internal Compose network using
`BACKEND_URL=http://backend:8091` (the Compose **service name**, not the host).

## Also use the stock UI / Home Assistant

Because the backend is unchanged, everything that normally talks to
`zwave-js-ui` still works against the **backend port** (`:8091`):

- The **stock zwave-js-ui UI** at `http://<host>:8091`.
- **Home Assistant**: add the *Z-Wave* integration pointing at the backend's
  **Z-Wave JS WebSocket server** (`ws://<host>:3000` by default; enable it in the
  backend's settings). The frontend container is *not* involved in this path.

This is the "one backend, many clients" model — see
[the one-driver-per-stick note](./README.md#one-driver-per-stick).

## Updating

```bash
docker compose pull
docker compose up -d
```

## Validate the manifest

There is no container runtime in this repo's CI, so validate locally:

```bash
docker compose -f deploy/compose/docker-compose.yml config
```

## Troubleshooting

- **Frontend loads but can't connect / "disconnected".** The backend isn't
  reachable. Check `docker compose logs backend` and that `BACKEND_URL` matches
  the backend service name and port.
- **Backend won't start / can't open the device.** Verify `ZWAVE_DEVICE` exists
  on the host and that the container has access (the path is passed through with
  `devices:`).
- **Port already in use.** Change `FRONTEND_PORT` / `BACKEND_PORT` in `.env`.
