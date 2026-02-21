<!-- generate.vue -->
<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header/Navigation -->
    <nav class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <div class="flex items-center gap-8">
            <NuxtLink to="/" class="flex items-center">
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
            </NuxtLink>

            <div class="hidden md:flex items-center gap-x-8 whitespace-nowrap">
              <NuxtLink to="/dashboard" class="text-gray-600 hover:text-gray-900">
                Dashboard
              </NuxtLink>
              <NuxtLink to="/generate" class="text-blue-600 font-medium">
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

    <!-- Main -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Generate a QR Code</h1>
        <p class="text-gray-600 mt-1">
          Customize size, colors, margin, and error correction. Live preview updates as
          you type.
        </p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Form -->
        <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="space-y-6">
            <!-- Content -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">
                QR Content
              </label>
              <textarea
                v-model="content"
                rows="4"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Paste a URL or any text..."
              />
              <div class="flex items-center justify-between mt-2">
                <p class="text-xs text-gray-500">
                  Tip: URLs are most common (e.g., https://example.com)
                </p>
                <p class="text-xs text-gray-500">{{ content.length }} chars</p>
              </div>
            </div>

            <!-- Label -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">
                Label / Name *
              </label>
              <input
                v-model="label"
                type="text"
                required
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Business Card, Flyer A, Store Poster..."
              />
              <p class="text-xs text-gray-600 mt-2">
                Give this QR code a name to identify it in your dashboard.
              </p>
            </div>

            <!-- Options grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Size -->
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1">
                  Size: <span class="text-gray-600 font-normal">{{ size }}px</span>
                </label>
                <input
                  v-model.number="size"
                  type="range"
                  min="128"
                  max="1024"
                  step="32"
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                  <span>128</span><span>1024</span>
                </div>
              </div>

              <!-- Margin -->
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1">
                  Margin: <span class="text-gray-600 font-normal">{{ margin }}</span>
                </label>
                <input
                  v-model.number="margin"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  class="w-full"
                />
                <div class="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0</span><span>10</span>
                </div>
              </div>

              <!-- Foreground -->
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1">
                  Foreground
                </label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="fgColor"
                    type="color"
                    class="h-10 w-14 p-1 rounded border border-gray-300 bg-white"
                  />
                  <input
                    v-model="fgColor"
                    type="text"
                    class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#000000"
                  />
                </div>
                <p
                  v-if="fgColor && !isValidHexColor(fgColor)"
                  class="text-xs text-amber-600 mt-1"
                >
                  Enter a valid hex color (e.g., #111827). Preview uses the last valid value.
                </p>
              </div>

              <!-- Background -->
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1">
                  Background
                </label>
                <div class="flex items-center gap-3">
                  <input
                    v-model="bgColor"
                    type="color"
                    class="h-10 w-14 p-1 rounded border border-gray-300 bg-white"
                  />
                  <input
                    v-model="bgColor"
                    type="text"
                    class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#FFFFFF"
                  />
                </div>
                <p
                  v-if="bgColor && !isValidHexColor(bgColor)"
                  class="text-xs text-amber-600 mt-1"
                >
                  Enter a valid hex color (e.g., #FFFFFF). Preview uses the last valid value.
                </p>
              </div>

              <!-- Error correction -->
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-900 mb-1">
                  Error Correction
                </label>
                <select
                  v-model="errorCorrectionLevel"
                  class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="L">L — Low (max data)</option>
                  <option value="M">M — Medium (recommended)</option>
                  <option value="Q">Q — Quartile</option>
                  <option value="H">H — High (best if logo/printing issues)</option>
                </select>
                <p class="text-xs text-gray-500 mt-2">
                  Higher correction = more resilient QR, but slightly less dense capacity.
                </p>
              </div>
            </div>

            <!-- Save/Download Status -->
            <div
              v-if="savedShortCode"
              class="rounded-lg border border-green-200 bg-green-50 p-3 text-sm"
            >
              <p class="text-green-800 font-medium">
                Tracked QR saved
                <span v-if="isDirtySinceSave" class="font-normal">
                  (changes made since last save)
                </span>
              </p>
              <p class="text-green-700 mt-1 break-all">
                Tracking link: {{ trackedUrl }}
              </p>
              <p v-if="savedQrId" class="text-green-700 mt-1">
                QR ID: {{ savedQrId }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                :disabled="!canSave || isSaving"
                :class="!canSave || isSaving ? 'opacity-60 cursor-not-allowed' : ''"
                @click="saveTrackedQr"
              >
                {{ isSaving ? "Saving…" : isDirtySinceSave ? "Save Changes" : "Save / Create QR Code" }}
              </button>

              <button
                type="button"
                class="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition"
                :disabled="!canDownloadSaved || isDownloading"
                :class="!canDownloadSaved || isDownloading ? 'opacity-60 cursor-not-allowed' : ''"
                @click="downloadSavedPng"
              >
                {{ isDownloading ? "Downloading…" : "Download PNG" }}
              </button>

              <button
                type="button"
                class="sm:w-auto bg-gray-100 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
                @click="resetToDefaults"
              >
                Reset
              </button>
            </div>

            <p class="text-xs text-gray-500">
              Preview uses your direct content. Downloaded PNG uses the saved tracked short link.
            </p>

            <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
            <p v-if="successMessage" class="text-sm text-green-600">{{ successMessage }}</p>
          </div>
        </section>

        <!-- Preview -->
        <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-900">Live Preview</h2>
            <div class="text-xs text-gray-500">{{ size }}×{{ size }}</div>
          </div>

          <ClientOnly>
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-6 flex items-center justify-center"
            >
              <div class="flex flex-col items-center gap-3">
                <canvas ref="canvasRef" class="bg-white rounded" />
                <p class="text-xs text-gray-500 text-center">
                  {{
                    canGenerate
                      ? "Preview updates automatically."
                      : "Enter some content to generate a QR."
                  }}
                </p>
              </div>
            </div>
          </ClientOnly>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const supabase = useSupabaseClient();
const user = useSupabaseUser();
const router = useRouter();

const signOut = async () => {
  await supabase.auth.signOut();
  router.push("/login");
};

type QRCreateResponse = {
  success?: boolean;
  error?: string;
  qrCode?: {
    id?: string;
    title?: string;
    data?: string;
  };
  shortUrl?: {
    id: string;
    shortCode: string;
    originalUrl: string;
  };
  statusCode?: number;
};

type ECL = "L" | "M" | "Q" | "H";

const content = ref<string>("");
const label = ref<string>("");

const size = ref<number>(320);
const margin = ref<number>(2);
const fgColor = ref<string>("#111827");
const bgColor = ref<string>("#ffffff");
const errorCorrectionLevel = ref<ECL>("M");

const canvasRef = ref<HTMLCanvasElement | null>(null);

const isSaving = ref(false);
const isDownloading = ref(false);

const errorMessage = ref<string>("");
const successMessage = ref<string>("");

// Saved/tracked record state
const savedQrId = ref<string | null>(null);
const savedShortCode = ref<string | null>(null);
const lastSavedFingerprint = ref<string | null>(null);

const canGenerate = computed(() => content.value.trim().length > 0);
const canSave = computed(
  () => content.value.trim().length > 0 && label.value.trim().length > 0
);

// Only allow download if there is a saved tracked QR and form has not changed since save
const isDirtySinceSave = computed(() => {
  if (!lastSavedFingerprint.value) return false;
  return currentFingerprint.value !== lastSavedFingerprint.value;
});

const canDownloadSaved = computed(() => {
  return !!savedShortCode.value && !isDirtySinceSave.value;
});

const trackedUrl = computed(() => {
  if (!savedShortCode.value || !process.client) return "";
  return `${window.location.origin}/s/${savedShortCode.value}`;
});

// ---- QR library ----
let QRCode: any = null;

async function loadQrLib() {
  if (QRCode) return QRCode;
  const mod = await import("qrcode");
  QRCode = mod.default ?? mod;
  return QRCode;
}

// ---- Color validation / normalization ----
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isValidHexColor(value: string | null | undefined): boolean {
  return !!value && HEX_COLOR_RE.test(value.trim());
}

function normalizeHexColor(value: string, fallback: string): string {
  const raw = value.trim();
  if (!isValidHexColor(raw)) return fallback;

  // Expand 3-digit hex (#abc -> #aabbcc) for consistency
  if (raw.length === 4) {
    const r = raw[1];
    const g = raw[2];
    const b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return raw.toLowerCase();
}

const safeFgColor = computed(() => normalizeHexColor(fgColor.value, "#111827"));
const safeBgColor = computed(() => normalizeHexColor(bgColor.value, "#ffffff"));

// ---- Fingerprint (used to prevent duplicate downloads after edits without re-save) ----
const currentFingerprint = computed(() => {
  return JSON.stringify({
    content: content.value.trim(),
    label: label.value.trim(),
    size: size.value,
    margin: margin.value,
    fgColor: safeFgColor.value,
    bgColor: safeBgColor.value,
    errorCorrectionLevel: errorCorrectionLevel.value,
  });
});

// Any change after a successful save clears the success message (but keeps saved state)
watch(
  [content, label, size, margin, fgColor, bgColor, errorCorrectionLevel],
  () => {
    successMessage.value = "";
  }
);

// ---- Preview rendering (debounced) ----
let renderTimer: ReturnType<typeof setTimeout> | null = null;
let renderRequestId = 0;

function clearCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = 1;
  canvas.height = 1;
  ctx.clearRect(0, 0, 1, 1);
}

async function renderQr() {
  const requestId = ++renderRequestId;

  // Don't wipe save/download state messages here; only clear hard errors if render succeeds/fails
  if (!canGenerate.value) {
    clearCanvas();
    return;
  }

  const canvas = canvasRef.value;
  if (!canvas) return;

  try {
    const QR = await loadQrLib();
    if (requestId !== renderRequestId) return;

    await QR.toCanvas(canvas, content.value.trim(), {
      width: size.value,
      margin: margin.value,
      errorCorrectionLevel: errorCorrectionLevel.value,
      color: {
        dark: safeFgColor.value,
        light: safeBgColor.value,
      },
    });
  } catch (e: any) {
    errorMessage.value = e?.message ?? "Failed to render QR code.";
  }
}

function scheduleRender(delay = 120) {
  if (renderTimer) clearTimeout(renderTimer);
  renderTimer = setTimeout(() => {
    renderQr();
  }, delay);
}

watch([content, size, margin, fgColor, bgColor, errorCorrectionLevel], () => {
  // Clear previous render-related error before trying again
  errorMessage.value = "";
  scheduleRender();
});

onMounted(() => {
  renderQr();
});

onBeforeUnmount(() => {
  if (renderTimer) clearTimeout(renderTimer);
});

// ---- Actions ----
function resetSavedState() {
  savedQrId.value = null;
  savedShortCode.value = null;
  lastSavedFingerprint.value = null;
}

function resetToDefaults() {
  content.value = "";
  label.value = "";
  size.value = 320;
  margin.value = 2;
  fgColor.value = "#111827";
  bgColor.value = "#ffffff";
  errorCorrectionLevel.value = "M";

  errorMessage.value = "";
  successMessage.value = "";

  // reset saved state too because form is reset
  resetSavedState();
  // no manual render; watcher handles it
}

async function saveTrackedQr() {
  if (!canSave.value) {
    errorMessage.value = "Please enter both content and a label";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const qrResponse = await $fetch<QRCreateResponse>("/api/qr/create", {
      method: "POST",
      body: {
        title: label.value.trim(),
        data: content.value.trim(),
        size: size.value,
        fgColor: safeFgColor.value,
        bgColor: safeBgColor.value,
        errorLevel: errorCorrectionLevel.value,
        createShortUrl: true,
      },
    });

    if (qrResponse.error) {
      throw new Error(qrResponse.error);
    }

    if (!qrResponse.shortUrl?.shortCode) {
      throw new Error("Failed to generate tracking URL");
    }

    savedShortCode.value = qrResponse.shortUrl.shortCode;
    savedQrId.value = qrResponse.qrCode?.id ?? null;
    lastSavedFingerprint.value = currentFingerprint.value;

    successMessage.value = "Tracked QR saved successfully. You can now download the PNG.";
  } catch (e: any) {
    errorMessage.value = e?.message ?? "Failed to save tracked QR code.";
  } finally {
    isSaving.value = false;
  }
}

async function downloadSavedPng() {
  if (!savedShortCode.value) {
    errorMessage.value = "Please save/create a tracked QR first.";
    return;
  }

  if (isDirtySinceSave.value) {
    errorMessage.value =
      "You changed the QR after saving. Save changes first, then download.";
    return;
  }

  isDownloading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const canvas = canvasRef.value;
    if (!canvas) throw new Error("QR canvas not ready yet.");

    const shortUrl = `${window.location.origin}/s/${savedShortCode.value}`;

    const QR = await loadQrLib();
    await QR.toCanvas(canvas, shortUrl, {
      width: size.value,
      margin: margin.value,
      errorCorrectionLevel: errorCorrectionLevel.value,
      color: {
        dark: safeFgColor.value,
        light: safeBgColor.value,
      },
    });

    const dataUrl = canvas.toDataURL("image/png");
    const safeLabel =
      label.value.trim().replace(/[^\w\-]+/g, "_").slice(0, 60) || "qr_code";

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeLabel}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    successMessage.value = "PNG downloaded.";

    // Re-render preview back to direct content (your intended behavior)
    await renderQr();
  } catch (e: any) {
    errorMessage.value = e?.message ?? "Failed to download QR code.";
  } finally {
    isDownloading.value = false;
  }
}
</script>