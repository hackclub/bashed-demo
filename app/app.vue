<template>
  <NuxtPage />
</template>

<script setup lang="ts">
useHead({
  titleTemplate: (title) =>
    title ? `${title} · Bashed demos` : "Bashed demos",
});
</script>
