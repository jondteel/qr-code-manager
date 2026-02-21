<!-- pages/signup.vue -->
<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4"
  >
    <div class="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
      <h2 class="text-3xl font-bold text-gray-900 mb-6 text-center">Create Account</h2>

      <form @submit.prevent="handleSignup" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2" for="username">
            Username
          </label>
          <input
            id="username"
            v-model="username"
            type="text"
            required
            minlength="3"
            maxlength="20"
            pattern="[a-zA-Z0-9_]+"
            autocomplete="username"
            :disabled="isSubmitting"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="johndoe123"
          />
          <p class="text-xs text-gray-500 mt-1">
            3-20 characters, letters, numbers, and underscores only
          </p>
        </div>

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
const route = useRoute();

const username = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");

const errorMessage = ref("");
const successMessage = ref("");
const isSubmitting = ref(false);

// clear messages while typing
watch([username, email, password, confirmPassword], () => {
  if (errorMessage.value) errorMessage.value = "";
  if (successMessage.value) successMessage.value = "";
});

function validateUsername(value: string) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(value);
}

const handleSignup = async () => {
  if (isSubmitting.value) return;

  try {
    errorMessage.value = "";
    successMessage.value = "";

    const normalizedUsername = username.value.trim();
    const normalizedEmail = email.value.trim().toLowerCase();
    const pw = password.value;
    const confirm = confirmPassword.value;

    // client-side validation (faster feedback)
    if (!validateUsername(normalizedUsername)) {
      errorMessage.value =
        "Username must be 3-20 characters and contain only letters, numbers, and underscores.";
      return;
    }

    if (!normalizedEmail) {
      errorMessage.value = "Please enter an email address.";
      return;
    }

    if (pw.length < 6) {
      errorMessage.value = "Password must be at least 6 characters.";
      return;
    }

    if (pw !== confirm) {
      errorMessage.value = "Passwords do not match.";
      return;
    }

    isSubmitting.value = true;

    const response = await $fetch<{
      error?: string;
      message?: string;
      statusCode?: number;
    }>("/api/auth/signup", {
      method: "POST",
      body: {
        email: normalizedEmail,
        username: normalizedUsername,
        password: pw,
      },
    });

    if (response?.error) {
      errorMessage.value = response.error;
      return;
    }

    successMessage.value =
      response?.message || "Account created successfully. Redirecting to sign in...";

    // Small delay so user sees success message
    setTimeout(async () => {
      const redirectParam = route.query.redirect;
      const loginUrl =
        typeof redirectParam === "string" && redirectParam.startsWith("/")
          ? `/login?redirect=${encodeURIComponent(redirectParam)}`
          : "/login";

      await navigateTo(loginUrl);
    }, 1200);
  } catch (err: any) {
    errorMessage.value =
      err?.data?.error || err?.message || "An error occurred during signup.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>