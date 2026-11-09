<!-- pages/signup.vue -->
<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4"
  >
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-4 sm:p-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center break-words">Create Account</h2>

      <form @submit.prevent="handleSignup" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2" for="email">
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            :disabled="isSubmitting"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2" for="password">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="6"
            autocomplete="new-password"
            :disabled="isSubmitting"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="••••••••"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2" for="confirmPassword">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            v-model="confirmPassword"
            type="password"
            required
            minlength="6"
            autocomplete="new-password"
            :disabled="isSubmitting"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="••••••••"
          />
        </div>

        <div v-if="errorMessage" class="text-red-600 text-sm" aria-live="polite">
          {{ errorMessage }}
        </div>

        <div v-if="successMessage" class="text-green-600 text-sm" aria-live="polite">
          {{ successMessage }}
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ isSubmitting ? "Creating Account..." : "Sign Up" }}
        </button>
      </form>

      <p class="mt-6 text-center text-gray-600">
        Already have an account?
        <NuxtLink to="/login" class="text-blue-600 hover:text-blue-700 font-semibold">
          Sign In
        </NuxtLink>
      </p>
    </div>
  </div>
</template>


<script setup lang="ts">
const email = ref(''), password = ref(''), confirmPassword = ref('')
const errorMessage = ref(''), successMessage = ref(''), isSubmitting = ref(false)
const handleSignup = async () => {
  if (isSubmitting.value) return
  errorMessage.value = ''; successMessage.value = ''
  if (password.value !== confirmPassword.value || password.value.length < 6 || password.value.length > 128) { errorMessage.value = 'Use matching passwords of 6 to 128 characters.'; return }
  isSubmitting.value = true
  try {
    const result = await $fetch<{ message: string }>('/api/auth/signup', { method: 'POST', retry: 0, body: { email: email.value, password: password.value } })
    successMessage.value = result.message
    password.value = ''; confirmPassword.value = ''
  } catch { errorMessage.value = 'The request could not be confirmed. Wait before retrying, or try signing in if you have already registered.' }
  finally { isSubmitting.value = false }
}
</script>
