// nuxt.config.ts
// https://nuxt.com/modules/tailwindcss
export default defineNuxtConfig({
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/supabase'],
  
  // @ts-ignore
  supabase: {
    redirect: false
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
  },
  
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true }
})