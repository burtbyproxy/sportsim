<template>
  <footer class="game-footer">
    <span class="footer-status">{{ statusText }}</span>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../../stores/game.js'

const game = useGameStore()

const statusText = computed(() => {
  if (!game.isRunning) return 'no active game'
  if (!game.currentLocation) return '...'
  return game.currentLocation.display ?? game.currentLocationId
})
</script>

<style lang="scss" scoped>
.game-footer {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 16px;
  background: #111111;
  border-top: 1px solid #2a2a2a;
}

.footer-status {
  font-size: 11px;
  color: #555548;
  font-family: 'Courier New', monospace;
  text-transform: lowercase;
}
</style>
