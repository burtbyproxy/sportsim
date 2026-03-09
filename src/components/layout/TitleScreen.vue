<template>
  <div class="title-screen">
    <!-- Boot sequence -->
    <div class="title-screen__boot" aria-hidden="true">
      <div
        v-for="(line, i) in bootLines"
        :key="i"
        class="boot-line"
        :style="{ animationDelay: `${i * 120}ms` }"
      >{{ line }}</div>
    </div>

    <h1 class="title-screen__title">SportSim</h1>
    <p class="title-screen__subtitle">Portland, Oregon. 2001. You are broke. You are talentless. You are in your mom's basement.</p>

    <nav class="title-screen__menu" aria-label="Main menu">
      <button class="title-menu-item" @click="startNewGame">New Game</button>
      <button
        class="title-menu-item"
        :disabled="!hasSave"
        @click="loadGame"
      >Load Game</button>
      <button class="title-menu-item" disabled>Unlocks</button>
    </nav>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'
import { useMetaStore } from '../../stores/meta.js'
import { useSave } from '../../composables/useSave.js'
import { loadLocations, loadCharacters, loadItems } from '../../data/loader.js'
import { createPlayer } from '../../models/player.js'
import { createCharacter } from '../../models/character.js'

const router = useRouter()
const game = useGameStore()
const meta = useMetaStore()
const save = useSave()

const hasSave = ref(false)

// Load item registry once at startup — persists across game resets
const allItems = loadItems()
for (const item of Object.values(allItems)) {
  game.registerItem(item)
}

onMounted(() => {
  meta.load()
  hasSave.value = save.listSaves().length > 0
})

const bootLines = [
  'SPORTSIM v0.1.0',
  'Portland Art Scene Simulation Engine',
  'Loading city data...',
  'Generating despair...',
  'Calibrating poverty thresholds...',
  'Ready.',
  '',
]

function startNewGame() {
  const player = createPlayer('You')
  game.startNewGame(player, 'moms_house')

  // Register all Kenton locations from content/
  const locations = loadLocations('kenton')
  for (const location of Object.values(locations)) {
    game.registerLocation({ ...location })
  }

  // Register all characters from content/
  const characters = loadCharacters()
  for (const charData of Object.values(characters)) {
    game.registerCharacter(createCharacter(charData))
  }

  router.push('/game')
}

function loadGame() {
  const saves = save.listSaves()
  if (saves.length === 0) return
  // Load most recent save
  const latest = saves.sort((a, b) => b.timestamp - a.timestamp)[0]
  const saveData = save.load(latest.id)
  if (saveData) {
    game.loadSave(saveData)
    router.push('/game')
  }
}
</script>

<style lang="scss" scoped>
.title-screen {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  height: 100vh;
  padding: 40px;
  background: #0a0a0a;
  font-family: 'Courier New', monospace;
  max-width: 700px;
  margin: 0 auto;
}

.title-screen__boot {
  color: #555548;
  font-size: 13px;
  margin-bottom: 40px;
  line-height: 1.7;
}

.title-screen__title {
  font-size: 24px;
  color: #7aad5a;
  margin-bottom: 4px;
  letter-spacing: 3px;
  text-transform: uppercase;
  font-weight: normal;
}

.title-screen__subtitle {
  color: #888878;
  font-size: 13px;
  margin-bottom: 40px;
  line-height: 1.5;
  max-width: 500px;
}

.title-screen__menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-menu-item {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  color: #7aad5a;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;

  &::before {
    content: '> ';
    color: #555548;
  }

  &:hover:not(:disabled) {
    color: #a8d888;
  }

  &:disabled {
    color: #555548;
    cursor: not-allowed;
  }
}
</style>
