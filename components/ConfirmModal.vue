<!-- ConfirmModal.vue -->
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 overflow-y-auto"
        @keydown.esc.prevent="onCancel"
      >
        <!-- Overlay (click outside closes) -->
        <div
          class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          @click.self="onCancel"
        ></div>

        <!-- Modal -->
        <div class="flex min-h-full items-center justify-center p-4">
          <div
            class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 transform transition-all"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="titleId"
            :aria-describedby="descId"
            tabindex="-1"
            ref="dialogRef"
          >
            <!-- Icon -->
            <div
              class="mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4"
              :class="type === 'danger' ? 'bg-red-100' : 'bg-blue-100'"
            >
              <svg
                v-if="type === 'danger'"
                class="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <svg
                v-else
                class="h-6 w-6 text-blue-600"
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

            <!-- Title -->
            <h3
              class="text-lg font-semibold text-gray-900 text-center mb-2"
              :id="titleId"
            >
              {{ title }}
            </h3>

            <!-- Message -->
            <p
              class="text-sm text-gray-600 text-center mb-6"
              :id="descId"
            >
              {{ message }}
            </p>

            <!-- Actions -->
            <div class="flex gap-3">
              <button
                ref="cancelBtnRef"
                @click="onCancel"
                class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                {{ cancelText }}
              </button>
              <button
                @click="onConfirm"
                class="flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition"
                :class="type === 'danger'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-600 hover:bg-blue-700'"
              >
                {{ confirmText }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, default: "Confirm Action" },
  message: { type: String, default: "Are you sure you want to proceed?" },
  confirmText: { type: String, default: "Confirm" },
  cancelText: { type: String, default: "Cancel" },
  type: {
    type: String,
    default: "info",
    validator: (value) => ["info", "danger"].includes(value),
  },
});

const emit = defineEmits(["confirm", "cancel"]);

const dialogRef = ref(null);
const cancelBtnRef = ref(null);

const titleId = computed(() => "confirm-modal-title");
const descId = computed(() => "confirm-modal-desc");

const onConfirm = () => emit("confirm");
const onCancel = () => emit("cancel");

// Prevent background scroll while modal is open
const lockScroll = () => {
  document.body.style.overflow = "hidden";
};
const unlockScroll = () => {
  document.body.style.overflow = "";
};

// Focus cancel button when opened (good UX + accessibility)
watch(
  () => props.show,
  async (isOpen) => {
    if (isOpen) {
      lockScroll();
      await nextTick();
      cancelBtnRef.value?.focus?.();
    } else {
      unlockScroll();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  unlockScroll();
});
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  opacity: 0;
  transform: scale(0.95);
}
</style>