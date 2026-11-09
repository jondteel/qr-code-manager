<!-- Dashboard.vue: Main dashboard page showing stats and list of QR codes -->
<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header/Navigation -->
    <AppHeaderNav active-tab="dashboard" />

    <!-- Main Content -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Stats Overview -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm text-gray-600 mb-1">Total QR Codes</p>
              <p class="text-3xl font-bold text-gray-900">{{ stats.totalQRCodes }}</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm text-gray-600 mb-1">Short URLs</p>
              <p class="text-3xl font-bold text-gray-900">{{ stats.totalShortUrls }}</p>
            </div>
            <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm text-gray-600 mb-1">Total Scans</p>
              <p class="text-3xl font-bold text-gray-900">{{ stats.totalScans }}</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div class="flex items-center justify-between gap-4">
            <div>
              <p class="text-sm text-gray-600 mb-1">This Month</p>
              <p class="text-3xl font-bold text-gray-900">{{ stats.thisMonthScans }}</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions Bar -->
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 class="text-2xl font-bold text-gray-900">Your QR Codes</h2>
        <NuxtLink
          to="/generate"
          class="w-full sm:w-auto justify-center bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create New QR Code
        </NuxtLink>
      </div>

      <div class="mb-6 flex flex-wrap items-center gap-3">
        <label for="qr-lifecycle" class="text-sm font-medium">Show QR codes</label>
        <select ref="lifecycleSelect" id="qr-lifecycle" v-model="lifecycleFilter" class="rounded-lg border border-gray-300 bg-white px-3 py-2">
          <option value="active">Active</option><option value="archived">Archived</option><option value="retired">Retired</option>
        </select>
      </div>
      <p role="status" class="sr-only">{{ lifecycleMessage }}</p>
      <!-- Loading state -->
      <div v-if="pending" class="mb-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="text-center text-gray-600 mt-3">Loading your QR codes...</p>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Failed to load your QR codes.
      </div>

      <!-- QR Codes Grid -->
      <div v-else-if="qrCodes.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="qr in qrCodes"
          :key="qr.id"
          class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition"
        >
          <div class="p-6">
            <div class="flex items-start justify-between mb-4 gap-3">
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 mb-1 truncate">{{ qr.title }}</h3>
                <p class="text-sm text-gray-500 truncate">{{ qr.data }}</p>
              </div>

              <div class="relative shrink-0" data-menu-root>
                <button aria-label="QR actions" @click.stop="toggleMenu(qr.id)" class="text-gray-400 hover:text-gray-600" type="button">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>

                <div
                  v-if="openMenuId === qr.id"
                  class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10"
                >
                  <button
                    @click="editQR(qr)"
                    class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                    type="button"
                  >
                    Edit
                  </button>

                </div>
              </div>
            </div>

            <QrLifecycleActions :qr="qr" :disabled="pending || !!error" @busy="value => setLifecycleBusy(qr.id, value)" @changed="applyLifecycle" @reload="refresh" />
            <div
              v-if="getShortLink(qr)"
              class="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-3"
            >
              <p class="text-xs font-medium uppercase text-indigo-700 mb-1">Short link</p>
              <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                <a
                  :href="getShortLink(qr)"
                  class="min-w-0 flex-1 truncate text-sm font-medium text-indigo-900 hover:text-indigo-700"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ getShortLink(qr) }}
                </a>
                <button
                  @click="copyShortLink(qr)"
                  class="shrink-0 rounded-md border border-indigo-200 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition"
                  type="button"
                >
                  {{ copiedShortLinkId === qr.id ? "Copied" : "Copy" }}
                </button>
              </div>
            </div>

            <div v-if="savedQrNotice(qr)" class="text-sm text-gray-600 mb-4" role="status">
              <p v-if="qr?.payloadState === 'canonical-regeneration' && savedQrTarget(qr)" class="font-semibold">Canonical QR regeneration</p>
              <p>{{ savedQrNotice(qr) }}</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4 mb-4 flex items-center justify-center">
              <ClientOnly>
                <canvas v-show="savedQrTarget(qr) && renderedKeys[qr.id] === qrKey(qr) && !pending && !error" :ref="(el) => setCanvasRef(qr.id, el)" class="bg-white rounded"></canvas>
              </ClientOnly>
            </div>

            <div class="flex items-center justify-between gap-2 text-sm text-gray-600 mb-4">
              <span class="truncate">{{ qr.analytics?.length || 0 }} scans</span>
              <span class="whitespace-nowrap">Created {{ formatDate(qr.createdAt) }}</span>
            </div>

            <div class="flex gap-2">
              <button
                @click="downloadQR(qr)"
                :disabled="pending || !!error || lifecycleBusyIds.has(qr.id) || !savedQrTarget(qr)"
                class="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                type="button"
              >
                Download
              </button>
              <button
                @click="router.push(`/analytics/${qr.id}`)"
                class="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                type="button"
              >
                View Stats
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
          />
        </svg>
        <h3 class="mt-2 text-sm font-semibold text-gray-900">No {{ lifecycleFilter }} QR codes</h3>
        <p class="mt-1 text-sm text-gray-500">Choose another lifecycle view or create a new QR code.</p>
        <div class="mt-6">
          <NuxtLink
            to="/generate"
            class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Create QR Code
          </NuxtLink>
        </div>
      </div>
    </main>

    <!-- Toast Notifications -->
    <Toast :show="toast.show" :message="toast.message" :type="toast.type" @close="toast.show = false" />
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { savedQrTarget, savedQrNotice } from "~/utils/qr-payload.mjs";
import { renderQrCanvas } from "~/utils/qr-render.mjs";
import { canvasToPngBlob } from "~/server/utils/qrToBlob.ts";
import { downloadPngBlob } from "/server/utils/downloadQrPng";

