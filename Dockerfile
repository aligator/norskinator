# syntax=docker/dockerfile:1

# --- Build: install, verify, bundle ------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# pnpm in the exact version from package.json's packageManager field.
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Shown as the AGPL source link under Innstillinger → Om.
ARG SOURCE_URL=""
ENV VITE_SOURCE_URL=${SOURCE_URL}

# A broken build or a failing test must never become an image.
RUN pnpm run verify

# --- Runtime: plain nginx serving the static files, running as non-root ------
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 docker/40-basic-auth.sh /docker-entrypoint.d/40-basic-auth.sh
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
