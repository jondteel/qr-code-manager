<template>
  <AccountPanel title="Email confirmation">
    <p role="status" class="mb-4">{{ message }}</p>
    <button v-if="!busy" @click="check" class="block my-4 underline text-blue-700">Check signed-in account</button>
    <NuxtLink to="/login" class="block my-4 underline text-blue-700">Sign in to continue</NuxtLink>
    <p class="text-sm">If no session is available, confirmation may still have succeeded. Sign in in this browser. Expired or reused links require fresh instructions. PKCE links may require the browser that started signup.</p>
  </AccountPanel>
</template>
<script setup lang="ts">
const client = useSupabaseClient(), readiness = useAccountReadiness()
const busy = ref(true), message = ref('Checking confirmation…')
const check = async () => {
  busy.value = true
  // SDK initialization owns automatic exchange. Never exchange a code twice.
  await client.auth.getSession()
  window.history.replaceState(window.history.state, '', '/auth/confirm')
  const result = await readiness()
  if (result.state === 'ready' || result.state === 'onboarding-required') { message.value = 'Your authenticated account is verified.'; await navigateTo(result.state === 'ready' ? '/dashboard' : '/onboarding') }
  else message.value = result.state === 'temporarily-unavailable' ? 'Confirmation status is temporarily unavailable. Please retry.' : 'No signed-in session was verified. Sign in to check confirmation, or use fresh instructions if this link expired.'
  busy.value = false
}
onMounted(async () => {
  const failed = !!(useRoute().query.error || useRoute().query.error_code)
  if (failed) { window.history.replaceState(window.history.state, '', '/auth/confirm'); message.value = 'This confirmation link is invalid or expired. Try signing in or request fresh instructions from your account provider.'; busy.value = false; return }
  try { await check() } catch { message.value = 'Confirmation could not be checked. Try signing in or retry later.'; busy.value = false }
})
</script>
