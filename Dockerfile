# syntax=docker/dockerfile:1

# ---- Stage 1: build the Vue SPA --------------------------------------------
FROM node:22-alpine AS frontend-build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---- Stage 2: standalone frontend image (split deployment) -----------------
# A small nginx image that serves the SPA and reverse-proxies the realtime/REST
# endpoints to a SEPARATE zwave-js-ui backend selected via $BACKEND_URL. Build
# it explicitly:  docker build --target standalone -t zwave-ui-frontend .
FROM nginx:1.27-alpine AS standalone

# Backend to reverse-proxy to; override at runtime (e.g. http://backend:8091).
ENV BACKEND_URL=http://backend:8091

# The stock nginx entrypoint runs envsubst over this template at startup and
# writes the result to /etc/nginx/conf.d/default.conf. Only real environment
# variables (BACKEND_URL) are substituted; nginx runtime vars ($host, $uri,
# $http_upgrade, ...) are left untouched because they are not in the environment.
COPY docker/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 8080

# ---- Stage 3 (default): all-in-one drop-in over zwave-js-ui ----------------
# Kept LAST so the default `docker build` target is unchanged: it replaces the
# bundled UI inside the official zwave-js-ui image in place (backend + UI in
# one container, talking to the stick directly).
FROM zwavejs/zwave-js-ui:11.19.1 AS dropin

# Verify the upstream static asset path still exists, then replace only the UI.
RUN test -d /usr/src/app/dist && rm -rf /usr/src/app/dist/* /usr/src/app/dist/.[!.]* /usr/src/app/dist/..?*
COPY --from=frontend-build /app/dist /usr/src/app/dist
