<template>
  <!-- While the demo's machine gets ready: Bashed's logo, with a spinner under it -->
  <div class="grid min-h-dvh place-items-center p-6" role="status">
    <div class="flex flex-col items-center gap-12">
      <img src="/logo.svg" alt="Bashed" class="w-60 sm:w-80" />
      <span
        aria-hidden="true"
        class="size-10 rounded-full border-4 border-primary/20 border-t-primary motion-safe:animate-spin"
      />
      <span class="sr-only">Getting the demo ready</span>
    </div>
  </div>
</template>
