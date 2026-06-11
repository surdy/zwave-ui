# Split deployment with Podman Quadlet

Run the split topology as **systemd-managed Podman containers** using
[Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html).
This is rootless-friendly and integrates with `systemctl`.

The units live at [`deploy/quadlet/`](../../deploy/quadlet/):

```
deploy/quadlet/
├── zwave-ui.network             # dedicated network for service discovery
├── zwave-ui-backend.container   # stock zwave-js-ui, owns the stick
├── zwave-ui-frontend.container  # Z-Wave UI frontend (nginx proxy)
└── README.md
```

## Prerequisites

- **Podman 4.4+** (Quadlet support).
- A Z-Wave controller plugged into the host, accessible to the user that runs
  the units.

## 1. Install the units

Copy all four files to the Quadlet directory:

```bash
# Rootless (recommended):
mkdir -p ~/.config/containers/systemd
cp deploy/quadlet/zwave-ui.network \
   deploy/quadlet/zwave-ui-backend.container \
   deploy/quadlet/zwave-ui-frontend.container \
   ~/.config/containers/systemd/

# Rootful instead:
#   sudo cp deploy/quadlet/zwave-ui*.{network,container} /etc/containers/systemd/
```

Then reload systemd so it generates the services:

```bash
systemctl --user daemon-reload          # rootless
# sudo systemctl daemon-reload           # rootful
```

## 2. Configure (before or after install)

Edit the `.container` files (or add a systemd drop-in) to set:

- **Device path** — `AddDevice=/dev/ttyACM0:/dev/zwave` in
  `zwave-ui-backend.container`. Prefer a stable `/dev/serial/by-id/...` path.
- **Session secret** — `Environment=SESSION_SECRET=change-me`.
- **Ports** — `PublishPort=8091:8091` (backend) and `PublishPort=8092:8080`
  (frontend).
- **Store path** — `Volume=%h/zwave-ui/store:/usr/src/app/store:Z` (`%h` is the
  user's home; use an absolute path for rootful).

Re-run `daemon-reload` after editing.

## 3. Start

Starting the frontend pulls in the backend and the network automatically
(via `Requires=`/`After=`):

```bash
systemctl --user start zwave-ui-frontend
systemctl --user status zwave-ui-backend zwave-ui-frontend
```

Browse **`http://<host>:8092`** for Z-Wave UI. The stock zwave-js-ui UI and the
Z-Wave JS WebSocket server remain available on **`:8091`** for Home Assistant and
other clients — see [the one-driver-per-stick note](./README.md#one-driver-per-stick).

## 4. Enable on boot

```bash
systemctl --user enable zwave-ui-frontend
loginctl enable-linger "$USER"     # rootless: keep user services running at boot
```

For rootful installs, use `sudo systemctl enable` and omit `enable-linger`.

## How the units talk to each other

All three units share the `zwave-ui` network. The frontend reaches the backend
by **container name**:

```ini
# zwave-ui-frontend.container
Environment=BACKEND_URL=http://zwave-ui-backend:8091
```

## Rootless serial-device access

For a rootless container to use the stick, the **user** must have read/write
access to the device. Typically:

- Add your user to the device's group (e.g. `dialout` or `uucp`), **or**
- Install a udev rule granting access.

`AddDevice=` only works when the device is accessible to the user running the
unit.

## Troubleshooting

```bash
# Inspect generated services / logs
systemctl --user status zwave-ui-frontend
journalctl --user -u zwave-ui-backend -e

# Verify Quadlet generated the services (dry run)
/usr/libexec/podman/quadlet -dryrun -user
```

- **Frontend can't reach backend.** Confirm both are on `zwave-ui.network` and
  `BACKEND_URL` uses the backend's `ContainerName` (`zwave-ui-backend`).
- **Backend can't open the device.** Check the host path and rootless
  permissions (group/udev) above.
- **Services don't appear.** Ensure the files are in the Quadlet directory and
  you ran `daemon-reload`; Quadlet requires Podman 4.4+.
