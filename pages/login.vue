<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Sign In</h2>
      
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input 
            v-model="email" 
            type="email" 
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input 
            v-model="password" 
            type="password" 
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>
        
        <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>
        
        <button 
          type="submit" 
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Sign In
        </button>
      </form>
      
      <p class="mt-6 text-center text-gray-600">
        Don't have an account? 
        <NuxtLink to="/signup" class="text-blue-600 hover:text-blue-700 font-semibold">
          Sign Up
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')

// Redirect if already logged in
watchEffect(() => {
  if (user.value) {
    router.push('/dashboard')
  }
})

const handleLogin = async () => {
  try {
    error.value = ''
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })
    
    if (loginError) {
      error.value = loginError.message
    } else {
      router.push('/dashboard')
    }
  } catch (err) {
    error.value = 'An error occurred during login'
  }
}
</script>