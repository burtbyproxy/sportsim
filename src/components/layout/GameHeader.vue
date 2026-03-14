<template>
  <header class="game-header">
    <span class="header-title">SportSim</span>
    <span class="header-location" v-if="currentLocation">
      <span class="header-sep">·</span>
      {{ currentLocation }}
    </span>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../../stores/game.js'

const game = useGameStore()

const currentLocation = computed(() => {
  if (!game.currentLocation) return null
  return game.currentLocation.display ?? game.currentLocationId
})
</script>

<style lang="scss" scoped>
@use '../../scss/variables' as *;

.game-header {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 $spacing-md;
  background: $color-bg-surface;
  border-bottom: 1px solid $color-border-accent;
  gap: 0;
}

.header-title {
  font-family: $font-mono;
  font-size: 11px;
  color: $color-text-muted;
  text-transform: lowercase;
  letter-spacing: 2px;
}

.header-sep {
  color: $color-text-muted;
  margin: 0 8px;
  opacity: 0.5;
}

.header-location {
  font-family: $font-mono;
  font-size: 11px;
  color: $color-text-muted;
  display: flex;
  align-items: center;
  opacity: 0.8;
}
</style>
