<template>
  <div class="location-view">
    <!-- Location description via narrative renderer -->
    <!-- Description is enqueued on mount / location change — NarrativeLog handles display -->

    <!-- Exits -->
    <div v-if="exits.length > 0" class="location-exits">
      <div class="exits-label ui-label">exits</div>
      <div class="exits-list">
        <button
          v-for="exit in exits"
          :key="exit.locationId"
          class="exit-link"
          :disabled="exit.locked"
          :title="exit.locked ? exit.lockedReason : ''"
          @click="travel(exit)"
        >
          {{ exit.label }}
          <span v-if="exit.travelTime > 0" class="exit-travel-time">
            ({{ formatTravelTime(exit.travelTime) }})
          </span>
        </button>
      </div>
    </div>

    <!-- NPCs present -->
    <div v-if="npcsPresent.length > 0" class="npc-list">
      <div
        v-for="npc in npcsPresent"
        :key="npc.id"
        class="npc-entry"
      >{{ npc.name }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, watch, onMounted } from 'vue'
import { useGameStore } from '../../stores/game.js'

const game = useGameStore()
const narrative = inject('narrative')

const location = computed(() => game.currentLocation)
const exits = computed(() => location.value?.exits ?? [])
const npcsPresent = computed(() => game.npcsAtCurrentLocation)

/**
 * Determine description key based on current context.
 */
function descriptionKey() {
  const loc = location.value
  if (!loc) return 'default'

  const { period } = game.time
  const { sobriety, energy, hunger } = game.player?.status ?? {}
  const visits = loc.visitCount ?? 0

  if (sobriety !== undefined && sobriety <= 30) return 'drunk'
  if (energy !== undefined && energy <= 20) return 'exhausted'
  if (hunger !== undefined && hunger <= 20) return 'starving'
  if (period === 'night' || period === 'late_night') return 'night'
  if (visits > 1 && loc.descriptions?.repeat) return 'repeat'
  return 'default'
}

function enqueueDescription() {
  if (!location.value) return
  const key = descriptionKey()
  const text = location.value.descriptions?.[key] ?? location.value.descriptions?.default
  if (!text || !narrative) return

  narrative.enqueue({
    tokens: [{ text, style: 'normal', speed: 'normal', pauseAfter: 0, effect: 'none', color: null }],
  })
}

onMounted(enqueueDescription)

// Re-enqueue when location changes
watch(() => game.currentLocationId, () => {
  enqueueDescription()
})

function travel(exit) {
  if (exit.locked) return
  game.moveTo(exit.locationId, exit.travelTime ?? 0)
}

function formatTravelTime(ticks) {
  const minutes = ticks * 15
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rem = minutes % 60
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
}
</script>

<style lang="scss" scoped>
.location-view {
  margin-bottom: 24px;
}

.location-exits {
  margin-top: 16px;
}

.exits-label {
  font-size: 10px;
  color: #555548;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.exits-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.exit-link {
  background: none;
  border: none;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #d4a843;
  cursor: pointer;
  text-align: left;
  padding: 0;
  text-decoration: underline;
  text-decoration-style: dotted;

  &:hover:not(:disabled) {
    color: #6b5420;
  }

  &:disabled {
    color: #555548;
    cursor: not-allowed;
    text-decoration: none;
  }
}

.exit-travel-time {
  color: #555548;
  font-size: 12px;
  margin-left: 4px;
}

.npc-list {
  margin-top: 12px;
}

.npc-entry {
  font-size: 13px;
  color: #888878;
  margin-bottom: 2px;

  &::before {
    content: '— ';
    color: #555548;
  }
}
</style>
