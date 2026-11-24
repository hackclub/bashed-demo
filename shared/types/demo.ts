import type { DemoKind, RepoHost } from "../utils/repo-hosts";

// A demo as the site shows it (GET /api/demos/:id), and as Bashed sees it
export interface Demo {
  // A UUIDv6
  id: string;
  // A preview tried from Bashed ("framed", for five minutes), or a shipped project's
  kind: DemoKind;
  // The project's ID on Bashed
  project: number | null;
  // Its repository: where it is, its path there (e.g. "hackclub/bashed") and the last part
  // of that, which names its folder in the virtual machine
  host: RepoHost;
  path: string;
  name: string;
  // The full SHA of the commit it runs
  commit: string;
  // The file it runs, as a path within the repository
  entry: string;
  createdAt: string;
  // When a framed one ends; null for a shipped one
  expiresAt: string | null;
  // Its page on this site: /framed/<id> or /<id>
  page: string;
}
