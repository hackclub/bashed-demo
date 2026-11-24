<template>
  <!-- Only seen in development: everywhere else it's a redirect to Bashed -->
  <div class="grid min-h-dvh place-items-center p-6">
    <h1 class="text-4xl font-extrabold">bashed demos</h1>
  </div>
</template>

<script setup lang="ts">
// Demos are opened from their projects on Bashed, so there's nothing to show here
if (!import.meta.dev) {
  await navigateTo(useRuntimeConfig().public.bashedUrl, {
    external: true,
    redirectCode: 302,
  });
}
</script>
