<template>
  <div class="game-shell">
    <GameHeader />

    <main class="game-main">
      <!-- TOP LEFT: location name + narrative -->
      <div class="location-column">
        <LocationView v-if="game.currentLocation" />
        <NarrativeLog
          :log="narrative.log.value"
          :is-animating="narrative.isAnimating.value"
          :current-token-progress="narrative.currentTokenProgress.value"
          :active-entry="activeEntry"
          @skip="narrative.skip()"
        />
      </div>

      <!-- BOTTOM LEFT: command panel — actions + exits together -->
      <aside class="action-column">
        <ActionMenu />
      </aside>

      <!-- RIGHT: full-height tabbed sidebar -->
      <aside class="status-column">
        <!-- Tabs -->
        <div class="sidebar-tabs">
          <button
            class="sidebar-tab"
            :class="{ 'sidebar-tab--active': activeTab === 'status' }"
            @click="activeTab = 'status'"
          >
            status
          </button>
          <button
            class="sidebar-tab"
            :class="{ 'sidebar-tab--active': activeTab === 'inventory' }"
            @click="activeTab = 'inventory'"
          >
            inventory
          </button>
          <button
            class="sidebar-tab"
            :class="{ 'sidebar-tab--active': activeTab === 'work' }"
            @click="activeTab = 'work'"
          >
            work
          </button>
        </div>

        <!-- Status tab -->
        <div v-if="activeTab === 'status'" class="sidebar-panel">
          <!-- Time -->
          <div class="status-section">
            <div class="status-section__label">time</div>
            <div class="status-time">
              {{ formattedTime }}
            </div>
          </div>

          <!-- Stat bars -->
          <div class="status-section">
            <div class="status-section__label">vitals</div>
            <div class="status-stats">
              <div
                v-for="stat in statusStats"
                :key="stat.key"
                class="status-stat"
                :title="`${stat.label}: ${stat.value}`"
              >
                <div class="status-stat__header">
                  <span class="status-stat__icon">{{ stat.icon }}</span>
                  <span class="status-stat__label">{{ stat.label }}</span>
                  <span class="status-stat__value">{{ stat.value }}</span>
                </div>
                <div class="status-stat__track">
                  <div
                    class="status-stat__fill"
                    :class="[`status-stat__fill--${stat.key}`, barFillClass(stat.key, stat.value)]"
                    :style="{ width: `${stat.value}%` }"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Muse -->
          <div class="status-section">
            <div class="status-section__label">muse</div>
            <div class="status-muse" :class="{ 'status-muse--active': game.inspirationActive }">
              {{ game.inspirationLabel }}
            </div>
          </div>

          <!-- Money -->
          <div class="status-section">
            <div class="status-section__label">funds</div>
            <div class="status-money" :class="{ 'status-money--negative': money < 0 }">
              <span class="status-money__sign">$</span>
              <span class="status-money__amount">{{ formattedMoney }}</span>
            </div>
          </div>
        </div>

        <!-- Inventory tab -->
        <div v-if="activeTab === 'inventory'" class="sidebar-panel sidebar-panel--inventory">
          <div class="status-section status-section--grow">
            <div class="status-section__label">carrying</div>
            <div v-if="game.playerInventory.length === 0" class="status-inventory-empty">
              nothing
            </div>
            <ul v-else class="status-inventory">
              <li
                v-for="item in game.playerInventory"
                :key="item.id"
                class="status-inventory__item"
                :class="{ 'status-inventory__item--usable': item.type === 'consumable' }"
                :title="item.description"
                @click="useItem(item)"
              >
                <span class="status-inventory__name">{{ item.name }}</span>
                <span v-if="item.quantity > 1" class="status-inventory__quantity">
                  ×{{ item.quantity }}
                </span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Work tab — everything the player has made, as they see it -->
        <div v-if="activeTab === 'work'" class="sidebar-panel sidebar-panel--work">
          <div class="status-section status-section--grow">
            <div class="status-section__label">made</div>
            <div v-if="game.playerWorks.length === 0" class="status-inventory-empty">nothing</div>
            <ul v-else class="status-works">
              <li
                v-for="work in game.playerWorks"
                :key="work.id"
                class="status-works__item"
                :title="work.artistText"
              >
                <span class="status-works__text">{{ work.workText }}</span>
                <span class="status-works__whereabouts">{{ work.whereabouts }}</span>
              </li>
            </ul>
          </div>
        </div>
      </aside>
    </main>

    <GameFooter />
  </div>
</template>

<script setup>
import { ref, computed, provide } from 'vue'
import { useRouter } from 'vue-router'
import { useGameStore } from '../../stores/game.js'
import { useNarrative, narrativeSkipBindings } from '../../composables/useNarrative.js'
import { useGameLoop } from '../../composables/useGameLoop.js'
import { useSave } from '../../composables/useSave.js'
import { useKeyboard } from '../../composables/useKeyboard.js'
import { loadActions, loadEvents } from '../../data/loader.js'
import { formatTime } from '../../engine/clock.js'
import { STATUS_BAR_STATS, statusBarFillClass } from '../../utils/statusBar.js'
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

// Load action and event registries from content/
const actionRegistry = Object.values(loadActions('kenton'))
const eventRegistry = Object.values(loadEvents('kenton'))

const narrative = useNarrative()
provide('narrative', narrative)

// Space skips the running narrative from anywhere on the screen
useKeyboard(narrativeSkipBindings({ narrative }))

