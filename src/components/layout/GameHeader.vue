<template>
  <header class="game-header">
    <div class="header-time">
      <span class="ui-label">{{ formattedTime }}</span>
    </div>

    <div class="header-stats">
      <div
        v-for="stat in statusStats"
        :key="stat.key"
        class="header-stat"
        :title="`${stat.label}: ${stat.value}`"
      >
        <span class="ui-label">{{ stat.label }}</span>
        <div class="stat-bar">
          <div
            class="stat-bar__fill"
            :class="barFillClass(stat.value)"
            :style="{ width: `${stat.value}%` }"
          ></div>
        </div>
      </div>
    </div>

    <div class="header-money">
      <span class="ui-label">$</span>
      <span class="ui-value" :class="{ 'header-money--negative': money < 0 }">
        {{ formattedMoney }}
      </span>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { useGameStore } from '../../stores/game.js'
import { formatTime } from '../../engine/clock.js'

const game = useGameStore()

const formattedTime = computed(() => formatTime(game.time))
const money = computed(() => game.playerMoney)
const formattedMoney = computed(() => {
  const m = money.value
  if (m < 0) return `-${Math.abs(m).toFixed(2)}`
  return m.toFixed(2)
})

const statusStats = computed(() => [
  { key: 'health', label: 'HP', value: game.playerHealth },
  { key: 'energy', label: 'EN', value: game.playerEnergy },
  { key: 'mood', label: 'MD', value: game.playerMood },
  { key: 'sobriety', label: 'SB', value: game.playerSobriety },
  { key: 'hunger', label: 'HG', value: game.playerHunger },
])

function barFillClass(value) {
  if (value <= 20) return 'stat-bar__fill--danger'
  if (value <= 40) return 'stat-bar__fill--warning'
  return ''
}
</script>

<style lang="scss" scoped>
.game-header {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 100%;
  padding: 0 16px;
  background: #111111;
  border-bottom: 1px solid #2a2a2a;
}

.header-time {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 13px;
  color: #888878;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
}

.header-stat {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 60px;

  .ui-label {
    font-size: 10px;
    color: #555548;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  .stat-bar {
    flex: 1;
    height: 3px;
    background: #2a2a2a;
    border-radius: 1px;
    overflow: hidden;
    min-width: 32px;
  }
}

.header-money {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 13px;

  .ui-label {
    color: #7aad5a;
    font-size: 11px;
  }

  .ui-value {
    color: #c8c8a8;
    font-family: 'Courier New', monospace;
  }

  &--negative {
    color: #c04040;
  }
}
</style>
