# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2026 DIY Accounting Ltd
#
# Dockerfile — installs the packed @diy-accounting-uk/diya-gl tarball
# globally. Build context is the scratch directory diya-gl/smoke.sh packs
# the tarball into (target/diya-gl-smoke in CI); TARBALL names the file
# inside that context, found by the caller rather than guessed here.
#
#   docker build --build-arg TARBALL=diy-accounting-uk-diya-gl-1.0.0.tgz \
#     --build-arg VERSION=1.0.0 -f diya-gl/Dockerfile target/diya-gl-smoke

FROM node:24-alpine

ARG TARBALL
ARG VERSION=0.0.0

LABEL org.opencontainers.image.source="https://github.com/diy-accounting-uk/spreadsheets.diyaccounting.co.uk" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.description="Recalculate, read and write diya-gl books: a UK sole trader or company's accounts."

COPY ${TARBALL} /tmp/diya-gl.tgz
RUN npm install -g --no-audit --no-fund /tmp/diya-gl.tgz \
    && rm -f /tmp/diya-gl.tgz \
    && npm cache clean --force

ENTRYPOINT ["diya-gl"]
CMD []
