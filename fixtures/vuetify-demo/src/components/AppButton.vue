<script setup lang="ts">
/**
 * Primary action button. Thin wrapper over Vuetify's v-btn that exposes a
 * curated, design-system-approved prop and event surface.
 */
interface Props {
  /** Visual style of the button. */
  variant?: 'primary' | 'secondary' | 'tonal'
  /** Theme color token name. */
  color?: string
  /** Disable interaction. */
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  color: 'primary',
  disabled: false,
})

defineEmits<{
  (e: 'click', payload: MouseEvent): void
}>()
</script>

<template>
  <v-btn
    :variant="variant"
    :color="color"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </v-btn>
</template>
