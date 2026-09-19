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

    <!-- Broken content: no words to use but its own code and file. -->
    <p v-if="!booted.ok" class="title-screen__notice" role="alert">
      [{{ booted.error.code }}] {{ booted.error.params.path ?? booted.error.params.kind }}
    </p>

    <template v-else>
      <h1 class="title-screen__title">{{ config.title }}</h1>
      <p class="title-screen__subtitle">{{ config.tagline }}</p>
    </template>

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

    <p v-if="loadFailed" class="title-screen__notice" role="status">
      {{ config.menu.loadFailed }}
    </p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'
import { useBoot } from '../../composables/useBoot.js'
import { useKeyboard } from '../../composables/useKeyboard.js'
import { useKeyboardNav } from '../../composables/useKeyboardNav.js'
import { shortcutLabelParts } from '../../utils/menu.js'
import { textFill } from '../../utils/text.js'
import { version } from '../../../package.json'

const router = useRouter()
const game = useGameStore()
const boot = useBoot()
const menuEl = ref(null)

// Everything the game is made of, registered once; if content is broken the
// screen says which file, and there is no game to start.
const booted = boot.gameBoot()
const config = booted.ok ? game.config : null

const hasSave = ref(false)
const loadFailed = ref(false)

onMounted(() => {
  hasSave.value = boot.gameResumable().data.resumable
  // Auto-focus so keyboard works immediately, no click required
  menuEl.value?.focus()
})

const bootLines = (config?.bootLines ?? []).map((line) =>
  textFill({ text: line, params: { version } })
)

function startNewGame() {
  const started = boot.gameNew()
  if (started.ok) router.push('/game')
}

function loadGame() {
  const resumed = boot.gameResume()
  loadFailed.value = !resumed.ok
  if (resumed.ok) router.push('/game')
}

const menuItems = computed(() =>
  config
    ? [
        { id: 'new', label: config.menu.new, shortcut: 'n', disabled: false, action: startNewGame },
        {
          id: 'load',
          label: config.menu.load,
          shortcut: 'l',
          disabled: !hasSave.value,
          action: loadGame,
        },
      ]
    : []
)

const { selectedIndex, onKeydown: navKeydown } = useKeyboardNav({
  items: menuItems,
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
@use '../../scss/variables' as *;

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

.title-screen__notice {
  color: $color-danger;
  font-size: 13px;
  margin-top: 24px;
  max-width: 500px;
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
