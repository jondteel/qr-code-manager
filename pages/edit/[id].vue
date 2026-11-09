<!-- pages/edit/[id].vue - Edit QR Code Page -->
<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header/Navigation -->
    <AppHeaderNav />

    <!-- Main -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6">
        <NuxtLink
          to="/dashboard"
          class="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </NuxtLink>
        <h1 class="text-2xl font-bold text-gray-900">Edit QR Code</h1>
        <p class="text-gray-600 mt-1">Update your QR code details and styling</p>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>

      <div
        v-else-if="error"
        class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800"
      >
        {{ error }}
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Form -->
        <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <QrLifecycleActions :qr="qrCode" :disabled="saving || loading || !!error" @busy="value => lifecycleBusy = value" @changed="applyLifecycle" @reload="refresh" />
          <form class="space-y-6" @submit.prevent="saveChanges">
            <fieldset :disabled="saving || lifecycleBusy || qrCode.lifecycleStatus === 'retired'" class="space-y-6">
            <!-- Title -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">Title *</label>
              <input
                v-model="form.title"
                type="text"
                required
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <!-- Mode is immutable; only destination/content can change. -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">{{ qrCode.mode === "tracked" ? "Destination URL" : "Direct content" }}</label>
              <textarea
                v-model="form.data"
                :rows="qrCode.mode === 'tracked' ? 1 : 3"
                :disabled="saving"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              />
              <p class="text-xs text-gray-500 mt-1">Save to update the destination or exact direct content. Existing tracked QR links stay the same.</p>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">
                Description (optional)
              </label>
              <textarea
                v-model="form.description"
                rows="3"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add notes about this QR code..."
              />
            </div>

            <!-- Size -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">
                Size: <span class="text-gray-600 font-normal">{{ form.size }}px</span>
              </label>
              <input
                v-model.number="form.size"
                type="range"
                min="128"
                max="1024"
                step="32"
                class="w-full"
              />
            </div>

            <!-- Colors -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1">Foreground</label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="form.fgColor"
                    type="color"
                    class="h-10 w-14 p-1 rounded border border-gray-300 bg-white"
                  />
                  <input
                    v-model="form.fgColor"
                    type="text"
                    class="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1">Background</label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="form.bgColor"
                    type="color"
                    class="h-10 w-14 p-1 rounded border border-gray-300 bg-white"
                  />
                  <input
                    v-model="form.bgColor"
                    type="text"
                    class="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <!-- Error Correction -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">Error Correction</label>
              <select
                v-model="form.errorLevel"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="L">L — Low</option>
                <option value="M">M — Medium</option>
                <option value="Q">Q — Quartile</option>
                <option value="H">H — High</option>
              </select>
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                :disabled="saving"
                class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {{ saving ? "Saving..." : "Save Changes" }}
              </button>
              <NuxtLink
                to="/dashboard"
                class="flex-1 bg-gray-100 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition text-center"
              >
                Cancel
              </NuxtLink>
            </div>

            <p v-if="saveError" class="text-sm text-red-600">{{ saveError }}</p>
            <p v-if="saveSuccess" class="text-sm text-green-600">Changes saved successfully!</p>
            </fieldset>
          </form>
        </section>

        <!-- Preview -->
        <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between gap-3 mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Preview</h2>

            <button
              type="button"
              @click="downloadPng"
              :disabled="downloading || lifecycleBusy || saving || loading || !!error || !qrCode?.id || !savedQrTarget(qrCode) || form.data !== qrCode.data"
              class="shrink-0 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v3h16v-3"
                />
              </svg>
              {{ downloading ? "Preparing…" : "Download PNG" }}
            </button>
          </div>

          <ClientOnly>
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-6 flex items-center justify-center"
            >
              <canvas v-show="savedQrTarget(qrCode) && renderedTarget === previewFingerprint && form.data === qrCode.data && !loading && !saving" ref="canvasRef" class="bg-white rounded max-w-full"></canvas>
            </div>
          </ClientOnly>

          <p class="text-sm text-gray-600 mt-3">Save content changes before downloading. Preview and PNG use the verified saved target with the current styling.</p>

          <p v-if="downloadError" class="text-sm text-red-600 mt-3">
            {{ downloadError }}
          </p>

          <div class="mt-6">
            <div v-if="savedQrNotice(qrCode)" class="text-sm text-gray-600 mb-4" role="status">
              <p v-if="qrCode?.payloadState === 'canonical-regeneration' && savedQrTarget(qrCode)" class="font-semibold">Canonical QR regeneration</p>
              <p>{{ savedQrNotice(qrCode) }}</p>
            </div>
            <h3 class="text-sm font-semibold text-gray-900 mb-2">QR Code Info</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-3">
                <dt class="text-gray-600">Created:</dt>
                <dd class="text-gray-900 text-right">{{ formatDate(qrCode.createdAt) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt class="text-gray-600">Total Scans:</dt>
                <dd class="text-gray-900 text-right">{{ qrCode.analytics?.length || 0 }}</dd>
              </div>
              <div v-if="qrCode.shortUrl" class="flex justify-between gap-3">
                <dt class="text-gray-600">Short URL:</dt>
                <dd class="text-gray-900 truncate text-right">/s/{{ qrCode.shortUrl.shortCode }}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { savedQrTarget, savedQrNotice } from "~/utils/qr-payload.mjs";
import { renderQrCanvas } from "~/utils/qr-render.mjs";
import { canvasToPngBlob } from "~/server/utils/qrToBlob.ts";
import { downloadPngBlob } from "~/server/utils/downloadQrPng";

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();
const user = useSupabaseUser();

const signOut = async () => {
  await supabase.auth.signOut();
  router.push("/login");
};

const id = computed(() => String(route.params.id ?? ""));

const { data: qrData, pending: loading, error: fetchError, refresh } = await useFetch(
  () => `/api/qr/${id.value}`
);

const qrCode = computed(() => qrData.value?.qrCode || {});
const error = computed(() => fetchError.value?.message || qrData.value?.error);

// Form state
const form = ref({
  title: "",
  data: "",
  description: "",
  size: 320,
  fgColor: "#000000",
  bgColor: "#ffffff",
  errorLevel: "M",
});

// Populate form when data loads
watch(
  qrCode,
  (newQR) => {
    if (newQR && newQR.id) {
      form.value = {
        title: newQR.title ?? "",
        data: newQR.data ?? "",
        description: newQR.description || "",
        size: newQR.size ?? 320,
        fgColor: newQR.fgColor ?? "#000000",
        bgColor: newQR.bgColor ?? "#ffffff",
        errorLevel: newQR.errorLevel ?? "M",
      };
    }
  },
  { immediate: true }
);

// Save state
const lifecycleBusy = ref(false);
const applyLifecycle = qr => { qrData.value = { ...qrData.value, qrCode: { ...qrCode.value, ...qr } }; };
const saving = ref(false);
const saveError = ref("");
const saveSuccess = ref(false);

// Preview rendering
const canvasRef = ref(null);
const renderedTarget = ref(null);
let QRCodeLib = null;
let active = true;
const previewFingerprint = computed(() => JSON.stringify([id.value, qrCode.value, form.value, loading.value, saving.value, !!error.value, lifecycleBusy.value]));

const loadQrLib = async () => {
  if (QRCodeLib) return QRCodeLib;
  const mod = await import("qrcode");
  QRCodeLib = mod.default ?? mod;
  return QRCodeLib;
};

let previewTimer = null;
const DEBOUNCE_MS = 200;

const clearPreviewTimer = () => {
  if (previewTimer) {
    clearTimeout(previewTimer);
    previewTimer = null;
  }
};

const renderPreviewNow = async () => {
  renderedTarget.value = null;
  const key = previewFingerprint.value;
  const target = savedQrTarget(qrCode.value);
  if (!active || loading.value || saving.value || lifecycleBusy.value || error.value || !canvasRef.value || !target || form.value.data !== qrCode.value.data) return;
  const settings = { ...form.value };
  try {
    const QR = await loadQrLib();
    const canvas = document.createElement("canvas");
    await renderQrCanvas(QR, canvas, target, settings);
    if (!active || key !== previewFingerprint.value || !canvasRef.value) return;
    canvasRef.value.width = canvas.width;
    canvasRef.value.height = canvas.height;
    canvasRef.value.getContext("2d").drawImage(canvas, 0, 0);
    renderedTarget.value = key;
  } catch {
    downloadError.value = "Could not render QR image. Check content, colors and size.";
  }
};

const schedulePreview = () => {
  clearPreviewTimer();
  previewTimer = setTimeout(() => {
    renderPreviewNow().catch((e) => console.error("Preview render error:", e));
  }, DEBOUNCE_MS);
};

onMounted(() => {
  schedulePreview();
});

watch(
  () => previewFingerprint.value,
  () => schedulePreview()
);

watch(
  form,
  () => schedulePreview(),
  { deep: true }
);

onBeforeUnmount(() => {
  active = false;
  clearPreviewTimer();
});

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Save changes
const saveChanges = async () => {
  if (saving.value || loading.value || lifecycleBusy.value || qrCode.value?.lifecycleStatus === 'retired') return;
  const savingId = id.value;
  saveError.value = "";
  saveSuccess.value = false;

  if (!form.value.title?.trim()) {
    saveError.value = "Title is required";
    return;
  }

  saving.value = true;

  try {
    const result = await $fetch(`/api/qr/${id.value}`, {
      method: "PUT",
      body: {
        title: form.value.title.trim(),
        ...(form.value.data !== qrCode.value.data ? { data: form.value.data } : {}),
        description: form.value.description,
        size: form.value.size,
        fgColor: form.value.fgColor,
        bgColor: form.value.bgColor,
        errorLevel: form.value.errorLevel,
      },
    });

    // Commit response is authoritative; refresh supplies the existing scan detail.
    if (!active || savingId !== id.value) return;
    qrData.value = result;
    await refresh();

    saveSuccess.value = true;
    setTimeout(() => {
      if (active && savingId === id.value) router.push("/dashboard");
    }, 1500);
  } catch (err) {
    console.error("Save error:", err);
    saveError.value = err?.statusCode === 409
      ? "This QR changed or could not be verified. Reload before trying again."
      : "Failed to save changes";
  } finally {
    saving.value = false;
  }
};

// Export a private canvas and recheck the complete record/form snapshot before delivery.
const downloading = ref(false);
const downloadError = ref("");
const downloadPng = async () => {
  if (downloading.value) return;
  downloadError.value = "";
  const target = savedQrTarget(qrCode.value);
  if (!active || loading.value || saving.value || lifecycleBusy.value || error.value || !qrCode.value?.id || !target || form.value.data !== qrCode.value.data) {
    downloadError.value = "Save or reload a verified QR before downloading.";
    return;
  }
  const key = previewFingerprint.value;
  const settings = { ...form.value };
  const filename = (settings.title || "qr_code").trim().replace(/[^\w\-]+/g, "_").slice(0, 60) || "qr_code";
  downloading.value = true;
  try {
    const QR = await loadQrLib();
    const canvas = document.createElement("canvas");
    await renderQrCanvas(QR, canvas, target, settings);
    const blob = await canvasToPngBlob(canvas);
    if (!active || key !== previewFingerprint.value) throw new Error("QR changed");
    await downloadPngBlob(blob, { filename: filename + ".png", preferShare: true, openInNewTabFallback: true, isCurrent: () => active && key === previewFingerprint.value });
  } catch {
    downloadError.value = "Could not export PNG. Check the QR settings and try again after saving.";
  } finally {
    downloading.value = false;
  }
};
</script>
