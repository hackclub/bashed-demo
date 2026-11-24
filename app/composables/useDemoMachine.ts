import type * as CheerpXTypes from "@leaningtech/cheerpx";
import type { IDisposable, Terminal } from "@xterm/xterm";

// The same version as @leaningtech/cheerpx in package.json, which only loads this from
// Leaning Technologies' CDN (and gives the types). Imported straight from there, so the
// bundler doesn't have to deal with the package's top-level await.
const CHEERPX_URL = "https://cxrtnc.leaningtech.com/1.4.0/cx.esm.js";
// Where the machine's writes are kept: a fresh IndexedDB per run, cleared afterwards, so one
// demo can't leave anything behind for the next
const SESSION_PREFIX = "bashed-demo-session-";

// A demo's Linux machine (CheerpX), in this tab. `prepare()` gets it ready (downloads
// CheerpX and the repository, sets up the disk) without running anything; `start()` runs the
// demo on a terminal once the visitor's agreed to; `stop()` throws the machine away.
export function useDemoMachine(demo: Demo) {
  const state = ref<"loading" | "ready" | "failed" | "unsupported">("loading");
  const failure = ref("");

  let cx: CheerpXTypes.Linux | undefined;
  let session: CheerpXTypes.IDBDevice | undefined;
  let releaseLock: (() => void) | undefined;
  // The terminal's keys going to the machine, while it runs
  let input: IDisposable | undefined;
  // Bumped by stop(), so a prepare() still under way knows to give up
  let generation = 0;

  async function prepare() {
    const current = ++generation;
    const stale = () => current != generation;
    state.value = "loading";
    if (!window.crossOriginIsolated || typeof WebAssembly != "object") {
      state.value = "unsupported";
      return;
    }

    try {
      const [CheerpX, packed, disk] = await Promise.all([
        import(/* @vite-ignore */ CHEERPX_URL) as Promise<typeof CheerpXTypes>,
        fetchArchive(),
        $fetch("/api/disk"),
      ]);
      if (stale()) return;

      // Each run gets its own IndexedDB for the disk's changes, held with a lock while it's
      // used, so ones left by closed tabs can be told apart and cleared out
      const name = SESSION_PREFIX + crypto.randomUUID();
      releaseLock = await holdLock(name);
      await clearOldSessions();

      const base = await CheerpX.HttpBytesDevice.create(disk.url);
      session = await CheerpX.IDBDevice.create(name);
      const root = await CheerpX.OverlayDevice.create(base, session);
      const data = await CheerpX.DataDevice.create();
      await data.writeFile("/repo.tar.gz", packed);
      if (stale()) return;

      const linux = await CheerpX.Linux.create({
        mounts: [
          { type: "ext2", path: "/", dev: root },
          // Written from here (the repository), read-only inside
          { type: "dir", path: "/data", dev: data },
          { type: "devs", path: "/dev" },
          { type: "devpts", path: "/dev/pts" },
          { type: "proc", path: "/proc" },
          { type: "sys", path: "/sys" },
        ] as never,
      });
      if (stale()) {
        linux.delete();
        return;
      }
      cx = linux;
      state.value = "ready";
    } catch (error) {
      if (stale()) return;
      console.error(error);
      // CheerpX's errors aren't always Errors
      failure.value =
        (error instanceof Error ? error.message : String(error ?? "")) ||
        "Something went wrong getting it ready.";
      state.value = "failed";
    }
  }

  // Runs the demo with its console on the terminal. Resolves when it's over (the visitor
  // left the shell it ends in). `booted` is called just before the machine's first output.
  async function start(term: Terminal, booted?: () => void) {
    if (!cx) throw new Error("The machine isn't ready.");
    let quiet = true;
    const send = cx.setCustomConsole(
      (buffer, vt) => {
        if (vt != 1) return;
        if (quiet) {
          quiet = false;
          booted?.();
        }
        term.write(new Uint8Array(buffer));
      },
      term.cols,
      term.rows,
    );
    // CheerpX takes the input a byte at a time
    const encoder = new TextEncoder();
    input?.dispose();
    const keys = (input = term.onData((text) => {
      for (const byte of encoder.encode(text)) send(byte);
    }));
    try {
      await cx.run("/usr/local/bin/bashed-demo", [demo.name, demo.entry], {
        env: [
          "HOME=/home/user",
          "USER=user",
          "LOGNAME=user",
          "SHELL=/bin/bash",
          "TERM=xterm-256color",
          "COLORTERM=truecolor",
          "LANG=C.UTF-8",
          "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/usr/games",
        ],
        cwd: "/home/user",
        uid: 1000,
        gid: 1000,
      });
    } finally {
      keys.dispose();
    }
  }

  function stop() {
    generation++;
    input?.dispose();
    input = undefined;
    try {
      cx?.delete();
    } catch {}
    cx = undefined;
    session?.reset().catch(() => {});
    session = undefined;
    releaseLock?.();
    releaseLock = undefined;
    // Including this one's, now its lock's gone (deleted once CheerpX lets go of it)
    clearOldSessions().catch(() => {});
  }

  async function fetchArchive() {
    const response = await fetch(
      `/api/demos/${demo.id}/archive?commit=${demo.commit}`,
    );
    if (!response.ok) throw new Error("Couldn't download the repository.");
    return new Uint8Array(await response.arrayBuffer());
  }

  return { state, failure, prepare, start, stop };
}

export type DemoMachine = ReturnType<typeof useDemoMachine>;

// Holds a Web Lock named after the session until the returned function's called (or the tab
// closes)
function holdLock(name: string) {
  return new Promise<() => void>((resolve) => {
    navigator.locks.request(
      name,
      () => new Promise<void>((release) => resolve(release)),
    );
  });
}

// Deletes the IndexedDBs of sessions nobody holds a lock on any more (tabs that closed
// before they could clean up)
async function clearOldSessions() {
  if (!indexedDB.databases) return;
  const [databases, locks] = await Promise.all([
    indexedDB.databases(),
    navigator.locks.query(),
  ]);
  const held = new Set(locks.held?.map((lock) => lock.name));
  for (const { name } of databases) {
    const session = name?.match(new RegExp(`${SESSION_PREFIX}[0-9a-f-]+`))?.[0];
    if (name && session && !held.has(session)) indexedDB.deleteDatabase(name);
  }
}
