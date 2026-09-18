<template>
  <div class="action-menu">
    <div class="action-menu__label ui-label">
      <span v-if="activeEvent">{{ activeEvent.title ?? 'what now' }}</span>
      <span v-else-if="selectedCharacter">{{ selectedCharacter.name }}</span>
      <span v-else>what now</span>
    </div>

    <!-- Event choices — the world is waiting on you -->
    <div v-if="activeEvent" class="action-menu__list">
      <button
        v-for="(entry, i) in menuEntries"
        :key="`choice-${i}`"
        class="action-item action-item--choice"
        :class="{ 'action-item--selected': navIndex === i }"
        @click="choose(entry)"
        @mouseenter="navIndex = i"
      >
        <span class="action-shortcut">{{ entry.key }}.</span>
        {{ entry.label }}
      </button>
    </div>

    <!-- Actions -->
    <div v-else-if="filteredActions.length === 0 && exits.length === 0" class="action-menu__empty">
      <span v-if="selectedCharacter">nothing to say to {{ selectedCharacter.name }}</span>
      <span v-else>nothing to do here</span>
    </div>

    <div v-else class="action-menu__list">
      <!-- Location / character actions -->
      <button
        v-for="(action, i) in sortedActions"
        :key="action.id"
        class="action-item"
        :class="{
          'action-item--disabled': !action.available,
          'action-item--selected': navIndex === i,
        }"
        :disabled="!action.available || isResolving"
        :title="
          action.available ? durationFormat({ ticks: action.timeCost }) : disabledReason(action)
        "
        @click="executeAction(action)"
        @mouseenter="navIndex = i"
      >
        <span class="action-shortcut">{{ i < 9 ? i + 1 + '.' : '  ' }}</span>
        {{ action.label }}
        <span v-if="action.timeCost > 0" class="action-time-cost">
          {{ durationFormat({ ticks: action.timeCost }) }}
        </span>
      </button>

      <!-- Separator between actions and exits -->
      <div v-if="sortedActions.length > 0 && exits.length > 0" class="action-menu__separator" />

      <!-- Exits — go somewhere -->
      <button
        v-for="(exit, i) in exits"
        :key="exit.locationId"
        class="action-item action-item--exit"
        :class="{
          'action-item--disabled': !canTravel(exit),
          'action-item--selected': navIndex === sortedActions.length + i,
        }"
        :disabled="!canTravel(exit)"
        :title="
          canTravel(exit) ? durationFormat({ ticks: exit.travelTime }) : travelBlockReason(exit)
        "
        @click="travel(exit)"
        @mouseenter="navIndex = sortedActions.length + i"
      >
        <span class="action-shortcut action-shortcut--exit">{{ exitKeyFor({ index: i }) }}.</span>
        {{ exit.label }}
        <span v-if="exit.travelTime > 0" class="action-time-cost">
          {{ durationFormat({ ticks: exit.travelTime }) }}
        </span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { useGameStore } from '../../stores/game.js'
import { meetsRequirements } from '../../engine/actions.js'
import { useKeyboard } from '../../composables/useKeyboard.js'
import { useKeyboardNav } from '../../composables/useKeyboardNav.js'
import { isOpen, exitMeetsRequirements } from '../../models/location.js'
import { menuEntriesBuild, exitKeyFor } from '../../utils/menu.js'
import { durationFormat } from '../../engine/clock.js'

const game = useGameStore()
const gameLoop = inject('gameLoop')
const selectedCharacterId = inject('selectedCharacterId', null)

/** Prevent double-clicks during resolution */
const isResolving = ref(false)

/** The event waiting on the player's choice, if any */
const activeEvent = computed(() => game.activeEvent)

/** The selected character object (or null) */
const selectedCharacter = computed(() => {
  const id = selectedCharacterId?.value
  if (!id) return null
  return game.characters[id] ?? null
})

/**
 * Filter available actions by selected character.
 * - Character selected: show only actions with matching characterId
 * - No character selected: show only location/general actions (no characterId)
 */
const filteredActions = computed(() => {
  const all = game.availableActions
  const charId = selectedCharacterId?.value ?? null
  if (charId) {
    return all.filter((a) => a.characterId === charId)
  }
  return all.filter((a) => !a.characterId)
})

/** Sort: available first by weight desc, then disabled by weight desc */
const sortedActions = computed(() => {
  const available = filteredActions.value
    .filter((a) => a.available)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  const disabled = filteredActions.value
    .filter((a) => !a.available)
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
  return [...available, ...disabled]
})

// ── Exits (injected from GameScreen which reads from game store) ─────────────

const exits = computed(() => game.currentLocation?.exits ?? [])

function canTravel(exit) {
  if (!exit) return false
  const dest = game.locations[exit.locationId]
  if (!dest) return false
  if (!isOpen(dest, game.time.hour)) return false
  return exitMeetsRequirements({ exit, player: game.player, gameTime: game.time }).meets
}

function travelBlockReason(exit) {
  const dest = game.locations[exit.locationId]
  if (!dest) return 'unknown destination'
  if (!isOpen(dest, game.time.hour)) {
    return dest.availability?.closedMessage || 'closed'
  }
  return ''
}

function choose(entry) {
  if (!gameLoop || entry.kind !== 'choice') return
  gameLoop.resolveEventChoice({ choiceIndex: entry.choiceIndex })
}

function travel(exit) {
  if (!canTravel(exit) || activeEvent.value) return
  if (gameLoop) {
    gameLoop.travel(exit.locationId, exit.travelTime ?? 1)
  }
}

// ── Actions ──────────────────────────────────────────────────────────────────

async function executeAction(action) {
  if (!action.available || isResolving.value || !gameLoop || activeEvent.value) return
  isResolving.value = true
  try {
    await gameLoop.resolvePlayerAction(action)
  } finally {
    isResolving.value = false
  }
}

function disabledReason(action) {
  if (!game.player) return 'not available'
  const { meets, reason } = meetsRequirements(game.player, action, game.time)
  if (!meets && reason) return reason
  return 'not available'
}

// ── Keyboard navigation ──────────────────────────────────────────────────────

// Arrow keys and Enter walk one list: actions first, then exits.
const menuEntries = computed(() =>
  menuEntriesBuild({
    actions: sortedActions.value,
    exits: exits.value,
    exitAvailable: canTravel,
    choices: activeEvent.value?.choices ?? [],
  })
)

const {
  selectedIndex: navIndex,
  onKeydown: navKeydown,
  clamp,
} = useKeyboardNav(menuEntries, {
  onSelect: (entry) => {
    if (entry.kind === 'choice') choose(entry)
    else if (entry.kind === 'action') executeAction(entry.action)
    else travel(entry.exit)
  },
  skip: (entry) => !entry.available,
  loop: true,
})

// Keep the highlight valid when the list changes, and start from the top at a new place
watch(menuEntries, () => clamp())
watch(
  () => game.currentLocationId,
  () => {
    navIndex.value = 0
  }
)

// Number keys 1–9 for action shortcuts, arrow keys + enter for nav.
// useKeyboard handles input exclusion and repeat filtering automatically.
const actionKeyBindings = Object.fromEntries(
  [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [
    String(n),
    (e) => {
      const entry = menuEntries.value.find((m) => m.key === String(n))
      if (!entry?.available) return
      e.preventDefault()
      if (entry.kind === 'choice') choose(entry)
      else executeAction(entry.action)
    },
  ])
)

useKeyboard({
  ...actionKeyBindings,
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
  justify-content: space-between;
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
