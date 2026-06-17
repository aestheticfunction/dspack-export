<script lang="ts">
import { defineComponent } from 'vue'

/**
 * A small status badge built on Vuetify's v-chip. Demonstrates the Options API
 * extraction path with an explicit name option and emits.
 */
export default defineComponent({
  name: 'StatusBadge',
  props: {
    label: { type: String, required: true },
    count: { type: Number, default: 0 },
    variant: { type: String, default: 'info' },
  },
  emits: ['dismiss', 'update:modelValue'],
})
</script>

<template>
  <v-chip>{{ label }}</v-chip>
</template>
