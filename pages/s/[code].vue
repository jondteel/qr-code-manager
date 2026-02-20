<!-- [code].vue - Redirect page for short URLs -->
<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center">
      <div
        v-if="pending"
        class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"
      ></div>
      <p v-if="pending" class="text-gray-600">Redirecting...</p>

      <div v-else-if="errorMessage" class="text-red-600">
        <p>{{ errorMessage }}</p>
        <NuxtLink to="/" class="text-blue-600 hover:underline mt-4 inline-block">
          Go to home
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const route = useRoute();

// normalize param (string | string[] | undefined) -> string
const code = computed(() => {
  const raw = route.params.code;
  return Array.isArray(raw) ? raw[0] : String(raw ?? "");
});

const errorMessage = ref("");
const hasRedirected = ref(false);

// Fetch on server when possible
const { data, pending, error } = await useAsyncData(
  "redirect",
  async () => {
    if (!code.value) throw new Error("Missing code");
    return await $fetch(`/api/redirect/${encodeURIComponent(code.value)}`);
  },
  { watch: [code] }
);

// If the fetch itself fails
watchEffect(() => {
  if (error.value) {
    errorMessage.value = "Failed to redirect";
  }
});

// Redirect when we have a URL
watchEffect(async () => {
  if (hasRedirected.value) return;
  if (pending.value) return;
  if (error.value) return;

  const url = data.value?.url;
  const apiErr = data.value?.error;

  if (apiErr || !url) {
    errorMessage.value = "Link not found";
    return;
  }

  hasRedirected.value = true;
  await navigateTo(url, { external: true });
});
</script>