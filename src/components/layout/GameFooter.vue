<template>
  <footer class="game-footer">
    <span class="footer-hint">{{ hint }}</span>
  </footer>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../../stores/game.js'

const game = useGameStore()

const hint = computed(() => {
  if (!game.isRunning) return 'no active game'
  return '1–9 actions · a–z go · space skip'
})
</script>

<style lang="scss" scoped>
@use '../../scss/variables' as *;

.game-footer {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 $spacing-md;
  background: $color-bg-surface;
  border-top: 1px solid $color-border-accent;
}

.footer-hint {
  font-size: 10px;
  color: $color-text-muted;
  font-family: $font-mono;
  letter-spacing: 0.5px;
  opacity: 0.6;
}
</style>
