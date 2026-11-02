# Build the static dashboard from the vendored source, then serve it with
# nginx alongside the Python sync/API service (photos, calendars, weather).
# The dashboard build stage is pinned to the builder's platform
# ($BUILDPLATFORM) so the Vite/npm build always runs natively — its output is
# architecture-independent static files. The Python deps are cross-installed
# for the TARGET platform the same way, so no emulation is needed for any
# supported target arch.
FROM --platform=$BUILDPLATFORM node:22-alpine AS build
WORKDIR /app
COPY upstream-project/package.json upstream-project/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY upstream-project/ .
RUN npm run build

FROM --platform=$BUILDPLATFORM python:3.12-alpine AS pydeps
# Cross-install for the target platform (--platform is honored by pip's
# --only-binary mode; icalendar and recurring-ical-events are pure Python).
# Map docker's linux/arm64 to pip's linux/aarch64.
RUN set -eux; \
    : "${TARGETPLATFORM:=linux/x86_64}"; \
    case "$TARGETPLATFORM" in \
      linux/arm64) PIP_PLAT=manylinux_2_17_aarch64 ;; \
      *) PIP_PLAT=manylinux_2_17_x86_64 ;; \
    esac; \
    pip install --no-cache-dir --platform "$PIP_PLAT" --platform "linux_${PIP_PLAT##*_}" \
    --only-binary=:all: --target /opt/pydeps icalendar recurring-ical-events zeroconf==0.151.2

FROM nginx:1.27-alpine
# Pillow comes from Alpine, not pip: the pip wheels are glibc-linked and the
# runtime here is musl, so importing PIL failed with a missing _imaging module.
RUN apk add --no-cache python3 py3-pillow
COPY --from=pydeps /opt/pydeps /opt/pydeps
ENV PYTHONPATH=/opt/pydeps
ENV DATA_DIR=/data
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY service/ /opt/dashboard_service/
EXPOSE 80
CMD ["python3", "/opt/dashboard_service/start.py"]
