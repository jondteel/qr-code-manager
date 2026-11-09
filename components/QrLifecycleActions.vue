<template>
  <div class="mb-4">
    <p class="mb-2 text-sm font-semibold capitalize" tabindex="-1" ref="stateLabel">{{ qr.lifecycleStatus }}</p>
    <p v-if="qr.lifecycleStatus === 'archived'" class="mb-2 text-sm text-gray-600">Archived. Tracked links and scan recording remain active.</p>
    <p v-if="qr.lifecycleStatus === 'retired'" class="mb-2 text-sm text-gray-600">Retired permanently for this release. Tracked redirects are unavailable; history is retained. Distributed direct-content images cannot be revoked.</p>
    <div v-if="qr.lifecycleStatus !== 'retired'" class="flex flex-wrap gap-2">
      <button type="button" :disabled="busy || disabled" @click="changeStatus(qr.lifecycleStatus === 'archived' ? 'active' : 'archived')" class="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">
        {{ qr.lifecycleStatus === 'archived' ? 'Restore to Active' : 'Archive' }}
      </button>
      <button type="button" :disabled="busy || disabled" @click="openRetire" class="rounded border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50">Retire</button>
    </div>
    <p v-if="busy" role="status" class="mb-2 text-sm text-gray-600">Updating lifecycle…</p>
    <p v-if="message" role="status" class="text-sm text-gray-700">{{ message }}</p>
    <dialog ref="retireDialog" class="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-h-[calc(100%_-_2rem)] overflow-y-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl backdrop:bg-black/50" :aria-labelledby="`retire-title-${qr.id}`" :aria-describedby="`retire-warning-${qr.id}`" @close="restoreFocus">
      <h2 :id="`retire-title-${qr.id}`" class="text-lg font-semibold">Retire QR code?</h2>
      <p :id="`retire-warning-${qr.id}`" class="my-4 text-sm text-gray-700">Retiring “{{ qr.title }}” disables its tracked redirects and stops new accepted scans. History and its short code are retained. Reactivation is unavailable. Direct-content QR images already distributed cannot be revoked.</p>
      <div class="flex flex-wrap gap-3">
        <button autofocus type="button" @click="retireDialog.close()" class="rounded border border-gray-300 px-4 py-2">Cancel</button>
        <button type="button" @click="confirmRetire" class="rounded bg-red-600 px-4 py-2 text-white">Retire QR</button>
      </div>
    </dialog>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
const props = defineProps({ qr: { type: Object, required: true }, disabled: Boolean });
const emit = defineEmits(['changed', 'busy', 'reload']);
const busy = ref(false), message = ref(''), retireDialog = ref(null), stateLabel = ref(null);
let active = true, opener = null;
const restoreFocus = () => opener?.focus?.();
const openRetire = event => {
  if (busy.value || props.disabled || props.qr.lifecycleStatus === 'retired') return;
  opener = event.currentTarget;
  retireDialog.value.showModal();
};
const confirmRetire = () => { retireDialog.value.close(); return changeStatus('retired'); };
const changeStatus = async status => {
  if (!active || busy.value || props.disabled || props.qr.lifecycleStatus === 'retired') return;
  const id = props.qr.id;
  busy.value = true; message.value = ''; emit('busy', true);
  try {
    const result = await $fetch(`/api/qr/${id}/lifecycle`, { method: 'PATCH', body: { status } });
    if (!active || props.qr.id !== id) return;
    emit('changed', result.qrCode);
    message.value = `QR is now ${result.qrCode.lifecycleStatus}.`;
    stateLabel.value?.focus();
  } catch {
    if (!active || props.qr.id !== id) return;
    message.value = 'Lifecycle update could not be confirmed. Reload before trying again.';
    emit('reload');
  } finally {
    busy.value = false;
    if (active) emit('busy', false);
  }
};
onBeforeUnmount(() => { active = false; });
</script>
