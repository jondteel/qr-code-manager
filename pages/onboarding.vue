<template>
  <AccountPanel title="Set up your profile">
    <p class="mb-4">After authentication, choose a username to finish setup. Existing profiles stay unchanged.</p>
    <p role="status" class="mb-4">{{ message }}</p>
    <form v-if="state === 'onboarding-required' || state === 'username-conflict' || state === 'invalid-input'" @submit.prevent="submit" class="space-y-4">
      <label for="username" class="block font-medium">Username</label>
      <input id="username" ref="usernameInput" v-model="username" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_]+" autocomplete="username" class="w-full border rounded-lg p-3" aria-describedby="username-help" :disabled="busy">
      <p id="username-help" class="text-sm">3–20 letters, numbers or underscores. Stored in lowercase.</p>
      <button :disabled="busy" class="w-full p-3 rounded-lg bg-blue-600 text-white">{{ busy ? 'Saving…' : 'Create profile' }}</button>
    </form>
    <button v-if="state === 'temporarily-unavailable'" @click="check" :disabled="busy" class="my-4 underline text-blue-700">Retry account check</button>
    <NuxtLink v-if="state === 'invalid-session'" :to="{ path: '/login', query: { redirect: target } }" class="block my-4 underline text-blue-700">Sign in</NuxtLink>
    <p v-if="state === 'review-required'" class="mb-4">Use a confirmed native email account. Social, SSO and linked accounts are not supported. Account details may also need review. No profile or QR records have been reassigned.</p>
    <button @click="signOut" :disabled="logoutBusy" class="mt-6 underline">Sign out of this session</button>
    <p v-if="logoutError" role="alert">{{ logoutError }}</p>
  </AccountPanel>
</template>
<script setup lang="ts">
import { accountReturnPath } from '~/utils/auth-navigation.mjs'
const target = accountReturnPath(useRoute().query.redirect), readiness = useAccountReadiness()
const state = ref('checking'), username = ref(''), busy = ref(false), usernameInput = ref<HTMLInputElement>()
const { signOut, logoutError, logoutBusy } = useAccountLogout()
const messages: Record<string,string> = { checking: 'Checking your account…', 'onboarding-required': 'Your authenticated account needs a profile.', 'username-conflict': 'That username is unavailable. Choose another.', 'invalid-input': 'Enter a valid username.', 'invalid-session': 'Your session is missing or expired. Sign in to continue.', 'temporarily-unavailable': 'Account status is temporarily unavailable. Retry safely.', 'review-required': 'Setup cannot safely continue automatically.' }
const message = computed(() => messages[state.value] ?? 'Account ready.')
const apply = async (result: {state:string}) => { state.value = result.state; if (result.state === 'ready') await navigateTo(target) }
const check = async () => { busy.value = true; await apply(await readiness()); busy.value = false }
onMounted(check)
const submit = async () => {
  if (busy.value) return
  busy.value = true
  try { await apply(await $fetch('/api/auth/onboard', { method: 'POST', retry: 0, body: { username: username.value } })) }
  catch (error: any) { state.value = error?.data?.state ?? 'temporarily-unavailable'; busy.value = false; await nextTick(); usernameInput.value?.focus() }
  finally { busy.value = false }
}
</script>
