# Podman Quadlet deployment

These units run a stock `zwavejs/zwave-js-ui` backend plus the `zwave-ui` frontend as systemd-managed Podman containers. Quadlet requires Podman 4.4+.

## Install

Copy all four files in this directory to one of:

- Rootless: `~/.config/containers/systemd/`
- Rootful: `/etc/containers/systemd/`

Reload systemd after copying:

```bash
systemctl --user daemon-reload
# or, for rootful installs:
sudo systemctl daemon-reload
```

## Start and enable

Start the frontend; systemd pulls in the backend and Quadlet network through the unit dependencies:

```bash
systemctl --user start zwave-ui-frontend
```

The units include `WantedBy=default.target`, so enable them for boot with:

```bash
systemctl --user enable zwave-ui-frontend
loginctl enable-linger $USER
```

For rootful installs, use `sudo systemctl` instead of `systemctl --user` and omit the linger command.

## Configure

Edit the `.container` files, or add systemd drop-ins, to change:

- Z-Wave device path: update `AddDevice=/dev/ttyACM0:/dev/zwave`; `/dev/serial/by-id/...` is recommended when available.
- Published ports: update `PublishPort=8091:8091` or `PublishPort=8092:8080`.
- Session secret: replace `Environment=SESSION_SECRET=change-me`.

For rootless serial-device access, the user running the unit must have read/write access to the controller device. Use the appropriate group such as `dialout` or `uucp`, or create a udev rule. `AddDevice` only works when the device is accessible to that user.

## Verify

```bash
systemctl --user status zwave-ui-backend zwave-ui-frontend
```

Then browse to <http://localhost:8092>. The backend remains available on <http://localhost:8091> for the stock UI and Home Assistant integrations.
