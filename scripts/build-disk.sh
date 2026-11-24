#!/bin/sh
# Builds the demos' virtual machine disk (the `disk` stage of the Dockerfile) into
# .data/disk/disk.ext2, where the dev server serves it from. Uses Docker, or Podman if
# that's what's installed.
set -e
cd "$(dirname "$0")/.."
engine=${CONTAINER_ENGINE:-$(command -v docker >/dev/null && docker info >/dev/null 2>&1 && echo docker || echo podman)}
"$engine" build --target disk --output type=local,dest=.data/disk .
ls -lh .data/disk/disk.ext2
