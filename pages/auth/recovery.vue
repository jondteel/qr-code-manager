<template>
  <AccountPanel style="overflow-wrap: anywhere" title="Choose a new password">
    <p v-if="loading" role="status">Checking recovery availability…</p>
    <p v-else-if="!enabled" role="status">Password recovery is temporarily unavailable. No password was changed. Please try again later.</p>
    <p v-else-if="!capability && !busy && !done" role="status">This recovery link is invalid, expired, or already used. Request a new link to continue.</p>
    <form v-else-if="!done" @submit.prevent="submit" class="space-y-4">
      <p>Choose a new password. After recovery, sign in again.</p>
      <div><label for="new-password" class="block font-medium">New password</label>
        <input id="new-password" ref="passwordInput" v-model="password" type="password" autocomplete="new-password" required minlength="6" maxlength="128" :disabled="busy" aria-describedby="password-help" class="border rounded p-3 w-full" /></div>
      <p id="password-help">Use 6–128 characters. Your account's password security requirements also apply.</p>
      <div><label for="confirm-password" class="block font-medium">Confirm new password</label>
        <input id="confirm-password" v-model="confirmation" type="password" autocomplete="new-password" required minlength="6" maxlength="128" :disabled="busy" class="border rounded p-3 w-full" /></div>
      <button type="submit" :disabled="busy" class="bg-blue-700 text-white rounded px-4 py-3 disabled:opacity-60">{{ busy ? 'Updating…' : 'Update password' }}</button>
    </form>
    <p v-if="message" ref="resultMessage" tabindex="-1" role="status" aria-live="polite" class="mt-4">{{ message }}</p>
    <NuxtLink to="/forgot-password" class="underline text-blue-700 inline-block mt-6 mr-4">Request a new link</NuxtLink>
    <NuxtLink to="/login" class="underline text-blue-700 inline-block mt-6">Sign in</NuxtLink>
  </AccountPanel>
</template>
<script setup lang="ts">
useHead({ title: "Password recovery | Scanlytics", meta: [{ name: "referrer", content: "no-referrer" }] })
// A closure-only capability: never serialized by Nuxt state, URL query, cookies
// or browser storage. Capture and scrub before the first availability request.
let capability = ''
const password = ref(''), confirmation = ref(''), loading = ref(true), enabled = ref(false), busy = ref(false), done = ref(false), message = ref('')
const passwordInput = ref<HTMLInputElement>(), resultMessage = ref<HTMLElement>()
onMounted(async () => {
  const fragment = window.location.hash.slice(1)
  window.history.replaceState(null, '', '/auth/recovery')
  if (/^r1\.[A-Za-z0-9_-]{43}\.[A-Za-z0-9_-]{43}\.(?:pkce_)?[a-f0-9]{56,128}$/.test(fragment)) capability = fragment
  try { enabled.value = (await $fetch<{ enabled: boolean }>('/api/auth/recovery-status')).enabled } catch {}
  loading.value = false
})
onBeforeUnmount(() => { capability = ''; password.value = ''; confirmation.value = '' })
async function submit() {
  if (busy.value || !capability) return
  if (password.value !== confirmation.value) { message.value = 'The passwords do not match.'; passwordInput.value?.focus(); return }
  busy.value = true; message.value = ''
  // A network failure must not offer a blind second mutation attempt.
  const submitted = capability; capability = ''
  try {
    const response = await fetch('/api/auth/recovery-complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ capability: submitted, password: password.value, confirmation: confirmation.value }), cache: 'no-store' })
    const result = await response.json()
    message.value = result.state === 'password-updated' ? 'Your password was updated. Sign in with your new password.' : result.state === 'outcome-unknown' ? 'The result could not be confirmed. Try signing in with your new password. Do not resubmit this link.' : 'Recovery could not be completed. The link may be expired, used, or your account may require additional security checks. Request a new link or contact support.'
  } catch { message.value = 'The result could not be confirmed. Try signing in with your new password. Do not resubmit this link.' }
  finally { password.value = ''; confirmation.value = ''; busy.value = false; done.value = true; await nextTick(); resultMessage.value?.focus() }
}
</script>
