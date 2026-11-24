import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/fonts", "@nuxt/icon/module"],
  compatibilityDate: "2025-07-15",
  app: {
    head: {
      link: [
        { rel: "icon", type: "image/png", href: "/favicon.png" },
        { rel: "apple-touch-icon", href: "/favicon.png" },
      ],
    },
  },
  devtools: { enabled: true },

  runtimeConfig: {
    // Server-only; can also be overridden at runtime with NUXT_DATABASE_URL
    databaseUrl: process.env.DATABASE_URL,
    // Shared with Bashed, which signs its requests to /api/demos with it (see
    // server/utils/bashed.ts); overridable with NUXT_BASHED_SECRET
    bashedSecret: process.env.BASHED_SECRET ?? "",
    // The virtual machine's disk, built with `pnpm disk:build` (the Docker image has its own,
    // see the Dockerfile); overridable with NUXT_DISK_PATH
    diskPath: process.env.DISK_PATH ?? ".data/disk/disk.ext2",
    // Optional GitHub tokens, separated by commas, for cloning from GitHub without running
    // into its limit on clones without a login (see server/utils/repository.ts). Demos must
    // only come from public repositories, so give fine-grained tokens with public
    // repositories only and no permissions. Overridable with NUXT_GITHUB_TOKENS.
    githubTokens: process.env.GITHUB_TOKENS ?? "",
    public: {
      // Linked from the header; overridable with NUXT_PUBLIC_BASHED_URL
      bashedUrl: process.env.BASHED_URL ?? "https://bashed.hackclub.com",
    },
  },

  css: ["~/assets/css/main.css"],
  // Bashed's rounder font, only used extrabold
  fonts: {
    families: [{ name: "Sour Gummy", weights: [800], styles: ["normal"] }],
  },
  vite: {
    plugins: [tailwindcss()],
    // Only loaded once a demo starts, so Vite wouldn't find them until then (and reload)
    optimizeDeps: { include: ["@xterm/xterm", "@xterm/addon-fit"] },
  },
});
