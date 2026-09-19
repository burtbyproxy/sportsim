<template>
  <div class="action-menu">
    <div class="action-menu__label ui-label">
      <span v-if="game.activeEvent">{{ game.activeEvent.title ?? 'what now' }}</span>
      <span v-else-if="game.characterSelected">{{ game.characterSelected.name }}</span>
      <span v-else>what now</span>
    </div>

    <!-- Event choices — the world is waiting on you -->
    <div v-if="game.activeEvent" class="action-menu__list">
      <button
        v-for="(entry, i) in entries"
        :key="`choice-${i}`"
        class="action-item action-item--choice"
        :class="{ 'action-item--selected': navIndex === i }"
        @click="dispatch(entry)"
        @mouseenter="navIndex = i"
      >
        <span class="action-shortcut">{{ entry.key }}.</span>
        {{ entry.label }}
      </button>
    </div>

    <div v-else-if="entries.length === 0" class="action-menu__empty">
      <span v-if="game.characterSelected">nothing to say to {{ game.characterSelected.name }}</span>
      <span v-else>nothing to do here</span>
    </div>

    <div v-else class="action-menu__list">
      <template
        v-for="(entry, i) in entries"
        :key="entry.kind + (entry.action?.id ?? entry.exit?.locationId)"
      >
        <!-- Separator between actions and exits -->
        <div
          v-if="entry.kind === 'exit' && i > 0 && entries[i - 1].kind !== 'exit'"
          class="action-menu__separator"
        />
        <button
          class="action-item"
          :class="{
            'action-item--exit': entry.kind === 'exit',
            'action-item--disabled': !entry.available,
            'action-item--selected': navIndex === i,
          }"
          :disabled="!entry.available || isResolving"
          :title="entry.available ? durationFormat({ ticks: entry.ticks }) : entry.reason"
          @click="dispatch(entry)"
          @mouseenter="navIndex = i"
        >
          <span
            class="action-shortcut"
            :class="{ 'action-shortcut--exit': entry.kind === 'exit' }"
            >{{ entry.key ? entry.key + '.' : '  ' }}</span
          >
          {{ entry.label }}
          <span v-if="entry.ticks > 0" class="action-time-cost">
            {{ durationFormat({ ticks: entry.ticks }) }}
          </span>
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useGameStore } from '../../stores/game.js'
import { useKeyboard } from '../../composables/useKeyboard.js'
import { useKeyboardNav } from '../../composables/useKeyboardNav.js'
import { durationFormat } from '../../engine/clock.js'

const game = useGameStore()
const gameLoop = inject('gameLoop')

/** Prevent double-clicks while an action resolves */
const isResolving = ref(false)

/** The one list the menu shows; the store builds it, the loop decides what is in it. */
const entries = computed(() => game.menuEntries)

/** Hand an entry to the loop, which decides what comes of it. */
async function dispatch(entry) {
  if (!gameLoop || isResolving.value) return
  if (entry.kind === 'choice')
    return gameLoop.resolveEventChoice({ choiceIndex: entry.choiceIndex })
  if (entry.kind === 'exit') return gameLoop.travel({ locationId: entry.exit.locationId })
  isResolving.value = true
  try {
    await gameLoop.resolvePlayerAction(entry.action)
  } finally {
    isResolving.value = false
  }
}

const {
  selectedIndex: navIndex,
  onKeydown: navKeydown,
  clamp,
} = useKeyboardNav({
  items: entries,
  onSelect: dispatch,
  skip: (entry) => !entry.available,
  loop: true,
})

// Keep the highlight valid when the list changes, and start from the top at a new place
watch(entries, () => clamp())
watch(
  () => game.currentLocationId,
  () => {
    navIndex.value = 0
  }
)

// Number keys 1–9 pick the entry with that key; arrows and Enter walk the list.
const numberKeyBindings = Object.fromEntries(
  ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => [
    key,
    (e) => {
      const entry = entries.value.find((m) => m.key === key)
      if (!entry?.available) return
      e.preventDefault()
      dispatch(entry)
    },
  ])
)

useKeyboard({
  ...numberKeyBindings,
  ArrowUp: (e) => navKeydown(e),
  ArrowDown: (e) => navKeydown(e),
  Enter: (e) => navKeydown(e),
})
</script>

<style lang="scss" scoped>
@use '../../scss/variables' as *;

.action-menu {
  padding: 14px 16px 16px;
}

.action-menu__label {
  font-size: 10px;
  color: $color-text-muted;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 10px;
  font-family: $font-ui;
}

.action-menu__empty {
  font-size: $font-size-sm;
  color: $color-text-muted;
  font-family: $font-mono;
  font-style: italic;
}

.action-menu__list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.action-menu__separator {
  height: 1px;
  background: $color-border;
  margin: 6px 0;
  opacity: 0.6;
}

.action-item {
  font-family: $font-mono;
  font-size: 13px;
  color: $color-accent;
  background: none;
  border: 1px solid transparent;
  border-radius: 2px;
  cursor: pointer;
  padding: 5px 8px;
  text-align: left;
  display: flex;
  // The time cost pushes itself right; an entry without one stays left.
  justify-content: flex-start;
  align-items: center;
  transition:
    border-color 150ms ease,
    background-color 150ms ease,
    color 150ms ease;

  &:hover:not(:disabled),
  &--selected:not(:disabled) {
    border-color: $color-accent-dim;
    background-color: $color-bg-elevated;
  }

  &:focus {
    outline: 1px solid $color-accent;
    outline-offset: -1px;
  }

  &.action-item--disabled,
  &:disabled {
    color: $color-text-muted;
    cursor: not-allowed;

    &:hover {
      border-color: transparent;
      background: none;
    }
  }

  // Exits — different colour: amber instead of green
  &--exit {
    color: $color-amber;

    &:hover:not(:disabled),
    &.action-item--selected:not(:disabled) {
      border-color: $color-amber-dim;
      background-color: $color-bg-elevated;
    }

    &:focus {
      outline-color: $color-amber;
    }

    &.action-item--disabled,
    &:disabled {
      color: $color-text-muted;
    }
  }
}

.action-shortcut {
  font-size: 10px;
  color: $color-text-muted;
  margin-right: 6px;
  flex-shrink: 0;
  min-width: 16px;
  display: inline-block;
  letter-spacing: 0;

  &--exit {
    color: $color-amber-dim;
  }
}

.action-time-cost {
  font-size: 10px;
  color: $color-text-muted;
  margin-left: auto;
  padding-left: 8px;
  flex-shrink: 0;
}
</style>
