// pages/index.vue
<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
    <!-- Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center">
            <svg
              class="h-8 w-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
            <span class="ml-2 text-xl font-bold text-gray-900">QR Manager</span>
          </div>
          <div class="flex gap-4">
            <NuxtLink
              to="/login"
              class="text-gray-700 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              Sign In
            </NuxtLink>
            <NuxtLink
              to="/signup"
              class="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Sign Up
            </NuxtLink>
          </div>
        </div>
      </div>
    </nav>

    <!-- Hero Section -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
      <div class="text-center">
        <h1 class="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6">
          Generate & Manage
          <span
            class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            QR Codes
          </span>
        </h1>
        <p class="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Create custom QR codes, shorten URLs, and track analytics - all in one powerful
          platform
        </p>
        <div class="flex gap-4 justify-center">
          <NuxtLink
            to="/signup"
            class="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Get Started Free
          </NuxtLink>
          <button
            class="bg-white text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-50 transition border border-gray-300"
          >
            View Demo
          </button>
        </div>
      </div>

      <!-- Features Grid -->
      <div class="mt-24 grid md:grid-cols-3 gap-8">
        <div class="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition">
          <div
            class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4"
          >
            <svg
              class="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Custom QR Codes</h3>
          <p class="text-gray-600">
            Generate QR codes with custom colors, sizes, and error correction levels
          </p>
        </div>

        <div class="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition">
          <div
            class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4"
          >
            <svg
              class="w-6 h-6 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">URL Shortener</h3>
          <p class="text-gray-600">
            Create short links that automatically generate QR codes for easy sharing
          </p>
        </div>

        <div class="bg-white p-8 rounded-xl shadow-md hover:shadow-xl transition">
          <div
            class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4"
          >
            <svg
              class="w-6 h-6 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h3 class="text-xl font-bold text-gray-900 mb-2">Analytics</h3>
          <p class="text-gray-600">
            Track scans, clicks, and user engagement with detailed analytics
          </p>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="bg-white border-t border-gray-200 mt-24">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p class="text-center text-gray-500">
          © 2026 QR Manager. Built with Nuxt & Prisma.
        </p>
      </div>
    </footer>
  </div>
</template>
