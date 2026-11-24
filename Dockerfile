# ---------------------------------------------------------------------------------------------
# The demos' virtual machine disk: an ext2 image of 32-bit Debian (CheerpX only runs 32-bit x86)
# with bash, fish and the tools scripts usually reach for. Built on its own with
# `pnpm disk:build`, and into the app image below.
# ---------------------------------------------------------------------------------------------

# Fills in terminal read timeouts, which CheerpX doesn't do (see disk/tty-timeout.c)
FROM --platform=linux/386 docker.io/i386/debian:trixie-slim AS tty-timeout
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev
COPY disk/tty-timeout.c /tty-timeout.c
RUN gcc -O2 -Wall -shared -fPIC -o /tty-timeout.so /tty-timeout.c

FROM --platform=linux/386 docker.io/i386/debian:trixie-slim AS rootfs
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
		bash fish bash-completion \
		coreutils findutils grep sed gawk bc diffutils patch file tree \
		procps psmisc ncurses-bin ncurses-term less nano vim-tiny \
		git ca-certificates curl wget jq \
		tar gzip bzip2 xz-utils zip unzip \
		dialog whiptail fzf figlet toilet cowsay \
		python3-minimal \
	&& rm -rf /var/lib/apt/lists/* /usr/share/doc/* /usr/share/man/* /usr/share/info/*
RUN useradd --create-home --shell /bin/bash user
COPY --chmod=755 disk/bashed-demo /usr/local/bin/bashed-demo
# cowsay lives in /usr/games, which isn't on PATH for normal users
RUN echo 'export PATH="$PATH:/usr/games"' > /etc/profile.d/games.sh
COPY --from=tty-timeout /tty-timeout.so /usr/local/lib/tty-timeout.so
RUN echo /usr/local/lib/tty-timeout.so > /etc/ld.so.preload

FROM docker.io/library/alpine:3 AS disk-build
RUN apk add --no-cache e2fsprogs
COPY --from=rootfs / /rootfs
# Sized to what's in it plus room for what demos write (their writes stay in the browser).
# Revision 0, like WebVM's images.
RUN used=$(du -sm /rootfs | cut -f1) \
	&& mkfs.ext2 -q -E revision=0 -b 4096 -d /rootfs /disk.ext2 "$((used + used / 4 + 256))M"

# Just the image, for `docker build --target disk --output <dir> .`
FROM scratch AS disk
COPY --from=disk-build /disk.ext2 /disk.ext2

# ---------------------------------------------------------------------------------------------
# The app
# ---------------------------------------------------------------------------------------------
FROM node:24-alpine AS base
RUN npm install -g pnpm@12.14.0
WORKDIR /app

# All dependencies, for building
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# postinstall runs `nuxt prepare`, which needs the sources, so it's skipped here
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY . .
RUN pnpm exec nuxt prepare && pnpm build

# The app: Nitro's self-contained output, with no node_modules. git and tar fetch and pack
# the projects' repositories.
FROM node:24-alpine AS app
RUN apk add --no-cache git tar
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NUXT_DISK_PATH=/app/disk/disk.ext2
COPY --from=build /app/.output ./.output
COPY --from=disk /disk.ext2 ./disk/disk.ext2
# Applied when the server starts (server/plugins/migrate.ts), from the working directory
COPY server/database/migrations ./server/database/migrations
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
