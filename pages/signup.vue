<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Create Account</h2>
      
      <form @submit.prevent="handleSignup" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
          <input 
            v-model="name" 
            type="text" 
            required
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="John Doe"
          />
        </div>
        
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
            minlength="6"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>
        
        <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>
        <div v-if="success" class="text-green-600 text-sm">{{ success }}</div>
        
        <button 
          type="submit" 
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
        >
          Sign Up
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

<script setup>
const supabase = useSupabaseClient()
const router = useRouter()

const name = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const success = ref('')

const handleSignup = async () => {
  try {
    error.value = ''
    success.value = ''
    
    const { data, error: signupError } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      options: {
        data: {
          name: name.value
        }
      }
    })
    
    if (signupError) {
      error.value = signupError.message
    } else {
      success.value = 'Account created! Check your email to verify.'
      // Optionally redirect after a delay
      setTimeout(() => router.push('/login'), 2000)
    }
  } catch (err) {
    error.value = 'An error occurred during signup'
  }
}
</script>