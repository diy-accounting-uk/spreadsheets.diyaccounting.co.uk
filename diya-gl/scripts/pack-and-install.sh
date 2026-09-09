#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
# Copyright (C) 2006-2026 DIY Accounting Limited
#
# pack-and-install.sh — pack this package and install the tarball into a
# fresh scratch project, so a caller can run its bins from node_modules/.bin
# exactly as an npm-installed user would, never from the source tree.
# Sourced by smoke.sh and parity.sh rather than duplicated in each.
#
# pack_and_install DIYA_GL_DIR SCRATCH_DIR
# Prints the installed bin directory (.../node_modules/.bin) on stdout;
# everything else goes to stderr, so a caller can capture just the path with
# BIN=$(pack_and_install "$DIYA_GL_DIR" "$SCRATCH").
pack_and_install() {
  local diya_gl_dir="$1"
  local scratch="$2"
  mkdir -p "$scratch"
  scratch="$(cd "$scratch" && pwd)"

  local tarball_name
  tarball_name=$(cd "$diya_gl_dir" && npm pack --pack-destination "$scratch" --json | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8'))[0].filename")
  local tarball="$scratch/$tarball_name"
  echo "tarball: $tarball ($(du -h "$tarball" | cut -f1))" >&2

  local install_dir="$scratch/install"
  mkdir -p "$install_dir"
  (cd "$install_dir" && npm init -y >/dev/null && npm install "$tarball" >/dev/null)

  echo "$install_dir/node_modules/.bin"
}
