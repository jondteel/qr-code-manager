<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header/Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center gap-8">
            <NuxtLink to="/" class="flex items-center">
              <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span class="ml-2 text-xl font-bold text-gray-900">QR Manager</span>
            </NuxtLink>

            <div class="hidden md:flex items-center whitespace-nowrap">
              <NuxtLink to="/dashboard" class="text-gray-600 hover:text-gray-900 mr-8">Dashboard</NuxtLink>
              <NuxtLink to="/generate" class="text-gray-600 hover:text-gray-900 mr-8">Generate QR</NuxtLink>
              <NuxtLink to="/analytics" class="text-blue-600 font-medium">Analytics</NuxtLink>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <span class="text-sm text-gray-600">{{ user?.email || 'Guest' }}</span>
            <button @click="signOut" class="text-gray-600 hover:text-gray-900 text-sm font-medium">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Analytics Overview</h1>
        <p class="text-gray-600 mt-1">Track scans and engagement across all your QR codes</p>
      </div>

      <!-- Time Period Filter -->
      <div class="mb-6 flex gap-2">
        <button
          v-for="period in timePeriods"
          :key="period.value"
          @click="selectedPeriod = period.value"
          class="px-4 py-2 rounded-lg text-sm font-medium transition"
          :class="selectedPeriod === period.value 
            ? 'bg-blue-600 text-white' 
            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'"
        >
          {{ period.label }}
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p class="text-sm text-gray-600 mb-1">Total Scans</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.totalScans }}</p>
          <p class="text-xs text-green-600 mt-2">{{ stats.scanGrowth }}% vs last period</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p class="text-sm text-gray-600 mb-1">Unique Visitors</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.uniqueVisitors }}</p>
          <p class="text-xs text-gray-500 mt-2">Estimated based on IP</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p class="text-sm text-gray-600 mb-1">Active QR Codes</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.activeQRCodes }}</p>
          <p class="text-xs text-gray-500 mt-2">Scanned this period</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p class="text-sm text-gray-600 mb-1">Avg Scans/Day</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.avgScansPerDay }}</p>
          <p class="text-xs text-gray-500 mt-2">Over selected period</p>
        </div>
      </div>

      <!-- Scans Over Time Chart Placeholder -->
      <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Scans Over Time</h3>
        <div class="h-64 flex items-center justify-center bg-gray-50 rounded">
          <p class="text-gray-500">Chart visualization coming soon</p>
        </div>
      </div>

      <!-- Top Performing QR Codes -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        <div class="p-6 border-b border-gray-200">
          <h3 class="text-lg font-semibold text-gray-900">Top Performing QR Codes</h3>
        </div>
        <div class="divide-y divide-gray-200">
          <div v-if="topQRCodes.length === 0" class="p-6 text-center text-gray-500">
            No scan data yet
          </div>
          <div
            v-for="qr in topQRCodes"
            :key="qr.id"
            class="p-6 hover:bg-gray-50 transition"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1">
                <h4 class="font-semibold text-gray-900">{{ qr.title }}</h4>
                <p class="text-sm text-gray-500 mt-1">{{ qr.data }}</p>
              </div>
              <div class="text-right ml-4">
                <p class="text-2xl font-bold text-gray-900">{{ qr.scanCount }}</p>
                <p class="text-xs text-gray-500">scans</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const router = useRouter()

const signOut = async () => {
  await supabase.auth.signOut()
  router.push('/login')
}

const timePeriods = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
  { label: 'All Time', value: 'all' }
]

const selectedPeriod = ref(30)

// ✅ query must use the VALUE
const query = computed(() => ({ period: selectedPeriod.value }))

// ✅ Nuxt will refetch automatically when watched refs change
const { data: analyticsData, pending, error, refresh } = await useFetch(
  '/api/analytics/overview',
  {
    query,
    watch: [selectedPeriod],   // refetch when period changes
  }
)

const stats = computed(() => analyticsData.value?.stats || {
  totalScans: 0,
  uniqueVisitors: 0,
  activeQRCodes: 0,
  avgScansPerDay: 0,
  scanGrowth: 0
})

const topQRCodes = computed(() => analyticsData.value?.topQRCodes || [])
</script>