<template>
  <div class="action-menu">
    <div class="action-menu__label ui-label">actions</div>

    <div v-if="actions.length === 0" class="action-menu__empty">
      nothing to do here
    </div>

    <div v-else class="action-menu__list">
      <button
        v-for="action in sortedActions"
        :key="action.id"
        class="action-item"
        :class="{ 'action-item--disabled': !action.available }"
        :disabled="!action.available || isResolving"
        :title="action.available ? formatTimeCost(action.timeCost) : disabledReason(action)"
        @click="executeAction(action)"
      >
        {{ action.label }}
        <span v-if="action.timeCost > 0" class="action-time-cost">
          {{ formatTimeCost(action.timeCost) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useGameStore } from '../../stores/game.js'
import { meetsRequirements } from '../../engine/actions.js'

const game = useGameStore()
const gameLoop = inject('gameLoop')

/** Prevent double-clicks during resolution */
const isResolving = ref(false)

const actions = computed(() => game.availableActions)

/** Sort: available first by weight desc, then disabled by weight desc */
const sortedActions = computed(() => {
  const available = actions.value
    .filter((a) => a.available)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  const disabled = actions.value
    .filter((a) => !a.available)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  return [...available, ...disabled]
})

async function executeAction(action) {
  if (!action.available || isResolving.value || !gameLoop) return
  isResolving.value = true
  try {
    gameLoop.resolvePlayerAction(action)
  } finally {
    isResolving.value = false
  }
}

function disabledReason(action) {
  if (!game.player) return 'not available'
  const { meets, reason } = meetsRequirements(game.player, action, game.time)
  if (!meets && reason) return reason
  return 'not available'
}

function formatTimeCost(ticks) {
  if (!ticks) return ''
  const minutes = ticks * 15
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
}
</script>

<style lang="scss" scoped>
.action-menu {
  padding: 16px;
}

.action-menu__label {
  font-size: 10px;
  color: #555548;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.action-menu__empty {
  font-size: 13px;
  color: #555548;
  font-family: 'Courier New', monospace;
  font-style: italic;
}

.action-menu__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-item {
  font-family: 'Courier New', monospace;
  font-size: 13px;
  color: #7aad5a;
  background: none;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
  padding: 4px 8px;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: border-color 150ms ease, background-color 150ms ease;

  &:hover:not(:disabled) {
    border-color: #3d5a2e;
    background-color: #1a1a1a;
  }

  &:focus {
    outline: 1px solid #7aad5a;
  }

  &.action-item--disabled,
  &:disabled {
    color: #555548;
    cursor: not-allowed;

    &:hover {
      border-color: transparent;
      background: none;
    }
  }
}

.action-time-cost {
  font-size: 11px;
  color: #555548;
  margin-left: 4px;
  flex-shrink: 0;
}
</style>
