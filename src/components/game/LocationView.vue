<template>
  <div class="location-view">
    <!-- Location name — this is a PLACE -->
    <h1 v-if="location" class="location-name">
      {{ location.display ?? location.id }}
    </h1>

    <!-- Characters present — woven into the scene, not a widget -->
    <div v-if="charactersPresent.length > 0" class="scene-people">
      <button
        v-for="character in charactersPresent"
        :key="character.id"
        class="scene-person"
        :class="{ 'scene-person--selected': game.characterSelectedId === character.id }"
        @click="game.characterSelect({ characterId: character.id })"
      >
        <span class="scene-person__name">{{ character.name }}</span>
        <span v-if="character.habit" class="scene-person__habit">{{ character.habit }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, onMounted } from 'vue'
import { useGameStore } from '../../stores/game.js'
import { useKeyboard } from '../../composables/useKeyboard.js'
import { EXIT_KEYS } from '../../utils/menu.js'

const game = useGameStore()
const gameLoop = inject('gameLoop')

const location = computed(() => game.currentLocation)
const charactersPresent = computed(() => game.charactersAtCurrentLocation)

// The scene itself (log, description, events, actions) is the game loop's.
onMounted(() => {
  if (gameLoop) gameLoop.onLocationEntered()
})

// Letter keys a–z leave by the exit with that key; the loop decides whether you can.
useKeyboard(
  Object.fromEntries(
    EXIT_KEYS.split('').map((letter) => [
      letter,
      (e) => {
        const entry = game.menuEntries.find((m) => m.kind === 'exit' && m.key === letter)
        if (!entry || !gameLoop) return
        e.preventDefault()
        gameLoop.travel({ locationId: entry.exit.locationId })
      },
    ])
  )
)
</script>

<style lang="scss" scoped>
@use '../../scss/variables' as *;

.location-view {
  padding: 28px 32px 0 28px;
  margin-bottom: 0;
}

// The place name — this deserves real presence
.location-name {
  font-family: $font-mono;
  font-size: 22px;
  font-weight: normal;
  color: $color-amber-bright;
  letter-spacing: 0.5px;
  margin: 0 0 20px 0;
  line-height: 1.2;
  // subtle text shadow for warmth
  text-shadow: 0 0 24px rgba(201, 162, 64, 0.18);
}

// People in the scene
.scene-people {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 8px;
}

.scene-person {
  display: block;
  text-align: left;
  background: none;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
  padding: 5px 8px;
  font-family: $font-mono;
  transition:
    border-color 150ms ease,
    background-color 150ms ease;

  &::before {
    content: '— ';
    color: $color-text-muted;
    font-size: 12px;
  }

  &:hover {
    border-color: $color-border-accent;
    background-color: $color-bg-elevated;
  }

  &--selected {
    border-color: $color-amber-dim;
    background-color: $color-bg-elevated;
  }
}

.scene-person__name {
  font-size: 13px;
  color: $color-text-secondary;
}

.scene-person__habit {
  display: block;
  font-size: 11px;
  color: $color-text-muted;
  padding-left: 18px;
  font-style: italic;
  margin-top: 1px;
}
</style>
