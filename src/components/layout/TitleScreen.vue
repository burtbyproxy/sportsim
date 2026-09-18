<template>
  <div class="title-screen">
    <!-- Boot sequence -->
    <div class="title-screen__boot" aria-hidden="true">
      <div
        v-for="(line, i) in bootLines"
        :key="i"
        class="boot-line"
        :style="{ animationDelay: `${i * 120}ms` }"
      >
        {{ line }}
      </div>
    </div>

    <h1 class="title-screen__title">SportSim</h1>
    <p class="title-screen__subtitle">
      Portland, Oregon. 2001. You are broke. You are talentless. You are in your mom's basement.
    </p>

    <nav ref="menuEl" class="title-screen__menu" aria-label="Main menu" tabindex="0">
      <button
        v-for="(item, i) in menuItems"
        :key="item.id"
        class="title-menu-item"
        :class="{ 'title-menu-item--selected': selectedIndex === i }"
        :disabled="item.disabled"
        @click="item.action()"
        @mouseenter="selectedIndex = i"
      >
        <span
          v-for="(part, j) in shortcutLabelParts({ label: item.label, shortcut: item.shortcut })"
          :key="j"
          :class="part.isKey ? 'shortcut-key' : ''"
          >{{ part.text }}</span
        >
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'
import { useSave } from '../../composables/useSave.js'
import { useKeyboard } from '../../composables/useKeyboard.js'
import { useKeyboardNav } from '../../composables/useKeyboardNav.js'
import {
  loadLocations,
  loadCharacters,
  loadItems,
  loadSubstances,
  loadConditions,
  loadMediums,
  loadVoices,
  loadScavengeTables,
} from '../../data/loader.js'
import { createPlayer } from '../../models/player.js'
import { createCharacter } from '../../models/character.js'
import { createLocation } from '../../models/location.js'
import { createItem } from '../../models/item.js'
import { shortcutLabelParts } from '../../utils/menu.js'

const router = useRouter()
const game = useGameStore()
const save = useSave()
const menuEl = ref(null)

const hasSave = ref(false)

// Load item, substance, and condition registries once at startup — they
// are definitions, not run state, and persist across game resets.
const allItems = loadItems()
for (const item of Object.values(allItems)) {
  game.registerItem(createItem(item))
}
for (const substance of Object.values(loadSubstances())) {
  game.registerSubstance({ substance })
}
for (const condition of Object.values(loadConditions())) {
  game.registerCondition({ condition })
}
for (const medium of Object.values(loadMediums())) {
  game.registerMedium({ medium })
}
for (const voice of Object.values(loadVoices())) {
  game.registerVoice({ voice })
}
for (const table of Object.values(loadScavengeTables())) {
  game.registerScavengeTable({ table })
}

onMounted(() => {
  hasSave.value = save.listSaves().length > 0
  // Auto-focus so keyboard works immediately, no click required
  menuEl.value?.focus()
})

const bootLines = [
  'SPORTSIM v0.9.0',
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
    game.registerLocation(createLocation(location))
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
    // What a place is comes from content; the save only knows what happened there.
    game.locationsRestore({ definitions: loadLocations('kenton') })
    router.push('/game')
  }
}

const menuItems = computed(() => [
  { id: 'new', label: 'New Game', shortcut: 'n', disabled: false, action: startNewGame },
  { id: 'load', label: 'Load Game', shortcut: 'l', disabled: !hasSave.value, action: loadGame },
])

const { selectedIndex, onKeydown: navKeydown } = useKeyboardNav(menuItems, {
  onSelect: (item) => {
    if (!item.disabled) item.action()
  },
  skip: (item) => item.disabled,
  loop: true,
})

// Letter shortcuts: n → new game, l → load game.
// Arrow nav + Enter handled by useKeyboardNav via navKeydown.
useKeyboard({
  n: (e) => {
    const item = menuItems.value.find((m) => m.shortcut === 'n' && !m.disabled)
    if (item) {
      e.preventDefault()
      item.action()
    }
  },
  l: (e) => {
    const item = menuItems.value.find((m) => m.shortcut === 'l' && !m.disabled)
    if (item) {
      e.preventDefault()
      item.action()
    }
  },
  ArrowUp: (e) => navKeydown(e),
  ArrowDown: (e) => navKeydown(e),
  Enter: (e) => navKeydown(e),
})
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
  outline: none;
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

  // No prefix by default
  &::before {
    content: '  ';
    color: #555548;
  }

  // Prefix only appears on the keyboard-selected item
  &--selected::before {
    content: '> ';
    color: #555548;
  }

  &--selected {
    color: #a8d888;
  }

  &:hover:not(:disabled) {
    color: #a8d888;
  }

  &:hover:not(:disabled)::before {
    content: '> ';
  }

  &:disabled {
    color: #555548;
    cursor: not-allowed;

    .shortcut-key {
      color: #3a3a34;
    }
  }
}

.shortcut-key {
  color: #a8d888;
}
</style>
