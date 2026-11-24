<template>
  <!-- The demo running: its machine's console in xterm.js, filling the space it's given, on
       whatever's behind it (its background is see-through) -->
  <div class="relative h-full min-h-0">
    <div ref="screen" class="h-full" />

    <!-- Over the terminal once something's gone wrong -->
    <div
      v-if="state == 'failed'"
      class="absolute inset-0 grid place-items-center bg-frame/85 p-6 text-center backdrop-blur-sm"
    >
      <div class="max-w-md space-y-2">
        <p class="font-gummy text-xl font-extrabold">it stopped working</p>
        <p class="text-sm text-white/70">{{ failure }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import "@xterm/xterm/css/xterm.css";
import type { Terminal } from "@xterm/xterm";

const props = defineProps<{ machine: DemoMachine }>();

// Where it's at, for the page to show: running, over (the visitor left the shell it ends
// in), or failed
const state = defineModel<"running" | "ended" | "failed">("state", {
  default: "running",
});
const failure = ref("");

const screen = useTemplateRef("screen");
let term: Terminal | undefined;

// Stops the logo shown while the machine boots
let stopLogo = () => {};

onMounted(async () => {
  term = await openTerminal();
  term.focus();
  stopLogo = await startLogoShimmer(term, screen.value!);
  try {
    await props.machine.start(term, () => stopLogo());
    state.value = "ended";
  } catch (error) {
    console.error(error);
    failure.value =
      (error instanceof Error ? error.message : String(error ?? "")) ||
      "Something went wrong.";
    state.value = "failed";
  }
});
onUnmounted(() => {
  stopLogo();
  term?.dispose();
});

async function openTerminal() {
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import("@xterm/xterm"),
    import("@xterm/addon-fit"),
    // Its font, loaded before it measures its cells
    document.fonts.load('15px "Adwaita Mono"').catch(() => {}),
    document.fonts.load('bold 15px "Adwaita Mono"').catch(() => {}),
  ]);
  // Small enough that 80 columns fit on a phone, so full-screen scripts have room
  const width = screen.value!.clientWidth;
  const fontSize = Math.max(8, Math.min(15, Math.floor(width / 80 / 0.6)));
  const t = new Terminal({
    fontSize,
    fontFamily: '"Adwaita Mono", ui-monospace, monospace',
    cursorBlink: true,
    convertEol: true,
    // See-through, so it sits on whatever the page puts behind it
    allowTransparency: true,
    theme: {
      background: "#00000000",
      foreground: "#ffffff",
      cursor: "#61d2ff",
      cursorAccent: "#1b1d22",
      selectionBackground: "#61d2ff55",
    },
  });
  const fit = new FitAddon();
  t.loadAddon(fit);
  t.open(screen.value!);
  // Fitted once: the machine's told its size when it starts, and isn't told of changes
  fit.fit();
  return t;
}
</script>
