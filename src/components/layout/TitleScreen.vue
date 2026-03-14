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
          v-for="(part, j) in renderShortcutLabel(item.label, item.shortcut)"
          :key="j"
          :class="part.isKey ? 'shortcut-key' : ''"
          >{{ part.text }}</span
        >
      </button>
    </nav>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'
import { useMetaStore } from '../../stores/meta.js'
import { useSave } from '../../composables/useSave.js'
import { useKeyboardNav } from '../../composables/useKeyboardNav.js'
import { loadLocations, loadCharacters, loadItems } from '../../data/loader.js'
import { createPlayer } from '../../models/player.js'
import { createCharacter } from '../../models/character.js'

const router = useRouter()
const game = useGameStore()
const meta = useMetaStore()
const save = useSave()
const menuEl = ref(null)

const hasSave = ref(false)

// Load item registry once at startup — persists across game resets
const allItems = loadItems()
for (const item of Object.values(allItems)) {
  game.registerItem(item)
}

onMounted(() => {
  meta.load()
  hasSave.value = save.listSaves().length > 0
  // Auto-focus so keyboard works immediately, no click required
  menuEl.value?.focus()
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

const menuItems = computed(() => [
  { id: 'new', label: 'New Game', shortcut: 'n', disabled: false, action: startNewGame },
  { id: 'load', label: 'Load Game', shortcut: 'l', disabled: !hasSave.value, action: loadGame },
  { id: 'unlocks', label: 'Unlocks', shortcut: 'u', disabled: true, action: () => {} },
])

/**
 * Split a label around a shortcut letter to render as:
 * "[n]ew Game" — the shortcut letter gets brackets and a highlight class.
 */
function renderShortcutLabel(label, shortcut) {
  if (!shortcut) return [{ text: label, isKey: false }]
  const idx = label.toLowerCase().indexOf(shortcut.toLowerCase())
  if (idx === -1) return [{ text: label, isKey: false }]
  const parts = []
  if (idx > 0) parts.push({ text: label.slice(0, idx), isKey: false })
  parts.push({ text: `[${label[idx]}]`, isKey: true })
  if (idx + 1 < label.length) parts.push({ text: label.slice(idx + 1), isKey: false })
  return parts
}

const { selectedIndex, onKeydown: navKeydown } = useKeyboardNav(menuItems, {
  onSelect: (item) => {
    if (!item.disabled) item.action()
  },
  skip: (item) => item.disabled,
  loop: true,
})

function onKeydown(e) {
  // Shortcut keys: press the letter to activate
  if (e.key.length === 1 && /^[a-z]$/i.test(e.key)) {
    const letter = e.key.toLowerCase()
    const item = menuItems.value.find((m) => m.shortcut === letter && !m.disabled)
    if (item) {
      e.preventDefault()
      item.action()
      return
    }
  }
  navKeydown(e)
}

// Global keyboard listener so shortcuts work even without nav focus
function handleGlobalKeydown(e) {
  const tag = document.activeElement?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea') return
  onKeydown(e)
}

onMounted(() => document.addEventListener('keydown', handleGlobalKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleGlobalKeydown))
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
