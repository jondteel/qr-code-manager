<template>
  <main class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-10">
    <section class="max-w-md w-full bg-white rounded-xl shadow-lg p-6 sm:p-8" aria-labelledby="account-title">
      <h1 id="account-title" class="text-3xl font-bold text-gray-900 mb-6" tabindex="-1">{{ title }}</h1>
      <slot />
    </section>
  </main>
</template>
<script setup lang="ts">
defineProps<{ title: string }>()
</script>
