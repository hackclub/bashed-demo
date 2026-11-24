// A path within a repository, for a URL: each part encoded, the slashes kept
export function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

// CheerpX, which runs the demos' machines, credited on the pages
export const CHEERPX_SITE = "https://cheerpx.io/";

// Where a demo page notes, for the tab's next load, that the visitor restarted the demo (and
// so has already agreed to run it)
export function restartKey(demo: { id: string; commit: string }) {
  return `bashed-demo-restart:${demo.id}:${demo.commit}`;
}
