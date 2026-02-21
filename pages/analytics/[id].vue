<!-- pages/analytics/[id].vue -->
<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center gap-8">
            <NuxtLink to="/" class="flex items-center">
              <span class="ml-2 text-xl font-bold text-gray-900">QR Manager</span>
            </NuxtLink>

            <div class="hidden md:flex items-center gap-x-8 whitespace-nowrap">
              <NuxtLink to="/dashboard" class="text-gray-600 hover:text-gray-900">
                Dashboard
              </NuxtLink>
              <NuxtLink to="/generate" class="text-gray-600 hover:text-gray-900">
                Generate QR
              </NuxtLink>
              <NuxtLink to="/analytics" class="text-gray-600 hover:text-gray-900">
                Analytics
              </NuxtLink>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <span class="text-sm text-gray-600">{{ user?.email || "Guest" }}</span>
            <button
              @click="signOut"
              class="text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <NuxtLink
        to="/dashboard"
        class="text-blue-600 hover:text-blue-700 text-sm inline-flex items-center gap-1 mb-4"
      >
        <span>←</span> Back to Dashboard
      </NuxtLink>

      <div class="mb-6">
        <div v-if="pending" class="text-gray-600">Loading…</div>
        <div v-else>
          <h1 class="text-2xl font-bold text-gray-900">{{ qrTitle }}</h1>
          <p class="text-gray-600 mt-1 truncate">{{ qrSubtitle }}</p>
        </div>
      </div>

      <!-- Period filter -->
      <div class="mb-6 flex gap-2">
        <button
          v-for="p in timePeriods"
          :key="p.value"
          @click="selectedPeriod = p.value"
          class="px-4 py-2 rounded-lg text-sm font-medium transition"
          :class="
            selectedPeriod === p.value
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          "
        >
          {{ p.label }}
        </button>
      </div>

      <div
        v-if="error"
        class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-6"
      >
        Failed to load stats.
      </div>

      <!-- Stats cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p class="text-sm text-gray-600 mb-1">Total Scans</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.totalScans }}</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p class="text-sm text-gray-600 mb-1">Unique Visitors</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.uniqueVisitors }}</p>
          <p class="text-xs text-gray-500 mt-2">Estimated based on IP</p>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <p class="text-sm text-gray-600 mb-1">Avg Scans/Day</p>
          <p class="text-3xl font-bold text-gray-900">{{ stats.avgScansPerDay }}</p>
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
            <canvas ref="chartEl" class="w-full" style="height: 260px"></canvas>
          </div>
        </ClientOnly>

        <p v-if="series.length === 0" class="text-center text-gray-500 mt-4">
          No scan data yet for this period.
        </p>
      </div>

      <!-- Recent scans -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div class="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900">Recent Scans</h3>
          <span class="text-sm text-gray-500">Showing latest 50</span>
        </div>

        <div v-if="recentScans.length === 0" class="p-6 text-center text-gray-500">
          No scans yet in this period
        </div>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-gray-50 text-gray-600">
              <tr>
                <th class="text-left px-6 py-3 font-medium">Time</th>
                <th class="text-left px-6 py-3 font-medium">IP</th>
                <th class="text-left px-6 py-3 font-medium">User Agent</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="s in recentScans" :key="s.id">
                <td class="px-6 py-3 whitespace-nowrap text-gray-900">
                  {{ formatTs(s.timestamp) }}
                </td>
                <td class="px-6 py-3 whitespace-nowrap text-gray-700">
                  {{ s.ipAddress || "unknown" }}
                </td>
                <td
                  class="px-6 py-3 text-gray-700 max-w-xl truncate"
                  :title="s.userAgent || 'unknown'"
                >
                  {{ s.userAgent || "unknown" }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watchEffect } from "vue";

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();
const route = useRoute();

const signOut = async () => {
  await supabase.auth.signOut();
  router.push("/login");
};

const timePeriods = [
  { label: "7 Days", value: 7 },
  { label: "30 Days", value: 30 },
  { label: "90 Days", value: 90 },
  { label: "All Time", value: "all" },
];

const selectedPeriod = ref(30);

const id = computed(() => {
  const raw = route.params.id;
  return Array.isArray(raw) ? raw[0] : String(raw ?? "");
});

const query = computed(() => ({ period: selectedPeriod.value }));

const { data, pending, error, refresh } = await useFetch(
  () => `/api/analytics/qr/${id.value}`,
  {
    query,
    watch: [selectedPeriod, id],
  }
);

const stats = computed(
  () =>
    data.value?.stats || {
      totalScans: 0,
      uniqueVisitors: 0,
      avgScansPerDay: 0,
    }
);

const series = computed(() => data.value?.series || []);
const recentScans = computed(() => data.value?.recentScans || []);

const qrTitle = computed(() => data.value?.qr?.title || "QR Stats");
const qrSubtitle = computed(() => {
  const qr = data.value?.qr;
  if (!qr) return "";
  const short = qr.shortUrl?.shortCode ? `/s/${qr.shortUrl.shortCode}` : null;
  return short ? `${short} → ${qr.data}` : qr.data;
});

const formatTs = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ---- Chart.js setup (same pattern as analytics overview page) ----
const chartEl = ref(null);
let chartInstance = null;

const formatLabel = (isoDate) => {
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

  // no data -> remove existing chart if any
  if (!series.value.length) {
    destroyChart();
    return;
  }

  // dynamic import keeps SSR safe
  const mod = await import("chart.js/auto");
  const Chart = mod.default;

  const labels = series.value.map((p) => formatLabel(p.date));
  const dataPoints = series.value.map((p) => Number(p.scans || 0));

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
          pointRadius: labels.length > 31 ? 0 : 2,
          pointHoverRadius: 4,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title(items) {
              const idx = items?.[0]?.dataIndex ?? 0;
              const raw = series.value[idx]?.date;
              if (!raw) return "";
              const d = new Date(raw + "T00:00:00");
              return d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              });
            },
            label(context) {
              const value = context.parsed?.y ?? 0;
              return `${value} scan${value === 1 ? "" : "s"}`;
            },
          },
        },
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

// Re-render when fetch completes / data changes
watchEffect(() => {
  if (pending.value) return;
  if (error.value) return;
  renderChart();
});

onBeforeUnmount(() => {
  destroyChart();
});
</script>