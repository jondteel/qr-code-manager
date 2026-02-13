<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header/Navigation (copied from your existing page) -->
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
              <NuxtLink to="/dashboard" class="text-gray-600 hover:text-gray-900"
                >Dashboard</NuxtLink
              >
              <NuxtLink to="/generate" class="text-blue-600 font-medium"
                >Generate QR</NuxtLink
              >
              <NuxtLink to="/analytics" class="text-gray-600 hover:text-gray-900"
                >Analytics</NuxtLink
              >
            </div>
          </div>

          <div class="flex items-center gap-4">
            <span class="text-sm text-gray-600">testuser123</span>
            <button class="text-gray-600 hover:text-gray-900 text-sm font-medium">
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
              <label class="block text-sm font-medium text-gray-900 mb-1"
                >QR Content</label
              >
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

            <!-- Label (required) -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1"
                >Label / Name *</label
              >
              <input
                v-model="label"
                type="text"
                required
                class="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Business Card, Flyer A, Store Poster..."
              />
              <p class="text-xs text-gray-600 mt-2">
                Give this QR code a name to identify it in your dashboard. All QR codes
                are tracked.
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
                <label class="block text-sm font-medium text-gray-900 mb-1"
                  >Foreground</label
                >
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
              </div>

              <!-- Background -->
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1"
                  >Background</label
                >
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
              </div>

              <!-- Error correction -->
              <div class="md:col-span-2">
                <label class="block text-sm font-medium text-gray-900 mb-1"
                  >Error Correction</label
                >
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

            <!-- Actions -->
            <div class="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
                :disabled="!canDownload || isGenerating"
                :class="
                  !canDownload || isGenerating ? 'opacity-60 cursor-not-allowed' : ''
                "
                @click="downloadPng"
              >
                {{ isGenerating ? "Generating…" : "Download PNG" }}
              </button>

              <button
                type="button"
                class="flex-1 bg-gray-100 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-200 transition"
                @click="resetToDefaults"
              >
                Reset
              </button>
            </div>

            <p v-if="errorMessage" class="text-sm text-red-600">{{ errorMessage }}</p>
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
                <p class="text-xs text-gray-500">
                  {{
                    canGenerate
                      ? "Preview updates automatically."
                      : "Enter some content to generate a QR."
                  }}
                </p>
              </div>
            </div>
          </ClientOnly>

          <div class="mt-6 rounded-lg border border-gray-200 p-4">
            <h3 class="text-sm font-semibold text-gray-900 mb-2">
              What’s next (analytics)
            </h3>
            <ul class="text-sm text-gray-600 space-y-1 list-disc pl-5">
              <li>Create a “tracked link” that redirects to your destination URL</li>
              <li>
                Store QR records in Supabase (user_id, label, destination, created_at)
              </li>
              <li>Log scan events (timestamp, device, referrer, geo if available)</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

type QRCreateResponse = {
  success?: boolean;
  error?: string;
  qrCode?: any;
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
const fgColor = ref<string>("#111827"); // gray-900
const bgColor = ref<string>("#ffffff");
const errorCorrectionLevel = ref<ECL>("M");

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isGenerating = ref(false);
const errorMessage = ref<string>("");

const canGenerate = computed(() => content.value.trim().length > 0);
const canDownload = computed(
  () => content.value.trim().length > 0 && label.value.trim().length > 0
);
let QRCode: any = null;

async function loadQrLib() {
  if (QRCode) return QRCode;
  // Dynamic import so it only loads on client when needed
  const mod = await import("qrcode");
  QRCode = mod.default ?? mod;
  return QRCode;
}

async function renderQr() {
  console.log("renderQr called", {
    canGenerate: canGenerate.value,
    content: content.value,
    label: label.value,
  });

  errorMessage.value = "";
  if (!canGenerate.value) {
    console.log("canGenerate is false, clearing canvas");
    // Clear canvas if empty
    const canvas = canvasRef.value;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        canvas.width = 1;
        canvas.height = 1;
        ctx.clearRect(0, 0, 1, 1);
      }
    }
    return;
  }

  const canvas = canvasRef.value;
  console.log("canvas ref:", canvas);
  if (!canvas) return;

  try {
    console.log("Loading QR library...");
    const QR = await loadQrLib();
    console.log("Rendering QR to canvas...");
    await QR.toCanvas(canvas, content.value.trim(), {
      width: size.value,
      margin: margin.value,
      errorCorrectionLevel: errorCorrectionLevel.value,
      color: {
        dark: fgColor.value,
        light: bgColor.value,
      },
    });
    console.log("QR rendered successfully");
  } catch (e: any) {
    console.error("QR render error:", e);
    errorMessage.value = e?.message ?? "Failed to render QR code.";
  }
}

watch([content, size, margin, fgColor, bgColor, errorCorrectionLevel], () => {
  // Live preview updates as you type
  renderQr();
});

onMounted(() => {
  renderQr();
});

function resetToDefaults() {
  content.value = "";
  label.value = "";
  size.value = 320;
  margin.value = 2;
  fgColor.value = "#111827";
  bgColor.value = "#ffffff";
  errorCorrectionLevel.value = "M";
  errorMessage.value = "";
  renderQr();
}

async function downloadPng() {
  if (!canDownload.value) {
    errorMessage.value = "Please enter both content and a label";
    return;
  }

  isGenerating.value = true;
  errorMessage.value = "";

  try {
    const canvas = canvasRef.value;
    if (!canvas) throw new Error("QR canvas not ready yet.");

    // Always save to database and create short URL
    const qrResponse = await $fetch<QRCreateResponse>("/api/qr/create", {
      method: "POST",
      body: {
        title: label.value.trim(),
        data: content.value.trim(),
        size: size.value,
        fgColor: fgColor.value,
        bgColor: bgColor.value,
        errorLevel: errorCorrectionLevel.value,
        createShortUrl: true,
      },
    });

    if (qrResponse.error) {
      throw new Error(qrResponse.error);
    }

    // Use the short URL for the QR code
    if (!qrResponse.shortUrl) {
      throw new Error("Failed to generate tracking URL");
    }

    const shortUrl = `${window.location.origin}/s/${qrResponse.shortUrl.shortCode}`;

    // Generate QR with short URL
    const QR = await loadQrLib();
    await QR.toCanvas(canvas, shortUrl, {
      width: size.value,
      margin: margin.value,
      errorCorrectionLevel: errorCorrectionLevel.value,
      color: {
        dark: fgColor.value,
        light: bgColor.value,
      },
    });

    // Download the PNG
    const dataUrl = canvas.toDataURL("image/png");
    const safeLabel = label.value
      .trim()
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 60);

    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${safeLabel}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    console.log("✅ QR code created with tracking URL:", shortUrl);

    // Re-render preview with original content
    await renderQr();
  } catch (e: any) {
    errorMessage.value = e?.message ?? "Failed to create QR code.";
  } finally {
    isGenerating.value = false;
  }
}
</script>
