<template>
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center h-16 gap-3">
        <!-- Left: Brand + desktop nav -->
        <div class="flex items-center min-w-0 gap-4 sm:gap-8">
          <NuxtLink to="/" class="flex items-center min-w-0">
            <svg
              class="h-8 w-8 text-blue-600 shrink-0"
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
            <span class="ml-2 text-lg sm:text-xl font-bold text-gray-900 truncate">
              {{ BRAND_NAME }}
            </span>
          </NuxtLink>

          <!-- Desktop nav -->
          <div class="hidden md:flex items-center gap-x-8 whitespace-nowrap">
            <NuxtLink
              to="/dashboard"
              :class="navLinkClass('dashboard')"
            >
              Dashboard
            </NuxtLink>

            <NuxtLink
              to="/generate"
              :class="navLinkClass('generate')"
            >
              Generate QR
            </NuxtLink>

            <NuxtLink
              to="/analytics"
              :class="navLinkClass('analytics')"
            >
              Analytics
            </NuxtLink>
          </div>
        </div>

        <!-- Right: desktop account / mobile menu -->
        <div class="flex items-center gap-3 sm:gap-4">
          <!-- Desktop account info -->
          <div class="hidden md:flex items-center gap-4">
            <span class="text-sm text-gray-600 max-w-[220px] truncate">
              {{ user?.email || "Guest" }}
            </span>
            <button
              @click="signOut"
              class="text-gray-600 hover:text-gray-900 text-sm font-medium"
              type="button"
            >
              Sign Out
            </button>
          </div>

          <!-- Mobile hamburger -->
          <div class="md:hidden relative" data-mobile-menu-root>
            <button
              type="button"
              @click.stop="mobileMenuOpen = !mobileMenuOpen"
              class="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-gray-700 hover:bg-gray-50"
              aria-label="Open navigation menu"
              :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
            >
              <svg
                v-if="!mobileMenuOpen"
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
              <svg
                v-else
                class="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <!-- Mobile dropdown -->
            <div
              v-if="mobileMenuOpen"
              class="absolute right-0 mt-2 w-72 max-w-[85vw] bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden"
            >
              <div class="px-4 py-3 border-b border-gray-100">
                <p class="text-xs text-gray-500">Signed in as</p>
                <p class="text-sm text-gray-900 break-all">
                  {{ user?.email || "Guest" }}
                </p>
              </div>

              <div class="py-1">
                <NuxtLink
                  to="/dashboard"
                  :class="mobileNavLinkClass('dashboard')"
                  @click="mobileMenuOpen = false"
                >
                  Dashboard
                </NuxtLink>

                <NuxtLink
                  to="/generate"
                  :class="mobileNavLinkClass('generate')"
                  @click="mobileMenuOpen = false"
                >
                  Generate QR
                </NuxtLink>

                <NuxtLink
                  to="/analytics"
                  :class="mobileNavLinkClass('analytics')"
                  @click="mobileMenuOpen = false"
                >
                  Analytics
                </NuxtLink>
              </div>

              <div class="border-t border-gray-100 p-2">
                <button
                  @click="handleMobileSignOut"
                  class="w-full text-left px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50"
                  type="button"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { BRAND_NAME } from "~/utils/brand";

type NavTab = "dashboard" | "generate" | "analytics" | null;

const props = withDefaults(
  defineProps<{
    activeTab?: NavTab;
  }>(),
  {
    activeTab: null,
  }
);

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

function onDocumentClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  if (target?.closest?.("[data-mobile-menu-root]")) return;
  mobileMenuOpen.value = false;
}

watch(
  () => route.fullPath,
  () => {
    mobileMenuOpen.value = false;
  }
);

function navLinkClass(tab: Exclude<NavTab, null>) {
  return props.activeTab === tab
    ? "text-blue-600 font-medium"
    : "text-gray-600 hover:text-gray-900";
}

function mobileNavLinkClass(tab: Exclude<NavTab, null>) {
  const base = "block px-4 py-2 text-sm";
  return props.activeTab === tab
    ? `${base} font-medium text-blue-600 bg-blue-50`
    : `${base} text-gray-700 hover:bg-gray-50`;
}

onMounted(() => {
  document.addEventListener("click", onDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocumentClick);
});
</script>