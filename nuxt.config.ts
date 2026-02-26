// nuxt.config.ts
// https://nuxt.com/modules/tailwindcss
export default defineNuxtConfig({
  modules: ["@nuxtjs/tailwindcss", "@nuxtjs/supabase"],

  // @ts-ignore
  supabase: {
    redirect: false,
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
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