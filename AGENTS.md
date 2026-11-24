# bashed-demo

Hosted shell script demos for [Bashed](https://bashed.hackclub.com), Hack Club's shell
scripting YSWS. Each demo runs a project's script in a Linux machine inside the visitor's
browser tab ([CheerpX](https://cheerpx.io)), at the commit Bashed chose, with the whole
repository cloned next to it.

Lives at `demo.bashed.hackclub.com`: a shipped demo's page is `/<id>`, a preview's `/framed/<id>`.

## How it works

1. **Bashed makes a demo** with a signed request (see [the API](#api)): the repository (on
   GitHub, GitLab or Codeberg), the file to run, and a commit or the repository's latest. The
   site clones the repository at that commit (a shallow clone, `.git` included) and keeps it
   packed in its database, so the demo keeps running that version whatever's pushed later.
   Each demo has a UUIDv6, and is one of two kinds:
   - **framed**: a two-minute preview the project's owner tries from its page on Bashed, in a
     frame, at `/framed/<id>`. In Bashed's frame it runs straight away (it's the owner's own
     code); opened anywhere else it has the warning. When its two minutes are up the machine
     stops, and the page is gone.
   - **shipped**: made when the project's shipped, for its reviewers and anyone else, at
     `/<id>`. It stays.
2. **A visitor opens a shipped demo.** Before anything runs they're told whose code it is and
   where it runs, with links to the repository, the file and the commit, all at that commit.
   Nothing starts until they say so.
3. **The machine starts in their tab.** CheerpX boots a 32-bit Debian disk (bash, fish, git and
   the usual tools, see the `Dockerfile`), read from this site in pieces as it's needed. The
   repository's unpacked into `~/<repo name>` and the file runs from there, through its shebang
   if it has one, otherwise with the shell its extension names (`.fish` with fish, anything else
   with bash). When it finishes, the visitor's left in a shell in the repository.

Each run's writes go to a fresh IndexedDB that's cleared afterwards, so nothing one demo does
reaches the next. The machine has no network.

CheerpX needs cross-origin isolation, which a frame only gets if the page around it has it
too, and Bashed's doesn't. So framed demos isolate themselves with `Document-Isolation-Policy`
(Chromium 137 and later); in browsers without it, the frame offers to open the demo in a tab
of its own instead. Only Bashed can frame them (`frame-ancestors`, from `BASHED_URL`).

The site's git never asks for anything: no prompts and no askpass program, and none of the
machine's own git config. A repository that needs a login just fails.

## API

Bashed's requests are signed with the secret both sides share (`BASHED_SECRET`):

```
X-Bashed-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<METHOD>.<path>.<raw body>">
```

Requests more than five minutes old are refused. `scripts/bashed-request.mjs` signs requests
the same way, for trying things by hand (`pnpm bashed <METHOD> <path> [body]`).

- **`POST /api/demos`** with
  `{ "repo": "https://github.com/<owner>/<name>", "entry": "<path in the repo>", "kind": "framed" | "shipped", "commit": "<full SHA>", "project": <Bashed project ID> }`
  (`commit` and `project` are optional; without a commit it's the latest) makes a demo and
  answers with it once it's cloned (201): its `id`, `kind`, `commit`, `expiresAt` (null for a
  shipped one) and `page` (where it is on this site). 400 for bad input, 422 if the repository
  can't be fetched (or isn't public) or the file isn't in it, 413 if it's over 25 MB packed.
- **`GET /api/demos`** lists every demo that's up (shipped ones, and framed ones that haven't
  run out), newest first, for Bashed's admins.
- **`DELETE /api/demos/:id`** takes one down: 204, whether or not there was one.
- **`POST /api/repository/files`** with `{ "repo": "<repository URL>" }` lists the files in the
  repository at its latest commit (path, size, whether it's executable and its shebang line),
  for Bashed's picker of the file a demo runs. Kept for 30 seconds.

Public, unsigned: `GET /api/demos/:id` (the demo, or 410 for a preview that's ended) and
`GET /api/demos/:id/archive?commit=<SHA>` (its repository, packed).

## Development

Needs Node 24, pnpm, and Docker or Podman.

```sh
cp .env.example .env     # set POSTGRES_PASSWORD (and DATABASE_URL to match) and BASHED_SECRET
pnpm install
pnpm db:up               # Postgres on localhost:5434
pnpm db:push
pnpm disk:build          # the virtual machine's disk, into .data/disk (a few minutes)
pnpm dev                 # http://localhost:3001
```

Then make a demo, e.g.

```sh
pnpm bashed POST /api/demos '{"repo":"https://github.com/part-avocado/bonsai","entry":"main.fish","kind":"shipped"}'
```

and open its `page` (http://localhost:3001/<id>). Bashed makes them itself once its
`DEMOS_URL` and `DEMOS_SECRET` point here.

Schema changes: edit `server/database/schema.ts`, then `pnpm db:generate --name <change>`.
Production applies the migrations when it starts.

## Deploying

It runs on [Hack Club's Orchard](https://orchard.hackclub.com), like Bashed: Orchard clones
this repository and builds its `Dockerfile` (the final stage, `app`, with the virtual
machine's disk built in), and auto-deploy rebuilds it on each push to `main`. The disk only
rebuilds when `disk/` or the Dockerfile's disk stages change; Orchard's builders share a
build cache.

Setting it up, once:

1. **Make a database** in the Orchard project.
2. **Make the app:** **New app** > **GitHub repo**, `hackclub/bashed-demo` on `main`, built
   with its Dockerfile, on port 3000, public, at `demo.bashed.hackclub.com`. Turn on
   auto-deploy in **Settings** > **Deploy behavior**.
3. **Give it its variables:**
   - `DATABASE_URL`: connect the database to the app, and Orchard adds it (or set
     `NUXT_DATABASE_URL` yourself).
   - `NUXT_BASHED_SECRET`: the secret Bashed signs its requests with (`openssl rand -hex 32`).
   - `NUXT_PUBLIC_BASHED_URL`: `https://bashed.hackclub.com`, which links back to Bashed and
     is the only site allowed to frame previews.
4. **Point Bashed at it:** `NUXT_DEMOS_URL=https://demo.bashed.hackclub.com` and the same
   secret as `NUXT_DEMOS_SECRET`.

Building the disk runs 32-bit Debian's own programs (its package manager), so the builder
has to be an x86-64 machine that can run 32-bit programs, which most can. If Orchard's
build fails in the `rootfs` stage with an "exec format error", its builders can't: build the
image somewhere that can (`docker build --target app .`), push it to a registry, and deploy
that image instead.

The app applies its database migrations when it starts (copies that start together take
turns). Nothing it keeps in memory matters, so it can run as more than one copy.

Elsewhere, `docker compose up -d` runs Postgres and the site (on `APP_PORT`, 3001 by
default), building the image (disk included, a few minutes the first time). Set
`BASHED_SECRET`, `POSTGRES_PASSWORD` and `BASHED_URL` in `.env`.

Pages are served cross-origin isolated (`Cross-Origin-Opener-Policy` and
`Cross-Origin-Embedder-Policy`), and previews with `Document-Isolation-Policy`, which CheerpX
needs; keep those headers if a proxy's in front.

## Limits

- **32-bit x86 only.** CheerpX doesn't run 64-bit programs yet, so there's no PowerShell
  (`pwsh` is 64-bit only).
- **No network** inside the machine.
- **Terminal read timeouts are filled in.** CheerpX's terminal ignores `VMIN=0`/`VTIME`, so
  scripts that read the keyboard on a timer (`stty -icanon min 0 time 1`, then `dd`) would wait
  for a key. `disk/tty-timeout.c`, preloaded into every program, makes those reads time out as
  Linux does.
- **Signals to programs reading the terminal** don't always arrive: `timeout 1 cat` doesn't
  stop.

## The terminal's font

The terminal uses Adwaita Mono (SIL Open Font License 1.1, `public/fonts/AdwaitaMono-OFL.txt`),
served from `public/fonts` so every visitor gets the same cells and its block characters
(including the octants the boot logo is drawn with) tile exactly. The files are subsets of
Fedora's `adwaita-mono-fonts`, made with fontTools:

```sh
pyftsubset AdwaitaMono-Regular.ttf --flavor=woff2 --layout-features='*' \
  --unicodes="U+0020-007E,U+00A0-024F,U+0300-036F,U+2000-206F,U+20A0-20C0,U+2100-214F,U+2190-21FF,U+2200-22FF,U+2300-23FF,U+2400-243F,U+2460-24FF,U+2500-257F,U+2580-259F,U+25A0-25FF,U+2600-26FF,U+2700-27BF,U+27C0-27EF,U+27F0-27FF,U+2800-28FF,U+2900-297F,U+2B00-2BFF,U+E0A0-E0D7,U+FFFD,U+1CC00-1CEBF,U+1FB00-1FBFF" \
  --output-file=public/fonts/AdwaitaMono-Regular.woff2
```

(and the same for Bold; `--flavor=woff2` needs the `brotli` package).

## Licence

CheerpX is Leaning Technologies' proprietary software, free for personal and open-source
projects. It's loaded from their CDN.
