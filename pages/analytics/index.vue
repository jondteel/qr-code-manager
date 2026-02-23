<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header/Navigation -->
    <AppHeaderNav active-tab="analytics" />

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-8">
        <h1 class="text-2xl font-bold text-gray-900">Analytics Overview</h1>
        <p class="text-gray-600 mt-1">Track scans and engagement across all your QR codes</p>
      </div>

      <!-- Time Period Filter -->
      <div class="mb-6 flex gap-2 flex-wrap">
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

      <!-- Loading / error -->
      <div v-if="pending" class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="text-center text-gray-600 mt-3">Loading analytics...</p>
      </div>

      <div
        v-else-if="error"
        class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-8"
      >
        Failed to load analytics.
      </div>

      <template v-else>
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

        <!-- Scans Over Time Chart -->
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">Scans Over Time</h3>
            <button
              @click="refresh()"
              class="text-sm text-blue-600 hover:text-blue-700"
              type="button"
            >
              Refresh
            </button>
          </div>

          <ClientOnly>
            <div class="relative">
              <canvas ref="chartEl" class="w-full" style="height: 260px;"></canvas>
            </div>
          </ClientOnly>

          <p v-if="series.length === 0" class="text-center text-gray-500 mt-4">
            No scan data yet for this period.
          </p>
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
              <div class="flex items-start sm:items-center justify-between gap-3">
                <div class="flex-1 min-w-0">
                  <h4 class="font-semibold text-gray-900 truncate">{{ qr.title }}</h4>
                  <p class="text-sm text-gray-500 mt-1 truncate">{{ qr.data }}</p>
                </div>
                <div class="text-right ml-2 sm:ml-4 shrink-0">
                  <p class="text-2xl font-bold text-gray-900">{{ qr.scanCount }}</p>
                  <p class="text-xs text-gray-500">scans</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch, watchEffect } from "vue";

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();
const route = useRoute();

const mobileMenuOpen = ref(false);

const signOut = async () => {
  await supabase.auth.signOut();
  router.push("/login");
};

const handleMobileSignOut = async () => {
  mobileMenuOpen.value = false;
  await signOut();
};

// Close mobile menu on route changes
watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
  }
);

const timePeriods = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "All Time", value: "all" },
];

const selectedPeriod = ref(30);

const query = computed(() => ({ period: selectedPeriod.value }));

const { data: analyticsData, pending, error, refresh } = await useFetch(
  "/api/analytics/overview",
  { query, watch: [selectedPeriod] }
);

const stats = computed(() => analyticsData.value?.stats || {
  totalScans: 0,
  uniqueVisitors: 0,
  activeQRCodes: 0,
  avgScansPerDay: 0,
  scanGrowth: 0,
});

const topQRCodes = computed(() => analyticsData.value?.topQRCodes || []);
const series = computed(() => analyticsData.value?.series || []);

// ---- Chart.js setup (client-only safe) ----
const chartEl = ref(null);
let chartInstance = null;

const formatLabel = (isoDate) => {
  // "2026-02-19" -> "Feb 19"
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const destroyChart = () => {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
};

const renderChart = async () => {
  if (!process.client) return;
  if (!chartEl.value) return;

  // no data? just destroy any existing chart
  if (!series.value.length) {
    destroyChart();
    return;
  }

  // dynamic import so SSR never touches Chart.js
  const mod = await import("chart.js/auto");
  const Chart = mod.default;

  const labels = series.value.map((p) => formatLabel(p.date));
  const dataPoints = series.value.map((p) => p.scans);

  destroyChart();

  chartInstance = new Chart(chartEl.value, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Scans",
          data: dataPoints,
          tension: 0.35,
          fill: true,
          pointRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: true },
      },
      scales: {
        x: {
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
        },
      },
    },
  });
};

// re-render chart when data changes
watchEffect(() => {
  // wait until fetch is done (prevents flicker)
  if (pending.value) return;
  if (error.value) return;
  renderChart();
});

onBeforeUnmount(() => {
  destroyChart();
});
</script>