const save = useSave()
const gameLoop = useGameLoop({ actionRegistry, eventRegistry, narrative, save })
provide('gameLoop', gameLoop)

// Selected character — set by LocationView when player clicks a character,
// read by ActionMenu to filter to that character's interaction actions.
// null = no character selected, show location actions only.
const selectedCharacterId = ref(null)
provide('selectedCharacterId', selectedCharacterId)

/** Live entry state — driven by the narrative composable itself */
const activeEntry = computed(() => narrative.activeEntryState.value)

// === Sidebar tabs ===

const activeTab = ref('status')

// === Status sidebar data ===

const formattedTime = computed(() => formatTime(game.time))
const money = computed(() => game.playerMoney)
const formattedMoney = computed(() => {
  const m = money.value
  if (m < 0) return `-${Math.abs(m).toFixed(2)}`
  return m.toFixed(2)
})

const statusStats = computed(() =>
  STATUS_BAR_STATS.map((stat) => ({ ...stat, value: game.player?.status?.[stat.key] ?? 0 }))
)

function barFillClass(key, value) {
  return statusBarFillClass({ key, value })
}

// === Inventory ===

/** Use one of a consumable. The loop owns what that means. */
function useItem(item) {
  if (item.type !== 'consumable') return
  gameLoop.useItem({ itemId: item.id })
}
</script>

<style lang="scss" scoped>
@use '../../scss/variables' as *;

// === Sidebar tabs ===

.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid $color-border;
  margin: #{-$spacing-md} #{-$spacing-md} 0;
  padding: 0 $spacing-md;
}

.sidebar-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 12px 7px;
  font-family: $font-ui;
  font-size: 10px;
  color: $color-text-muted;
  text-transform: uppercase;
  letter-spacing: 1px;
  cursor: pointer;
  margin-bottom: -1px;
  transition:
    color 150ms ease,
    border-color 150ms ease;

  &:hover {
    color: $color-text-secondary;
  }

  &--active {
    color: $color-amber;
    border-bottom-color: $color-amber;
  }
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding-top: $spacing-md;

  &--inventory {
    flex: 1 1 auto;
  }
}

// === Status Sections ===

.status-section {
  display: flex;
  flex-direction: column;
  gap: $spacing-xs;

  &--grow {
    flex: 1 1 auto;
  }
}

.status-section__label {
  font-size: 10px;
  color: $color-text-muted;
  text-transform: uppercase;
  letter-spacing: 1px;
  font-family: $font-ui;
}

.status-time {
  font-family: $font-mono;
  font-size: $font-size-sm;
  color: $color-text-secondary;
}

// === Stat bars ===

.status-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.status-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-stat__header {
  display: flex;
  align-items: center;
  gap: 5px;
}

.status-stat__icon {
  font-size: 10px;
  line-height: 1;
  opacity: 0.7;
  flex-shrink: 0;
}

.status-stat__label {
  font-size: 11px;
  color: $color-text-secondary;
  font-family: $font-ui;
  flex: 1 1 auto;
  letter-spacing: 0.3px;
}

.status-stat__value {
  font-size: 10px;
  color: $color-text-muted;
  text-align: right;
  font-family: $font-mono;
  flex-shrink: 0;
  min-width: 24px;
}

.status-stat__track {
  height: 7px;
  background: $color-border;
  border-radius: 2px;
  overflow: hidden;
}

// Per-stat base colours
.status-stat__fill {
  height: 100%;
  transition:
    width 400ms ease,
    background-color 400ms ease;
  border-radius: 2px;

  &--health {
    background: $color-stat-health;
  }
  &--energy {
    background: $color-stat-energy;
  }
  &--mood {
    background: $color-stat-mood;
  }
  &--sobriety {
    background: $color-stat-sobriety;
  }
  &--hunger {
    background: $color-stat-hunger;
  }

  // Override with danger/warning states
  &--warning {
    background: $color-warning !important;
  }

  &--danger {
    background: $color-danger !important;
  }
}

// Money

.status-muse {
  font-family: $font-mono;
  font-size: $font-size-sm;
  color: $color-text-muted;
  font-style: italic;

  &--active {
    color: $color-text-primary;
  }
}

.status-money {
  display: flex;
  align-items: baseline;
  gap: 2px;
  font-family: $font-mono;

  &--negative {
    .status-money__amount {
      color: $color-danger;
    }
  }
}

.status-money__sign {
  font-size: 11px;
  color: $color-accent;
}

.status-money__amount {
  font-size: $font-size-sm;
  color: $color-text-primary;
}

// Inventory

.status-inventory {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: $font-mono;
  font-size: $font-size-sm;
  color: $color-text-secondary;
}

.status-inventory__item {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.15rem 0;
}

.status-inventory__item--usable {
  cursor: pointer;
  color: $color-text-primary;

  &:hover {
    text-decoration: underline;
  }
}

.status-inventory__quantity {
  color: $color-text-muted;
}

// Work

.status-works {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: $font-mono;
  font-size: $font-size-sm;
}

.status-works__item {
  display: flex;
  flex-direction: column;
  padding: 0.3rem 0;
}

.status-works__text {
  color: $color-text-primary;
}

.status-works__whereabouts {
  color: $color-text-muted;
  font-style: italic;
}

.status-inventory-empty {
  font-size: $font-size-sm;
  color: $color-text-muted;
  font-family: $font-mono;
  font-style: italic;
}
</style>
