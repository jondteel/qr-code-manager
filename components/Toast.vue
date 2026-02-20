<!-- Toast.vue -->
<template>
  <ClientOnly>
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="show" class="fixed top-4 right-4 z-50">
          <div
            class="bg-white rounded-lg shadow-lg border max-w-sm p-4 flex items-start gap-3"
            :class="borderClass"
            :role="ariaRole"
            :aria-live="ariaLive"
            @mouseenter="pauseOnHover ? pauseTimer() : null"
            @mouseleave="pauseOnHover ? resumeTimer() : null"
          >
            <!-- Icon -->
            <div class="flex-shrink-0">
              <svg
                v-if="type === 'success'"
                class="h-5 w-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>

              <svg
                v-else-if="type === 'error'"
                class="h-5 w-5 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>

              <svg
                v-else
                class="h-5 w-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <!-- Message -->
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-900">{{ message }}</p>
            </div>

            <!-- Close button -->
            <button
              @click="close"
              type="button"
              class="flex-shrink-0 text-gray-400 hover:text-gray-600"
              aria-label="Close notification"
            >
              <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from "vue";

const props = defineProps({
  show: { type: Boolean, default: false },
  message: { type: String, default: "" },
  type: {
    type: String,
    default: "info", // 'success' | 'error' | 'info'
    validator: (v) => ["success", "error", "info"].includes(v),
  },
  duration: { type: Number, default: 3000 },
  pauseOnHover: { type: Boolean, default: true },
});

const emit = defineEmits(["close"]);
const close = () => emit("close");

// Styling helpers
const borderClass = computed(() =>
  props.type === "success"
    ? "border-green-200"
    : props.type === "error"
    ? "border-red-200"
    : "border-blue-200"
);

// Accessibility helpers
const ariaRole = computed(() => (props.type === "error" ? "alert" : "status"));
const ariaLive = computed(() => (props.type === "error" ? "assertive" : "polite"));

// Timer management
let timerId = null;
let remaining = 0;
let startedAt = null;

const clearTimer = () => {
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
};

const startTimer = () => {
  clearTimer();
  if (!props.show || props.duration <= 0) return;

  remaining = props.duration;
  startedAt = Date.now();
  timerId = setTimeout(close, remaining);
};

const pauseTimer = () => {
  if (!timerId) return;
  const elapsed = Date.now() - (startedAt ?? Date.now());
  remaining = Math.max(0, remaining - elapsed);
  clearTimer();
};

const resumeTimer = () => {
  if (!props.show || props.duration <= 0) return;
  if (remaining <= 0) return close();

  startedAt = Date.now();
  clearTimer();
  timerId = setTimeout(close, remaining);
};

// Auto-close when shown
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) startTimer();
    else clearTimer();
  }
);

// If duration changes while open, restart timer
watch(
  () => props.duration,
  () => {
    if (props.show) startTimer();
  }
);

onBeforeUnmount(() => {
  clearTimer();
});
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-1rem);
}
</style>