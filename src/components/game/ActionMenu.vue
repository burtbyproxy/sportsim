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
        :disabled="!action.available"
        :title="action.available ? '' : disabledReason(action)"
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
import { computed } from 'vue'
import { useGameStore } from '../../stores/game.js'

const game = useGameStore()

const actions = computed(() => game.availableActions)

/** Sort by weight descending, disabled actions at bottom */
const sortedActions = computed(() => {
  return [...actions.value].sort((a, b) => {
    if (a.available === b.available) {
      return (b.weight ?? 0) - (a.weight ?? 0)
    }
    return a.available ? -1 : 1
  })
})

function executeAction(action) {
  if (!action.available) return
  // Emit to parent or dispatch — action resolution is Bones' territory.
  // For now, advance time by action cost and emit.
  game.advanceTime(action.timeCost ?? 1)
  // Future: game.resolveAction(action.id)
}

function disabledReason(action) {
  if (!action.requirements) return 'not available'
  const reqs = action.requirements
  const status = game.player?.status ?? {}
  const stats = game.player?.stats ?? {}
  const parts = []

  if (reqs.minStats) {
    for (const [stat, min] of Object.entries(reqs.minStats)) {
      if ((stats[stat]?.base ?? 0) < min) {
        parts.push(`needs ${stat} ${min}`)
      }
    }
  }
  if (reqs.minSobriety !== null && status.sobriety < reqs.minSobriety) {
    parts.push(`too drunk`)
  }
  if (reqs.maxSobriety !== null && status.sobriety > reqs.maxSobriety) {
    parts.push(`need to be drunk`)
  }
  if (reqs.minHour !== null && game.time.hour < reqs.minHour) {
    parts.push(`not open yet`)
  }
  if (reqs.maxHour !== null && game.time.hour >= reqs.maxHour) {
    parts.push(`closed`)
  }

  return parts.length > 0 ? parts.join(', ') : 'not available'
}

function formatTimeCost(ticks) {
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
}
</style>
