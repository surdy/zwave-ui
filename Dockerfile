# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM zwavejs/zwave-js-ui:11.19.1

# Verify the upstream static asset path still exists, then replace only the UI.
RUN test -d /usr/src/app/dist && rm -rf /usr/src/app/dist/* /usr/src/app/dist/.[!.]* /usr/src/app/dist/..?*
COPY --from=frontend /app/dist /usr/src/app/dist
