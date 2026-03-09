<template>
  <div class="game-shell">
    <GameHeader />

    <main class="game-main">
      <div class="narrative-column">
        <LocationView v-if="game.currentLocation" />
        <NarrativeLog
          :log="narrative.log.value"
          :is-animating="narrative.isAnimating.value"
          :current-token-progress="narrative.currentTokenProgress.value"
          :active-entry="activeEntry"
          @skip="narrative.skip()"
        />
      </div>

      <aside class="action-column">
        <ActionMenu />
      </aside>
    </main>

    <GameFooter />
  </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'
import { useNarrative } from '../../composables/useNarrative.js'
import { useGameLoop } from '../../composables/useGameLoop.js'
import { loadActions } from '../../data/loader.js'
import GameHeader from './GameHeader.vue'
import GameFooter from './GameFooter.vue'
import LocationView from '../game/LocationView.vue'
import ActionMenu from '../game/ActionMenu.vue'
import NarrativeLog from '../game/NarrativeLog.vue'

const router = useRouter()
const game = useGameStore()

// Redirect to title if no game running
if (!game.isRunning) {
  router.replace('/')
}

// Load action registry from content/ — array of Action objects
const actionRegistry = Object.values(loadActions('kenton'))

const narrative = useNarrative()
provide('narrative', narrative)

const gameLoop = useGameLoop(actionRegistry)
provide('gameLoop', gameLoop)

// Selected character — set by LocationView when player clicks a character,
// read by ActionMenu to filter to that character's interaction actions.
// null = no character selected, show location actions only.
const selectedCharacterId = ref(null)
provide('selectedCharacterId', selectedCharacterId)

/** Tracks the entry currently being animated (for live display) */
const activeEntry = ref(null)

narrative.on('animation-start', () => {
  activeEntry.value = { completedTokens: [], currentToken: null }
})

narrative.on('animation-complete', () => {
  activeEntry.value = null
})
</script>
