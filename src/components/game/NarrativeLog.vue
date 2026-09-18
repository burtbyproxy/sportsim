<template>
  <div
    ref="logEl"
    class="narrative-log"
    role="log"
    aria-live="polite"
    aria-label="Game narrative"
    @click="handleSkip"
  >
    <!-- Completed log entries -->
    <div v-for="entry in log" :key="entry.id" class="narrative-entry narrative-text">
      <span
        v-for="(token, i) in entry.tokens"
        :key="i"
        :class="tokenClass(token)"
        :style="tokenStyle(token)"
        >{{ token.rendered }}</span
      >
    </div>

    <!-- Currently animating entry -->
    <div
      v-if="isAnimating && activeEntry"
      class="narrative-entry narrative-text narrative-entry--active"
    >
      <span
        v-for="(token, i) in activeEntry.completedTokens"
        :key="`done-${i}`"
        :class="tokenClass(token)"
        :style="tokenStyle(token)"
        >{{ token.text }}</span
      >
      <span
        v-if="activeEntry.currentToken"
        :class="tokenClass(activeEntry.currentToken)"
        :style="tokenStyle(activeEntry.currentToken)"
        class="cursor-blink"
        >{{ currentTokenProgress }}</span
      >
    </div>

    <!-- Skip hint -->
    <div v-if="isAnimating" class="narrative-skip-hint">space to skip</div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  /** Array of completed log entries from useNarrative */
  log: {
    type: Array,
    default: () => [],
  },
  /** Whether animation is in progress */
  isAnimating: {
    type: Boolean,
    default: false,
  },
  /** Current token progress text */
  currentTokenProgress: {
    type: String,
    default: '',
  },
  /** Active entry being rendered (from parent, tracks state) */
  activeEntry: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['skip'])

const logEl = ref(null)

function handleSkip() {
  if (props.isAnimating) {
    emit('skip')
  }
}

/** Auto-scroll to bottom when log updates */
watch(
  () => [props.log.length, props.currentTokenProgress],
  async () => {
    await nextTick()
    if (logEl.value) {
      logEl.value.scrollTop = logEl.value.scrollHeight
    }
  }
)

function tokenClass(token) {
  const classes = [`token-${token.style ?? 'normal'}`]
  if (token.effect && token.effect !== 'none') {
    classes.push(`effect-${token.effect}`)
  }
  return classes
}

function tokenStyle(token) {
  if (token.color) {
    return { color: token.color }
  }
  return {}
}
</script>

<style lang="scss" scoped>
@use '../../scss/variables' as *;

.narrative-log {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 20px 32px 28px 28px;
  outline: none;
  cursor: default;
}

.narrative-entry--active {
  opacity: 0.95;
}

.narrative-skip-hint {
  font-size: 10px;
  color: $color-text-muted;
  margin-top: 16px;
  opacity: 0.45;
  letter-spacing: 0.5px;
  font-style: italic;
}
</style>
