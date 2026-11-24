import { execFile } from "node:child_process";
import { lstat, mkdtemp, open, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, posix, sep } from "node:path";
import { promisify } from "node:util";
import { REPO_HOSTS, type RepoHost } from "#shared/utils/repo-hosts";

const run = promisify(execFile);

// The most a repository may take up packed, so the database and visitors' downloads stay small
const MAX_ARCHIVE_BYTES = 25 * 1024 * 1024;
// How long each git or tar step may take
const GIT_TIMEOUT_MS = 60_000;
// At most this many repositories are being cloned at once; the rest wait their turn
const MAX_CLONES = 3;
// The most files listed from a repository (for picking the one a demo runs)
const MAX_FILES = 5000;
// How long a repository's list of files is kept, so opening the picker again is quick
const FILES_TTL_MS = 30_000;

export interface Repository {
  host: RepoHost;
  // Its path on the host: an owner and a name (on GitLab, maybe groups in between)
  path: string;
  // Its last part, which the virtual machine names its folder after
  name: string;
}

// A repository from Bashed: https://<host>/<path> on one of REPO_HOSTS, with or without
// .git or a trailing slash. Its path is two or more parts of letters, digits, "_", "." and
// "-" (GitLab's groups make it longer), and nothing that'd climb out of it.
export function parseRepository(value: unknown): Repository {
  let url: URL | undefined;
  try {
    url = typeof value == "string" ? new URL(value.trim()) : undefined;
  } catch {}
  const host = REPO_HOSTS.find((h) => h.host == url?.hostname)?.host;
  const path = url?.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  const parts = path?.split("/") ?? [];
  if (
    url?.protocol != "https:" ||
    url.search ||
    url.hash ||
    !host ||
    parts.length < 2 ||
    parts.length > 20 ||
    parts.some((part) => !/^[\w.-]{1,100}$/.test(part) || /^\.+$/.test(part))
  ) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "repo must be a repository's URL on GitHub, GitLab or Codeberg",
    });
  }
  return { host, path: path!, name: parts.at(-1)! };
}

// A full commit SHA, or null for the repository's latest
export function parseCommit(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value != "string" || !/^[0-9a-fA-F]{40}$/.test(value)) {
    throw createError({
      statusCode: 400,
      statusMessage: "commit must be a full commit SHA (40 hex digits)",
    });
  }
  return value.toLowerCase();
}

// The file to run, as a tidy path within the repository ("./src//run.sh" is "src/run.sh").
// Whether it's really there is checked once the repository's fetched.
export function parseEntry(value: unknown): string {
  const entry =
    typeof value == "string" && value.length <= 500
      ? posix.normalize(value.trim()).replace(/^(\.\/)+/, "")
      : "";
  if (
    !entry ||
    entry == "." ||
    entry.startsWith("/") ||
    entry.endsWith("/") ||
    entry.split("/").includes("..") ||
    entry.split("/")[0] == ".git" ||
    /[\0\n\r]/.test(entry)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "entry must be a file's path within the repository",
    });
  }
  return entry;
}

// Git never asks anyone anything: no terminal prompts, and no "askpass" program (a
// desktop's, e.g. KDE's SSH_ASKPASS, would open a window asking for a login when a
// repository isn't public), and none of the machine's own git config (its credential
// helpers, or rewrites of https:// links to SSH). A repository that wants a login just fails.
const GIT_ENV = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  SSH_ASKPASS: "",
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_LFS_SKIP_SMUDGE: "1",
};

// GitHub tokens (NUXT_GITHUB_TOKENS, separated by commas), so clones from GitHub don't run
// into its limit for ones without a login. Each clone starts from the next in turn. A token
// GitHub refuses while going without one works (it's expired, or its account's used up its
// limit) is left out for a while.
const REFUSED_TOKEN_MS = 15 * 60_000;
const refusedTokens = new Map<string, number>();
let tokenTurn = 0;
function githubTokens() {
  const now = Date.now();
  const tokens = [
    ...new Set(
      String(useRuntimeConfig().githubTokens ?? "")
        .split(/[\s,]+/)
        .filter(Boolean),
    ),
  ].filter((token) => (refusedTokens.get(token) ?? 0) <= now);
  const start = tokenTurn++ % Math.max(tokens.length, 1);
  return [...tokens.slice(start), ...tokens.slice(0, start)];
}

