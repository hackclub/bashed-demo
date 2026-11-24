<template>
  <div class="grid min-h-dvh place-items-center p-6 text-center">
    <div class="space-y-4">
      <h1 class="text-4xl font-extrabold">{{ copy.title }}</h1>
      <p class="text-white/70">{{ copy.text }}</p>
      <!-- Not in a frame on Bashed, which can't be shown in one -->
      <UiButton v-if="!embedded" :to="bashedUrl" variant="secondary"
        >go to Bashed</UiButton
      >
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();

const { bashedUrl } = useRuntimeConfig().public;

// A demo that isn't there, a preview that's run out ("Gone"), or anything else
const copy = computed(() =>
  props.error.statusCode == 404
    ? {
        title: "no demo here",
        text: "It may have been taken down, or the link's wrong.",
      }
    : props.error.statusCode == 410
      ? {
          title: "this preview has ended",
          text: "Previews last five minutes. You can try it again from your project on Bashed.",
        }
      : {
          title: "something broke",
          text: props.error.statusMessage || props.error.message,
        },
);

const embedded = ref(false);
onMounted(() => (embedded.value = window.self !== window.top));
</script>
