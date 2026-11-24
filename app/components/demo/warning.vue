<template>
  <!-- Said before anything runs, in Bashed's red notice colours (UiNotice's red tone):
       what runs, four things to know as tiles with their icons on cookies, links to read the
       code at the exact commit that'll run, and the visitor agreeing to run it -->
  <section
    class="w-full max-w-2xl rounded-[44px_14px_44px_14px] bg-red-400/15 p-6 sm:p-9"
  >
    <h2 class="text-3xl font-extrabold text-red-300">before it runs</h2>
    <p class="mt-2 text-white/70">
      <span class="font-mono text-red-300">{{ demo.entry }}</span> from
      <span class="font-semibold text-white">{{ demo.path }}</span>
      at <span class="font-mono">{{ shortCommit }}</span>
    </p>

    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      <div
        v-for="(fact, i) in facts"
        :key="fact.title"
        class="flex gap-3 rounded-[22px] bg-frame p-4 motion-safe:animate-rise-in"
        :style="{ animationDelay: `${150 + i * 70}ms` }"
      >
        <span
          class="relative grid size-11 shrink-0 place-items-center text-background motion-safe:animate-pop-in"
          :style="{ animationDelay: `${280 + i * 70}ms` }"
        >
          <svg viewBox="0 0 100 100" class="absolute inset-0 text-red-300">
            <path :d="COOKIE_SHAPE" fill="currentColor" />
          </svg>
          <Icon :name="fact.icon" size="22" class="relative" />
        </span>
        <div>
          <p class="font-gummy text-lg leading-tight font-extrabold">
            {{ fact.title }}
          </p>
          <p class="mt-1 text-sm text-white/70">
            <template v-for="part in fact.text" :key="part.text">
              <NuxtLink
                v-if="part.to"
                :to="part.to"
                external
                target="_blank"
                class="text-red-300"
                >{{ part.text }}</NuxtLink
              >
              <template v-else>{{ part.text }}</template>
            </template>
          </p>
        </div>
      </div>
    </div>

    <div class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        external
        target="_blank"
        class="inline-flex items-center gap-1.5 text-red-300"
      >
        <Icon :name="link.icon" size="16" class="shrink-0" />
        {{ link.label }}
      </NuxtLink>
    </div>
    <UiButton
      variant="red"
      icon="solar:play-bold"
      include-edge
      class="mt-7"
      @click="emit('accept')"
      >I understand, run it</UiButton
    >
  </section>
</template>

<script setup lang="ts">
import { repoLinks } from "#shared/utils/repo-hosts";

const props = defineProps<{ demo: Demo }>();
const emit = defineEmits<{ accept: [] }>();

const { bashedUrl } = useRuntimeConfig().public;

const shortCommit = computed(() => props.demo.commit.slice(0, 7));

// All at the commit that runs, so what's read is what runs
const links = computed(() => {
  const to = repoLinks(props.demo, props.demo.entry);
  return [
    {
      label: "the repository",
      to: to.repo,
      icon: "solar:folder-with-files-bold",
    },
    { label: props.demo.entry, to: to.file, icon: "solar:file-text-bold" },
    {
      label: `commit ${shortCommit.value}`,
      to: to.commit,
      icon: "solar:history-bold",
    },
  ];
});

// What to know, one tile each. Their text is in parts, so a part can be a link.
const facts: {
  icon: string;
  title: string;
  text: { text: string; to?: string }[];
}[] = [
  {
    icon: "solar:user-rounded-bold",
    title: "someone else's code",
    text: [
      { text: "Made for " },
      { text: "Bashed", to: bashedUrl },
      { text: " by a teenager. It may not have been reviewed yet." },
    ],
  },
  {
    icon: "solar:laptop-bold",
    title: "runs in the browser",
    text: [
      {
        text: "Runs on a small Linux machine in your browser, and doesn't have access to your files.",
      },
    ],
  },
  {
    icon: "solar:cloud-cross-bold",
    title: "no internet",
    text: [{ text: "It won't be able to reach the internet." }],
  },
  {
    icon: "solar:trash-bin-trash-bold",
    title: "gone when you leave",
    text: [{ text: "The script is reset once you leave the page." }],
  },
];
</script>
