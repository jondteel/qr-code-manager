// nuxt.config.ts
// https://nuxt.com/modules/tailwindcss
export default defineNuxtConfig({
  modules: ["@nuxtjs/tailwindcss", "@nuxtjs/supabase", "./modules/auth-transport"],

  // @ts-ignore
  supabase: {
    redirect: false,
    clientOptions: { auth: { detectSessionInUrl: false } },
  },

  app: { head: { title: 'Scanlytics' } },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    authSiteOrigin: '',
    qrIssuanceOrigin: '',
    qrIssuanceEnvironment: '',
    qrLegacyCanonicalRegenEnabled: false,
    qrLegacyCanonicalCompatibility: '',
  },

  routeRules: {
    '/auth/**': { ssr: false, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
    '/api/auth/**': { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } },
  },

  // ✅ Fix TS DOM globals (window, document, File, etc.)
  typescript: {
    tsConfig: {
      compilerOptions: {
        lib: ["ESNext", "DOM", "DOM.Iterable"],
      },
    },
  },

  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
});
