// Where a demo's repository can be: the same hosts as Bashed's projects
export const REPO_HOSTS = [
  { host: "github.com", name: "GitHub" },
  { host: "gitlab.com", name: "GitLab" },
  { host: "codeberg.org", name: "Codeberg" },
] as const;
export type RepoHost = (typeof REPO_HOSTS)[number]["host"];

// How a demo's shown: a preview in a frame on Bashed, or a shipped project's
export const DEMO_KINDS = ["framed", "shipped"] as const;
export type DemoKind = (typeof DEMO_KINDS)[number];

// A file in a repository at a commit, for a URL: each part encoded, the slashes kept
function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

// Links to a repository at a commit on its host: the repository, a file in it and the commit
// itself. Each host has its own way of writing them.
export function repoLinks(
  { host, path, commit }: { host: RepoHost; path: string; commit: string },
  file: string,
) {
  const repo = `https://${host}/${path}`;
  const encoded = encodePath(file);
  if (host == "gitlab.com")
    return {
      repo: `${repo}/-/tree/${commit}`,
      file: `${repo}/-/blob/${commit}/${encoded}`,
      commit: `${repo}/-/commit/${commit}`,
    };
  if (host == "codeberg.org")
    return {
      repo: `${repo}/src/commit/${commit}`,
      file: `${repo}/src/commit/${commit}/${encoded}`,
      commit: `${repo}/commit/${commit}`,
    };
  return {
    repo: `${repo}/tree/${commit}`,
    file: `${repo}/blob/${commit}/${encoded}`,
    commit: `${repo}/commit/${commit}`,
  };
}
