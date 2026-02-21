<!-- pages/login.vue -->
<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4"
  >
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Sign In</h2>

      <form @submit.prevent="handleLogin" class="space-y-4">
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
            autocomplete="current-password"
            :disabled="isSubmitting"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="••••••••"
          />
        </div>

        <div
          v-if="errorMessage"
          class="text-red-600 text-sm"
          aria-live="polite"
        >
          {{ errorMessage }}
        </div>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {{ isSubmitting ? "Signing In..." : "Sign In" }}
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

<script setup lang="ts">
const supabase = useSupabaseClient();
const user = useSupabaseUser();
const route = useRoute();

const email = ref("");
const password = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);

// Redirect if already logged in
watch(
  () => user.value,
  async (currentUser) => {
    if (!currentUser) return;

    const redirectParam = route.query.redirect;
    const redirectTo =
      typeof redirectParam === "string" && redirectParam.startsWith("/")
        ? redirectParam
        : "/dashboard";

    await navigateTo(redirectTo);
  },
  { immediate: true }
);

// Clear error when user edits fields
watch([email, password], () => {
  if (errorMessage.value) errorMessage.value = "";
});

const handleLogin = async () => {
  if (isSubmitting.value) return;

  try {
    isSubmitting.value = true;
    errorMessage.value = "";

    const normalizedEmail = email.value.trim().toLowerCase();
    const pw = password.value;

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pw,
    });

    if (error) {
      // Friendlier fallback messages
      const msg = error.message?.toLowerCase() || "";
      if (
        msg.includes("invalid login credentials") ||
        msg.includes("invalid credentials")
      ) {
        errorMessage.value = "Invalid email or password.";
      } else {
        errorMessage.value = error.message || "Unable to sign in.";
      }
      return;
    }

    const redirectParam = route.query.redirect;
    const redirectTo =
      typeof redirectParam === "string" && redirectParam.startsWith("/")
        ? redirectParam
        : "/dashboard";

    await navigateTo(redirectTo);
  } catch {
    errorMessage.value = "An error occurred during login.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>