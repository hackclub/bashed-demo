<template>
  <!-- The demo running: the terminal edge to edge, with a tmux-style status line along the
       bottom: Bashed, the repository, commit and file it runs (links, on phones just Bashed),
       a preview's time left, how it's doing, and a button to start it again. In Bashed's
       frame there's no status line: Bashed has its own around the frame. -->
  <div class="flex h-dvh flex-col">
    <div class="min-h-0 flex-1 p-2 sm:p-3">
      <DemoTerminal v-model:state="state" :machine="machine" />
    </div>

    <footer
      v-if="statusLine"
      class="flex h-8 shrink-0 items-stretch overflow-hidden font-mono text-sm"
    >
      <NuxtLink
        :to="bashedUrl"
        external
        target="_blank"
        class="flex items-center bg-primary px-3 font-bold text-background no-underline"
        >bashed</NuxtLink
      >
      <NuxtLink
        v-for="(segment, i) in segments"
        :key="segment.label"
        :to="segment.to"
        external
        target="_blank"
        class="hidden items-center gap-1.5 px-3 text-white no-underline transition-[filter] hover:brightness-125 sm:flex"
        :class="i == 0 ? 'bg-secondary' : 'bg-container'"
      >
        <Icon :name="segment.icon" size="14" class="text-primary" />
        {{ segment.label }}
      </NuxtLink>
      <span class="flex-1 bg-background" />
      <span
        v-if="secondsLeft != null"
        class="flex items-center gap-1.5 bg-background px-3 tabular-nums"
        :class="secondsLeft <= 20 ? 'text-amber-300' : 'text-white/70'"
        :title="`This preview ends in ${secondsLeft} seconds`"
      >
        <Icon name="solar:stopwatch-bold" size="14" />
        {{ clock(secondsLeft) }}
      </span>
      <span class="flex items-center gap-2 bg-background px-3 text-white/70">
        <span class="size-2 rounded-full" :class="status.dot" />
        {{ status.label }}
      </span>
      <button
        type="button"
        class="flex cursor-pointer items-center gap-1.5 bg-secondary px-3 font-bold transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="restarting"
        @click="restart"
      >
        <Icon name="solar:restart-bold" size="14" />
        restart
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { repoLinks } from "#shared/utils/repo-hosts";

const props = withDefaults(
  defineProps<{
    demo: Demo;
    machine: DemoMachine;
    // For a framed demo, how many seconds it has left
    secondsLeft?: number | null;
    // Whether the status line's there (not in Bashed's frame, which has its own)
    statusLine?: boolean;
  }>(),
  { secondsLeft: null, statusLine: true },
);

const { bashedUrl } = useRuntimeConfig().public;

const state = ref<"running" | "ended" | "failed">("running");

// Starting again is a fresh machine, which CheerpX only gives a fresh page (making a second
// one in the same page fails, and it downloads a "fail.wasm" about it), so the page reloads
// and goes straight back to running the demo: the visitor's already agreed to it in this
// tab (see the demo page)
const restarting = ref(false);
function restart() {
  restarting.value = true;
  sessionStorage.setItem(restartKey(props.demo), "1");
  location.reload();
}

// The repository, commit and file it runs, all at that commit
const segments = computed(() => {
  const { path, commit, entry } = props.demo;
  const to = repoLinks(props.demo, entry);
  return [
    { label: path, to: to.repo, icon: "solar:folder-with-files-bold" },
    { label: commit.slice(0, 7), to: to.commit, icon: "solar:history-bold" },
    { label: entry, to: to.file, icon: "solar:file-text-bold" },
  ];
});

// Seconds as minutes and seconds, e.g. 1:05
function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// How it's doing: green while it runs, amber while it starts again, red if it failed, grey
// once it's over
const status = computed(() =>
  restarting.value
    ? { label: "starting again", dot: "bg-amber-300" }
    : {
        running: { label: "running", dot: "bg-emerald-300" },
        failed: { label: "stopped working", dot: "bg-red-300" },
        ended: { label: "finished", dot: "bg-white/40" },
      }[state.value],
);
</script>