// If you prefer: keep this helper near the download handler.
const toSafeFilename = (raw) => {
  const base = String(raw ?? "qr_code")
    .trim()
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 60);
  return base.length ? `${base}.png` : "qr_code.png";
};

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();

// Fetch QR codes data
const lifecycleMessage = ref('');
const lifecycleSelect = ref(null);
const lifecycleFilter = ref('active');
const lifecycleBusyIds = ref(new Set());
const { data: qrData, pending, error, refresh } = await useFetch("/api/qr/list", { query: { status: lifecycleFilter } });
const setLifecycleBusy = (id, busy) => { if (busy) lifecycleBusyIds.value.add(id); else lifecycleBusyIds.value.delete(id); };
const applyLifecycle = async qr => {
  if (!qrData.value) return;
  lifecycleMessage.value = `QR is now ${qr.lifecycleStatus}.`;
  const removed = qr.lifecycleStatus !== lifecycleFilter.value;
  qrData.value = { ...qrData.value, qrCodes: qrData.value.qrCodes.map(old => old.id === qr.id ? { ...old, ...qr } : old).filter(row => row.lifecycleStatus === lifecycleFilter.value) };
  if (removed) { await nextTick(); lifecycleSelect.value?.focus(); }
};

const stats = computed(
  () =>
    qrData.value?.stats || {
      totalQRCodes: 0,
      totalShortUrls: 0,
      totalScans: 0,
      thisMonthScans: 0,
    }
);

const qrCodes = computed(() => (qrData.value?.qrCodes || []).filter(qr => (qr.lifecycleStatus ?? 'active') === lifecycleFilter.value));

const { signOut } = useAccountLogout();

// Import QRCode library
let QRCodeLib = null;
let active = true;
const downloadingIds = ref(new Set());
const renderedKeys = ref({});
const qrKey = (qr) => JSON.stringify(qr);
const exportKey = (id) => JSON.stringify([qrCodes.value.find(q => q.id === id), pending.value, !!error.value, lifecycleBusyIds.value.has(id)]);

// map canvas elements by QR id
const canvasMap = ref({}); // { [qrId]: HTMLCanvasElement }
const setCanvasRef = (id, el) => {
  if (el) canvasMap.value[id] = el;
};

// Format date helper
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const loadQrLib = async () => {
  if (QRCodeLib) return QRCodeLib;
  const mod = await import("qrcode");
  QRCodeLib = mod.default ?? mod;
  return QRCodeLib;
};

