<template>
  <AccountPanel style="overflow-wrap: anywhere" title="Reset your password">
    <p v-if="loading" role="status">Checking recovery availability…</p>
    <template v-else-if="!enabled">
      <p role="status" class="mb-4">Password recovery is temporarily unavailable. Please try again later.</p>
    </template>
    <form v-else @submit.prevent="submit" class="space-y-4">
      <p>Enter your account email to request recovery instructions.</p>
      <div><label for="recovery-email" class="block font-medium">Email</label>
        <input id="recovery-email" v-model="email" type="email" autocomplete="email" required maxlength="254" :disabled="busy" class="border rounded p-3 w-full" /></div>
      <button type="submit" :disabled="busy" class="bg-blue-700 text-white rounded px-4 py-3 disabled:opacity-60">{{ busy ? 'Requesting…' : 'Send recovery instructions' }}</button>
      <p v-if="message" role="status" aria-live="polite">{{ message }}</p>
    </form>
    <NuxtLink to="/login" class="underline text-blue-700 inline-block mt-6">Back to sign in</NuxtLink>
  </AccountPanel>
</template>
<script setup lang="ts">
useHead({ title: "Password recovery | Scanlytics", meta: [{ name: "referrer", content: "no-referrer" }] })
const email = ref(''), loading = ref(true), enabled = ref(false), busy = ref(false), message = ref('')
onMounted(async () => {
  try { enabled.value = (await $fetch<{ enabled: boolean }>('/api/auth/recovery-status')).enabled } catch {}
  loading.value = false
})
async function submit() {
  if (busy.value) return
  busy.value = true; message.value = ''
  try {
    const response = await fetch('/api/auth/recovery-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.value }), cache: 'no-store' })
    const result = await response.json()
    message.value = response.ok ? result.message : 'Recovery is unavailable. Please try again later.'
  } catch { message.value = 'The request could not be confirmed. Please try again later.' }
  finally { busy.value = false }
}
</script>
