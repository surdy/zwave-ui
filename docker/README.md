# Drop-in container image

This project publishes `ghcr.io/surdy/zwave-ui`, a drop-in replacement for
`zwavejs/zwave-js-ui`. The image is built from the root `Dockerfile`: it builds
`frontend/` with Node 22, pins the upstream base image to
`zwavejs/zwave-js-ui:11.19.1`, verifies `/usr/src/app/dist` exists, and replaces
only those static frontend assets. The upstream backend, port `8091`, command,
environment handling, and `/usr/src/app/store` data directory are inherited.

## Run

```bash
docker run -d \
  --name zwave-ui \
  --restart unless-stopped \
  -p 8091:8091 \
  -v "$PWD/store:/usr/src/app/store" \
  --device /dev/ttyACM0:/dev/zwave \
  -e TZ=UTC \
  -e SESSION_SECRET=change-me \
  ghcr.io/surdy/zwave-ui:latest
```

Or copy `docker-compose.yml`, adjust the serial device path for your controller,
and run:

```bash
docker compose up -d
```

## Migrating from zwave-js-ui

Use the same `store/` volume or bind mount that your existing
`zwavejs/zwave-js-ui` container uses. Keep the same serial device, ports, and
environment variables. Only the served frontend assets change; `/api/*`,
`/socket.io`, MQTT, Home Assistant integration, and Z-Wave behavior remain the
upstream backend implementation.

## Bumping the base image

1. Confirm the target tag exists on Docker Hub for `zwavejs/zwave-js-ui`.
2. Update the final `FROM` line in the root `Dockerfile`.
3. Open a PR and let the container workflow validate that `/usr/src/app/dist`
   still exists and the image builds.

The first workflow version builds `linux/amd64`. Arm64 is deferred to keep CI
fast; the pinned upstream image supports arm64 and the workflow can be expanded
when needed.
