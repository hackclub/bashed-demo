<template>
  <component
    :is="to ? NuxtLink : 'button'"
    :to="to ?? undefined"
    :type="to ? undefined : type"
    class="group relative inline-flex h-11.25 items-center justify-center rounded-button px-4.75 font-extrabold leading-none no-underline transition-[translate,box-shadow,opacity,border-radius,scale,filter] cursor-pointer motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-safe:active:duration-100 hover:rounded-[22px_6px_22px_6px] disabled:cursor-not-allowed disabled:rounded-button disabled:opacity-50"
    :class="[
      raised
        ? 'hover:translate-y-0.5 active:translate-y-[7px] active:shadow-none after:absolute after:inset-x-0 after:-top-[7px] after:-bottom-[7px]'
        : 'bg-secondary text-white hover:brightness-110 active:scale-[0.97]',
      {
        'bg-primary text-background shadow-[0_7px_0_var(--color-primary-shadow)] hover:shadow-[0_5px_0_var(--color-primary-shadow)]':
          variant === 'primary',
        'bg-danger text-background shadow-[0_7px_0_var(--color-danger-shadow)] hover:shadow-[0_5px_0_var(--color-danger-shadow)]':
          variant === 'red',
        'mb-[7px]': includeEdge && raised,
      },
    ]"
  >
    <!-- On raised buttons, an invisible ::after stretches the hover area over the edge and as
         far as the button moves, so hovering near its top or bottom doesn't make it flicker -->
    <!-- The background pattern tiles sideways, so wide buttons keep it going. Faint on
         secondary buttons, none on tertiary. -->
    <span
      v-if="variant !== 'tertiary'"
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-[inherit]"
    >
      <span
        v-for="tile in 3"
        :key="tile"
        class="relative shrink-0"
        :style="{ width: `${268 * scale}px`, height: `${102 * scale}px` }"
      >
        <!-- Each turns a little on hover, every other one the opposite way. Drawn through
             the shape's SVG as a mask, so they take the button's colour: a little darker
             than its face. -->
        <span
          v-for="(shape, i) in shapes"
          :key="shape.name"
          class="absolute -mt-3 [mask:var(--shape)_center/contain_no-repeat] [rotate:var(--rest)] group-hover:[rotate:var(--turned)] motion-safe:transition-[rotate] motion-safe:duration-500 motion-safe:ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          :class="[
            variant === 'red' ? 'bg-danger-pattern' : 'bg-[#4BC3F3]',
            { 'opacity-20': variant === 'secondary' },
          ]"
          :style="{
            '--shape': `url(/shapes/${shape.name}.svg)`,
            width: `${shape.size * scale}px`,
            height: `${shape.size * scale}px`,
            left: `${(shape.x - shape.size / 2) * scale}px`,
            top: `${(shape.y - shape.size / 2) * scale}px`,
            '--rest': `${shape.rotate}deg`,
            '--turned': `${shape.rotate + (i % 2 ? -20 : 20)}deg`,
          }"
        />
      </span>
    </span>
    <span class="relative inline-flex items-center gap-2">
      <Icon v-if="icon" :name="icon" size="22" />
      <slot />
    </span>
  </component>
</template>

<script setup lang="ts">
import { NuxtLink } from "#components";

const props = withDefaults(
  defineProps<{
    // Only primary (and red, for running someone's code past a warning) is raised, since
    // it's the main action. Secondary and tertiary are flat, tertiary without the shapes.
    variant?: "primary" | "red" | "secondary" | "tertiary";
    to?: string | null;
    type?: "button" | "submit";
    icon?: string;
    // Counts the primary button's raised edge as part of its size, so it lines up and
    // centres by everything you see rather than just its face
    includeEdge?: boolean;
  }>(),
  {
    variant: "primary",
    to: null,
    type: "button",
    icon: "",
    includeEdge: false,
  },
);

const raised = computed(
  () => props.variant === "primary" || props.variant === "red",
);

// Shrinks the whole pattern, so more of it fits on the button
const scale = 0.75;

// From the "primary button background" frame in Figma: each shape's centre within the 268×102 tile
const shapes = [
  { name: "circle", x: 166.7, y: 34.4, size: 26, rotate: -47 },
  { name: "triangle", x: 79.1, y: 77.2, size: 20, rotate: -17 },
  { name: "half-circle", x: 98.6, y: 23, size: 23, rotate: 54 },
  { name: "rhombus", x: 134.9, y: 82.6, size: 24, rotate: 57 },
  { name: "hexagon", x: 138.9, y: 15.7, size: 28, rotate: 8 },
  { name: "square", x: 32.9, y: 91.3, size: 22, rotate: 55 },
  { name: "square-2", x: 245.5, y: 42, size: 29, rotate: -39 },
  { name: "half-circle-2", x: 194.2, y: 87.1, size: 26, rotate: -13 },
  { name: "circle-2", x: 244.9, y: 97.3, size: 27, rotate: 51 },
  { name: "rhombus-2", x: 33.9, y: 42.7, size: 21, rotate: -17 },
  { name: "triangle-2", x: 207.9, y: 32.1, size: 29, rotate: -57 },
  { name: "hexagon-2", x: 0.8, y: 73.7, size: 27, rotate: -32 },
];
</script>