// Git's environment, logging in to GitHub with the token if there is one. It's given in
// the environment, so it isn't in the command line (which anyone on the machine can see)
// or the clone's .git/config (which goes to visitors), and only to github.com.
function gitEnv(token: string | null) {
  if (!token) return GIT_ENV;
  const login = Buffer.from(`x-access-token:${token}`).toString("base64");
  return {
    ...GIT_ENV,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.https://github.com/.extraHeader",
    GIT_CONFIG_VALUE_0: `Authorization: Basic ${login}`,
  };
}

// Clones the repository at a commit (its latest if that's null), runs `use` on the clone,
// then deletes it. Only that commit's fetched, but it's a real clone with its .git, so
// scripts can use git too. Submodules and Git LFS files aren't fetched.
async function withClone<T>(
  repository: Repository,
  commit: string | null,
  use: (clone: string, commit: string) => Promise<T>,
): Promise<T> {
  return inTurn(async () => {
    const dir = await mkdtemp(join(tmpdir(), "bashed-demo-"));
    const clone = join(dir, "repo");
    const url = `https://${repository.host}/${repository.path}.git`;
    let token: string | null = null;
    const git = (args: string[]) =>
      run("git", ["-c", "init.defaultBranch=main", ...args], {
        cwd: dir,
        timeout: GIT_TIMEOUT_MS,
        maxBuffer: 64 * 1024 * 1024,
        env: gitEnv(token),
      });
    const unreachable = () =>
      createError({
        statusCode: 422,
        statusMessage: `Couldn't get ${repository.host}/${repository.path}. Is it public?`,
      });

    try {
      await git(["init", "-q", clone]);
      await git(["-C", clone, "remote", "add", "origin", url]);
      const at = (args: string[]) => git(["-C", clone, ...args]);

      // Whether it can be reached, and what its HEAD (its default branch) points at. On
      // GitHub, with the first token that's let in, or else without one.
      const tokens = repository.host == "github.com" ? githubTokens() : [];
      let head: string | null = null;
      for (const login of [...tokens, null]) {
        token = login;
        head = await at(["ls-remote", "origin", "HEAD"]).then(
          ({ stdout }) => stdout,
          () => null,
        );
        if (head !== null) break;
      }
      if (head === null) throw unreachable();
      if (token === null && tokens.length) {
        console.error(
          `GitHub refused ${tokens.length == 1 ? "a token" : `${tokens.length} tokens`} (ending ${tokens.map((t) => t.slice(-4)).join(", ")}) but let ${repository.path} be cloned without one; check NUXT_GITHUB_TOKENS`,
        );
        for (const refused of tokens)
          refusedTokens.set(refused, Date.now() + REFUSED_TOKEN_MS);
      }

      // The latest is what HEAD points at
      if (!commit) {
        commit = /^([0-9a-f]{40})\s/.exec(head)?.[1] ?? null;
        if (!commit)
          throw createError({
            statusCode: 422,
            statusMessage: `${repository.host}/${repository.path} doesn't have any commits yet`,
          });
      }

      // Just that commit, if the host lets it be asked for by its SHA (GitHub and GitLab
      // do). Otherwise the default branch's latest, which is usually it; failing that,
      // the whole history without its files, which come with the checkout.
      const fetched =
        (await at(["fetch", "-q", "--depth", "1", "origin", commit]).then(
          () => true,
          () => false,
        )) ||
        (await at(["fetch", "-q", "--depth", "1", "origin", "HEAD"]).then(
          async () =>
            (await at(["rev-parse", "FETCH_HEAD"])).stdout.trim() == commit,
          () => false,
        )) ||
        (await at([
          "fetch",
          "-q",
          "--filter=blob:none",
          "--no-tags",
          "origin",
        ]).then(
          async () =>
            (
              await at(["cat-file", "-t", commit!]).catch(() => null)
            )?.stdout.trim() == "commit",
          () => false,
        ));
      if (!fetched)
        throw createError({
          statusCode: 422,
          statusMessage: `Couldn't fetch ${commit} from ${repository.host}/${repository.path}`,
        });
      await at(["checkout", "-q", "--detach", commit]);

      return await use(clone, commit);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

// Clones the repository at the commit (its latest if that's null) and packs it as a
// .tar.gz, after checking the entry's a file in it. Returns the commit it's at.
export async function archiveRepository(
  repository: Repository,
  commit: string | null,
  entry: string,
) {
  return withClone(repository, commit, async (clone, at) => {
    // A file, and not a link out of the repository
    const path = join(clone, entry);
    const info = await lstat(path).catch(() => null);
    const real = info && (await realpath(path).catch(() => null));
    if (
      !info ||
      (!info.isFile() && !info.isSymbolicLink()) ||
      !real ||
      !real.startsWith(clone + sep) ||
      !(await lstat(real)).isFile()
    ) {
      throw createError({
        statusCode: 422,
        statusMessage: `${entry} isn't a file in ${repository.path} at ${at.slice(0, 7)}`,
      });
    }

    const archive = join(clone, "..", "repo.tar.gz");
    await run(
      "tar",
      [
        "-czf",
        archive,
        "--owner=0",
        "--group=0",
        "--numeric-owner",
        "-C",
        clone,
        ".",
      ],
      { timeout: GIT_TIMEOUT_MS },
    );
    const data = await readFile(archive);
    if (data.length > MAX_ARCHIVE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: `The repository is too big for a demo (over ${MAX_ARCHIVE_BYTES / 1024 / 1024} MB packed)`,
      });
    }
    return { commit: at, archive: data };
  });
}

// A file in a repository, for picking the one a demo runs: whether it's executable, its
// size, and its shebang line ("#!/usr/bin/env fish") if it starts with one
export interface RepositoryFile {
  path: string;
  executable: boolean;
  size: number;
  shebang: string | null;
}

// The files in the repository at its latest commit (folders aren't listed, nor links), and
// whether there were more than could be listed. Kept for a little while, so opening the
// picker again doesn't clone it again.
const listed = new Map<
  string,
  Promise<{ commit: string; files: RepositoryFile[]; truncated: boolean }>
>();
export function listRepositoryFiles(repository: Repository) {
  const key = `${repository.host}/${repository.path}`;
  const known = listed.get(key);
  if (known) return known;

  const listing = withClone(repository, null, async (clone, commit) => {
    const { stdout } = await run(
      "git",
      ["-C", clone, "ls-tree", "-r", "-z", "--long", "HEAD"],
      { timeout: GIT_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024, env: GIT_ENV },
    );
    const entries = stdout.split("\0").filter(Boolean);
    const files: RepositoryFile[] = [];
    for (const line of entries) {
      // "<mode> blob <object> <size>\t<path>"
      const match = /^(\d+) (\w+) [0-9a-f]+ +(-|\d+)\t(.*)$/s.exec(line);
      if (!match || match[2] != "blob" || match[1] == "120000") continue;
      if (files.length == MAX_FILES) break;
      const path = match[4]!;
      const size = Number(match[3]) || 0;
      files.push({
        path,
        executable: match[1] == "100755",
        size,
        shebang: size ? await readShebang(join(clone, path)) : null,
      });
    }
    return {
      commit,
      files,
      truncated: entries.length > files.length && files.length == MAX_FILES,
    };
  });
  listed.set(key, listing);
  // Forgotten after a while, or straight away if it failed
  listing.then(
    () => setTimeout(() => listed.delete(key), FILES_TTL_MS),
    () => listed.delete(key),
  );
  return listing;
}

// A file's first line, if it's a shebang ("#!..."), cut to a sensible length
async function readShebang(path: string) {
  const file = await open(path).catch(() => null);
  if (!file) return null;
  try {
    const buffer = Buffer.alloc(128);
    const { bytesRead } = await file.read(buffer, 0, 128, 0);
    const head = buffer.subarray(0, bytesRead).toString("utf8");
    return head.startsWith("#!") ? head.split(/\r?\n/)[0]!.trim() : null;
  } finally {
    await file.close();
  }
}

// Runs `task` once fewer than MAX_CLONES are running
let running = 0;
const waiting: (() => void)[] = [];
async function inTurn<T>(task: () => Promise<T>): Promise<T> {
  if (running >= MAX_CLONES)
    await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await task();
  } finally {
    running--;
    waiting.shift()?.();
  }
}
