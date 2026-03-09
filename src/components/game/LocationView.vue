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

    <!-- Characters present -->
    <div v-if="charactersPresent.length > 0" class="character-list">
      <button
        v-for="character in charactersPresent"
        :key="character.id"
        class="character-entry"
        :class="{ 'character-entry--selected': selectedCharacterId === character.id }"
        @click="selectCharacter(character.id)"
      >
        <span class="character-name">{{ character.name }}</span>
        <span v-if="character.habit" class="character-habit">{{ character.habit }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, watch, onMounted } from 'vue'
import { useGameStore } from '../../stores/game.js'
import { generateLocationNarrative } from '../../composables/useNarrative.js'
import { isOpen } from '../../models/location.js'

const game = useGameStore()
const narrative = inject('narrative')
const gameLoop = inject('gameLoop')
const selectedCharacterId = inject('selectedCharacterId', null)

const location = computed(() => game.currentLocation)
const exits = computed(() => location.value?.exits ?? [])
const charactersPresent = computed(() => game.charactersAtCurrentLocation)

function selectCharacter(characterId) {
  if (!selectedCharacterId) return
  // Toggle: clicking the same character deselects
  selectedCharacterId.value = selectedCharacterId.value === characterId ? null : characterId
}

function canTravel(exit) {
  if (!exit) return false
  // Check destination exists (is registered)
  const dest = game.locations[exit.locationId]
  if (!dest) return false
  // Delegate availability check to the model — single source of truth
  if (!isOpen(dest, game.time.hour)) return false
  // Honor exit requirements if any
  if (exit.requirements) return false // TODO: full requirement check
  return true
}

function travelBlockReason(exit) {
  const dest = game.locations[exit.locationId]
  if (!dest) return 'unknown destination'
  if (!isOpen(dest, game.time.hour)) {
    return dest.availability?.closedMessage || 'closed'
  }
  return ''
}

function onLocationEntered() {
  if (!location.value || !game.player) return

  // Clear character selection on location change
  if (selectedCharacterId) selectedCharacterId.value = null

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

.character-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.character-entry {
  display: block;
  text-align: left;
  background: none;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
  padding: 4px 6px;
  font-family: 'Courier New', monospace;
  transition: border-color 150ms ease, background-color 150ms ease;

  &::before {
    content: '— ';
    color: #555548;
    font-size: 13px;
  }

  &:hover {
    border-color: #3a3a34;
    background-color: #111110;
  }

  &--selected {
    border-color: #555548;
    background-color: #141412;
  }
}

.character-name {
  font-size: 13px;
  color: #aaa99a;
}

.character-habit {
  display: block;
  font-size: 12px;
  color: #666658;
  padding-left: 16px;
  font-style: italic;
}
</style>
