<script setup lang="ts">
/**
 * Form field that renders either a text field or a select. Demonstrates an
 * inline type-literal defineProps (no withDefaults), an enum-like prop, and
 * update:modelValue event normalization.
 */
defineProps<{
  modelValue?: string
  /** Which input control to render. */
  kind: 'text' | 'select'
  required?: boolean
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <v-text-field v-if="kind === 'text'" :model-value="modelValue" />
  <v-select v-else :model-value="modelValue" />
</template>