const renderAllQrs = async () => {
  if (!process.client) return;
  if (!qrCodes.value.length) return;

  await loadQrLib();
  await nextTick();

  for (const qr of qrCodes.value) {
    const canvas = canvasMap.value[qr.id];
    if (!canvas) continue;

    const url = savedQrTarget(qr);

    if (!url) continue;
    const key = qrKey(qr);
    try {
      const buffer = document.createElement("canvas");
      await renderQrCanvas(QRCodeLib, buffer, url, { ...qr, size: 128 });
      if (!active || key !== qrKey(qrCodes.value.find(q => q.id === qr.id))) continue;
      canvas.width = buffer.width;
      canvas.height = buffer.height;
      canvas.getContext("2d").drawImage(buffer, 0, 0);
      renderedKeys.value[qr.id] = key;
    } catch {
      renderedKeys.value[qr.id] = null;
      showToast("Could not render QR preview. Check its content, colors and size.", "error");
    }
  }
};

onMounted(async () => {
  await renderAllQrs();
});

// Re-render any time the list changes
watch(
  () => JSON.stringify(qrCodes.value),
  async () => {
    const ids = new Set(qrCodes.value.map((q) => q.id));
    for (const key of Object.keys(canvasMap.value)) {
      if (!ids.has(key)) delete canvasMap.value[key];
    }
    await renderAllQrs();
  }
);

// ✅ Download function (mobile-friendly)
const downloadQR = async (qr) => {
  if (downloadingIds.value.has(qr.id)) return;
  const current = qrCodes.value.find(q => q.id === qr.id);
  const target = savedQrTarget(current);
  if (!active || pending.value || error.value || lifecycleBusyIds.value.has(qr.id) || !target) { showToast("Reload a verified saved QR before downloading.", "error"); return; }
  const key = exportKey(qr.id);
  const settings = { ...current };
  downloadingIds.value.add(qr.id);
  try {
    const QR = await loadQrLib();
    const canvas = document.createElement("canvas");
    await renderQrCanvas(QR, canvas, target, settings);
    const blob = await canvasToPngBlob(canvas);
    if (!active || key !== exportKey(qr.id)) throw new Error("QR changed");
    await downloadPngBlob(blob, { filename: toSafeFilename(settings.title), preferShare: true, openInNewTabFallback: true, isCurrent: () => active && key === exportKey(qr.id) });
  } catch {
    showToast("Could not export PNG. Reload the QR and check its settings before retrying.", "error");
  } finally {
    downloadingIds.value.delete(qr.id);
  }
};

// Menu state
const openMenuId = ref(null);

const toggleMenu = (id) => {
  openMenuId.value = openMenuId.value === id ? null : id;
};

const onDocClick = (e) => {
  const target = e.target;
  if (target && target.closest && target.closest("[data-menu-root]")) return;
  openMenuId.value = null;
};

onMounted(() => {
  document.addEventListener("click", onDocClick);
});

onBeforeUnmount(() => {
  active = false;
  document.removeEventListener("click", onDocClick);
  if (copiedShortLinkTimeout) clearTimeout(copiedShortLinkTimeout);
});

// Toast state
const toast = ref({
  show: false,
  message: "",
  type: "info",
});

const showToast = (message, type = "info") => {
  toast.value = { show: true, message, type };
};

const copiedShortLinkId = ref(null);
let copiedShortLinkTimeout = null;

const getShortLink = (qr) => {
  const current = qrCodes.value.find(q => q.id === qr?.id);
  return !pending.value && !error.value && !lifecycleBusyIds.value.has(qr?.id) && current?.shortUrl ? savedQrTarget(current) || "" : "";
};

const copyShortLink = async (qr) => {
  const shortLink = getShortLink(qr);

  if (!process.client || !shortLink || !navigator?.clipboard?.writeText) {
    showToast("Copy is unavailable in this browser", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(shortLink);
    copiedShortLinkId.value = qr.id;
    showToast("Short link copied", "success");

    if (copiedShortLinkTimeout) clearTimeout(copiedShortLinkTimeout);
    copiedShortLinkTimeout = window.setTimeout(() => {
      copiedShortLinkId.value = null;
    }, 2000);
  } catch (err) {
    console.error("Copy short link error:", err);
    showToast("Failed to copy short link", "error");
  }
};

// Edit function
const editQR = (qr) => {
  router.push(`/edit/${qr.id}`);
  openMenuId.value = null;
};
</script>
