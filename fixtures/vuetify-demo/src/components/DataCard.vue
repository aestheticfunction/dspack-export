<script setup>
/**
 * Card that renders a Vuetify data table with header and footer slots.
 */
defineProps({
  title: { type: String, required: true },
  // A factory default is non-literal and intentionally left unextracted.
  rows: { type: Array, default: () => [] },
  dense: { type: Boolean, default: false },
})
</script>

<template>
  <v-card>
    <slot name="header" />
    <v-data-table :items="rows" :density="dense ? 'compact' : 'default'" />
    <slot name="footer" />
  </v-card>
</template>
