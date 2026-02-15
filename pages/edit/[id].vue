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

            <div class="hidden md:flex items-center gap-x-8 whitespace-nowrap">
              <NuxtLink to="/dashboard" class="text-gray-600 hover:text-gray-900">Dashboard</NuxtLink>
              <NuxtLink to="/generate" class="text-gray-600 hover:text-gray-900">Generate QR</NuxtLink>
              <NuxtLink to="/analytics" class="text-gray-600 hover:text-gray-900">Analytics</NuxtLink>
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

    <!-- Main -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-6">
        <NuxtLink to="/dashboard" class="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1 mb-4">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </NuxtLink>
        <h1 class="text-2xl font-bold text-gray-900">Edit QR Code</h1>
        <p class="text-gray-600 mt-1">Update your QR code details and styling</p>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>

      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {{ error }}
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Form -->
        <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="space-y-6">
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

            <!-- Destination URL (read-only) -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">Destination URL</label>
              <input
                :value="qrCode.data"
                type="text"
                disabled
                class="w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p class="text-xs text-gray-500 mt-1">The destination URL cannot be changed</p>
            </div>

            <!-- Description -->
            <div>
              <label class="block text-sm font-medium text-gray-900 mb-1">Description (optional)</label>
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
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1">Foreground</label>
                <div class="flex items-center gap-3">
                  <input v-model="form.fgColor" type="color" class="h-10 w-14 p-1 rounded border border-gray-300" />
                  <input
                    v-model="form.fgColor"
                    type="text"
                    class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-900 mb-1">Background</label>
                <div class="flex items-center gap-3">
                  <input v-model="form.bgColor" type="color" class="h-10 w-14 p-1 rounded border border-gray-300" />
                  <input
                    v-model="form.bgColor"
                    type="text"
                    class="flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div class="flex gap-3">
              <button
                @click="saveChanges"
                :disabled="saving"
                class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
              >
                {{ saving ? 'Saving...' : 'Save Changes' }}
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
          </div>
        </section>

        <!-- Preview -->
        <section class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Preview</h2>
          
          <ClientOnly>
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-6 flex items-center justify-center">
              <canvas ref="canvasRef" class="bg-white rounded"></canvas>
            </div>
          </ClientOnly>

          <div class="mt-6">
            <h3 class="text-sm font-semibold text-gray-900 mb-2">QR Code Info</h3>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between">
                <dt class="text-gray-600">Created:</dt>
                <dd class="text-gray-900">{{ formatDate(qrCode.createdAt) }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-gray-600">Total Scans:</dt>
                <dd class="text-gray-900">{{ qrCode.analytics?.length || 0 }}</dd>
              </div>
              <div v-if="qrCode.shortUrl" class="flex justify-between">
                <dt class="text-gray-600">Short URL:</dt>
                <dd class="text-gray-900 truncate">/s/{{ qrCode.shortUrl.shortCode }}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const signOut = async () => {
  await supabase.auth.signOut()
  router.push('/login')
}

const id = route.params.id

// Fetch QR code data
const { data: qrData, pending: loading, error: fetchError } = await useFetch(`/api/qr/${id}`)

const qrCode = computed(() => qrData.value?.qrCode || {})
const error = computed(() => fetchError.value?.message || qrData.value?.error)

// Form state
const form = ref({
  title: '',
  description: '',
  size: 320,
  fgColor: '#000000',
  bgColor: '#ffffff',
  errorLevel: 'M'
})

// Populate form when data loads
watch(qrCode, (newQR) => {
  if (newQR && newQR.id) {
    form.value = {
      title: newQR.title,
      description: newQR.description || '',
      size: newQR.size,
      fgColor: newQR.fgColor,
      bgColor: newQR.bgColor,
      errorLevel: newQR.errorLevel
    }
  }
}, { immediate: true })

// Save state
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

// QR Code library
const canvasRef = ref(null)
let QRCodeLib = null

// Render QR preview
const renderPreview = async () => {
  if (!canvasRef.value || !qrCode.value.id) return

  if (!QRCodeLib) {
    const mod = await import('qrcode')
    QRCodeLib = mod.default ?? mod
  }

  const url = qrCode.value.shortUrl
    ? `${window.location.origin}/s/${qrCode.value.shortUrl.shortCode}`
    : qrCode.value.data

  await QRCodeLib.toCanvas(canvasRef.value, url, {
    width: form.value.size,
    margin: 2,
    errorCorrectionLevel: form.value.errorLevel,
    color: {
      dark: form.value.fgColor,
      light: form.value.bgColor,
    },
  })
}

// Watch form changes and update preview
watch(form, renderPreview, { deep: true })

onMounted(() => {
  renderPreview()
})

// Format date
const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Save changes
const saveChanges = async () => {
  saving.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    const response = await $fetch(`/api/qr/${id}`, {
      method: 'PUT',
      body: {
        title: form.value.title,
        description: form.value.description,
        size: form.value.size,
        fgColor: form.value.fgColor,
        bgColor: form.value.bgColor,
        errorLevel: form.value.errorLevel,
      }
    })

    if (response.error) {
      saveError.value = response.error
    } else {
      saveSuccess.value = true
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    }
  } catch (err) {
    saveError.value = 'Failed to save changes'
    console.error('Save error:', err)
  } finally {
    saving.value = false
  }
}
</script>