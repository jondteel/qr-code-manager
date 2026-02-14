<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <div v-if="redirecting" class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p v-if="redirecting" class="text-gray-600">Redirecting...</p>
      <div v-else-if="error" class="text-red-600">
        <p>{{ error }}</p>
        <NuxtLink to="/" class="text-blue-600 hover:underline mt-4 inline-block">Go to home</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const code = route.params.code

const redirecting = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    // Fetch the redirect URL
    const response = await $fetch(`/api/redirect/${code}`)
    
    if (response.error || !response.url) {
      error.value = 'Link not found'
      redirecting.value = false
    } else {
      // Redirect to the original URL
      window.location.href = response.url
    }
  } catch (e) {
    error.value = 'Failed to redirect'
    redirecting.value = false
  }
})
</script>