<template>
  <div class="location-view">
    <!-- Location description is enqueued on enter — NarrativeLog handles display -->

    <!-- Exits -->
    <div v-if="exits.length > 0" class="location-exits">
      <div class="exits-label ui-label">exits</div>
      <div class="exits-list">
        <button
          v-for="exit in exits"
          :key="exit.locationId"
          class="exit-link"
          :disabled="!canTravel(exit)"
          :title="travelBlockReason(exit)"
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
import { generateLocationNarrative } from '../../composables/useNarrative.js'

const game = useGameStore()
const narrative = inject('narrative')
const gameLoop = inject('gameLoop')

const location = computed(() => game.currentLocation)
const exits = computed(() => location.value?.exits ?? [])
const npcsPresent = computed(() => game.npcsAtCurrentLocation)

function canTravel(exit) {
  if (!exit) return false
  // Check destination exists (is registered)
  if (!game.locations[exit.locationId]) return false
  // Check location availability based on current time
  const dest = game.locations[exit.locationId]
  if (dest.availability) {
    const { openHour, closeHour } = dest.availability
    const h = game.time.hour
    // Handle bars that close at 2am (closeHour < openHour means crosses midnight)
    if (closeHour < openHour) {
      if (h < openHour && h >= closeHour) return false
    } else {
      if (h < openHour || h >= closeHour) return false
    }
  }
  // Honor exit requirements if any
  if (exit.requirements) return false // TODO: full requirement check
  return true
}

function travelBlockReason(exit) {
  if (!game.locations[exit.locationId]) return 'unknown destination'
  const dest = game.locations[exit.locationId]
  if (dest.availability) {
    const { openHour, closeHour } = dest.availability
    const h = game.time.hour
    const closed =
      closeHour < openHour
        ? h < openHour && h >= closeHour
        : h < openHour || h >= closeHour
    if (closed) return dest.availability.closedMessage || 'closed'
  }
  return ''
}

function onLocationEntered() {
  if (!location.value || !game.player) return

  // Clear log and enqueue new description
  if (narrative) {
    narrative.clearLog()
    const narrativeText = generateLocationNarrative(location.value, game.player, game.time)
    narrative.enqueue(narrativeText)
  }

  // Refresh available actions via game loop
  if (gameLoop) {
    gameLoop.onLocationEntered()
  }
}

onMounted(onLocationEntered)
watch(() => game.currentLocationId, onLocationEntered)

function travel(exit) {
  if (!canTravel(exit)) return
  if (gameLoop) {
    gameLoop.travel(exit.locationId, exit.travelTime ?? 1)
  }
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
    color: #a87e28;
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
