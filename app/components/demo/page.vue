<template>
  <!-- Held to the screen while the step changes, so the steps' movement past its edges
       doesn't bring up scroll bars -->
  <div :class="{ 'h-dvh overflow-hidden': switching }">
    <!-- Each step gives way to the next: the old one fades as it swells a little, the new one
         springs up into place (just fades with reduced motion) -->
    <Transition
      name="phase"
      mode="out-in"
      @before-leave="switching = true"
      @after-enter="switching = false"
      @enter-cancelled="switching = false"
    >
      <!-- A preview's two minutes are up: its machine's gone -->
      <div
        v-if="ended"
        class="grid min-h-dvh place-items-center p-6 text-center"
      >
        <div class="max-w-md space-y-4">
          <h1 class="text-3xl font-extrabold">this preview has ended</h1>
          <p class="text-white/70">
            Previews last two minutes. You can try it again from your project on
            Bashed.
          </p>
          <UiButton
            v-if="!embedded"
            :to="bashedUrl"
            variant="secondary"
            icon="solar:arrow-left-bold"
            >go to Bashed</UiButton
          >
        </div>
      </div>

      <!-- Getting the machine ready (downloading CheerpX and the repository). Nothing runs. -->
      <DemoLoading v-else-if="!accepted && machineState == 'loading'" />

      <!-- It can't run here, or getting it ready went wrong. In a frame, the browser may
           just not let a frame run it (only Chromium can isolate one in a page that isn't),
           so it offers a tab of its own, where it can. -->
      <div
        v-else-if="
          !accepted &&
          (machineState == 'unsupported' || machineState == 'failed')
        "
        class="grid min-h-dvh place-items-center p-6 text-center"
      >
        <div class="max-w-md space-y-4">
          <h1 class="text-3xl font-extrabold">
            {{
              machineState == "failed"
                ? "it didn't load"
                : embedded
                  ? "it can't run in here"
                  : "this browser can't run demos"
            }}
          </h1>
          <p class="text-white/70">
            {{
              machineState == "failed"
                ? failure
                : embedded
                  ? "This browser doesn't let a demo run inside another page. It can in a tab of its own."
                  : "It needs WebAssembly and cross-origin isolation. Try an up to date Chrome, Firefox or Safari."
            }}
          </p>
          <UiButton
            v-if="machineState == 'failed'"
            variant="secondary"
            icon="solar:restart-bold"
            @click="machine.prepare()"
            >try again</UiButton
          >
          <UiButton
            v-else-if="embedded"
            :to="route.fullPath"
            target="_blank"
            include-edge
            icon="solar:square-top-down-bold"
            >open it in a new tab</UiButton
          >
        </div>
      </div>

      <!-- Nothing runs until the visitor's read this and said so, every time. Centred, with
           a footer saying what runs the machine. -->
      <div v-else-if="!accepted" class="flex min-h-dvh flex-col">
        <div
          class="grid flex-1 grid-cols-[minmax(0,1fr)] place-items-center p-4 sm:p-6"
        >
          <DemoWarning :demo="demo!" @accept="accepted = true" />
        </div>
        <footer class="px-4 pb-6 text-center text-sm text-white/50">
          VM powered by
          <NuxtLink :to="CHEERPX_SITE" external target="_blank"
            >CheerpX</NuxtLink
          >
        </footer>
      </div>

      <!-- Running. In Bashed's frame, without the status line: Bashed shows the time left
           around the frame itself. -->
      <DemoRunning
        v-else
        :demo="demo!"
        :machine="machine"
        :seconds-left="secondsLeft"
        :status-line="!(kind == 'framed' && embedded)"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { DemoKind } from "#shared/utils/repo-hosts";

// Which kind of demo the page is for: /<id> shows shipped ones, /framed/<id> previews
const props = defineProps<{ kind: DemoKind }>();

const route = useRoute();
const { bashedUrl } = useRuntimeConfig().public;

const { data: demo, error } = await useFetch<Demo>(
  () => `/api/demos/${route.params.id}`,
);
if (error.value || !demo.value || demo.value.kind != props.kind) {
  throw createError({
    statusCode: error.value?.statusCode ?? 404,
    statusMessage: error.value?.statusMessage,
    fatal: true,
  });
}

// Got ready while the logo shows, so it starts as soon as the visitor says to
const machine = useDemoMachine(demo.value);
const { state: machineState, failure } = machine;

const accepted = ref(false);
// While one step's giving way to the next
const switching = ref(false);

// Whether it's in a frame: a preview tried from its project on Bashed (the only site
// allowed to frame it, see server/middleware/headers.ts)
const embedded = ref(false);

// Back from the visitor restarting the demo (a reload, see DemoRunning): they've agreed to
// run it in this tab already, so it runs again as soon as the machine's ready
const restarted = ref(false);

onMounted(() => {
  embedded.value = window.self !== window.top;
  const key = restartKey(demo.value!);
  restarted.value = sessionStorage.getItem(key) != null;
  sessionStorage.removeItem(key);
  machine.prepare();
});
onBeforeUnmount(() => machine.stop());

// A preview runs without the warning: it's its author trying their own code (in Bashed's
// frame, or in a tab of its own from there), at a link nobody else has, for two minutes
watch(machineState, (state) => {
  if (state == "ready" && (restarted.value || props.kind == "framed"))
    accepted.value = true;
});

// A preview's time left, ticking down each second; null for a shipped demo, which doesn't
// end. When it's up, the machine's thrown away.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  now.value = Date.now();
  if (demo.value?.expiresAt)
    ticker = setInterval(() => (now.value = Date.now()), 1000);
});
onBeforeUnmount(() => clearInterval(ticker));
const secondsLeft = computed(() =>
  demo.value?.expiresAt
    ? Math.max(
        0,
        Math.ceil((Date.parse(demo.value.expiresAt) - now.value) / 1000),
      )
    : null,
);
const ended = computed(() => secondsLeft.value === 0);
watch(ended, (over) => {
  if (!over) return;
  clearInterval(ticker);
  machine.stop();
});

useHead({ title: () => demo.value?.name ?? "" });
</script>
