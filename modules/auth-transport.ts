import { defineNuxtModule } from '@nuxt/kit'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

export default defineNuxtModule({
  meta: { name: 'scanlytics-auth-transport' },
  setup(_, nuxt) {
    const root = nuxt.options.modulesDir.map(dir => resolve(dir, '@nuxtjs/supabase')).find(dir => existsSync(resolve(dir, 'package.json')))
    if (!root) throw new Error('AUTH_TRANSPORT_MODULE_NOT_FOUND')
    const version = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).version
    if (version !== '2.0.3') throw new Error('AUTH_TRANSPORT_VERSION_REVIEW_REQUIRED')
    const target = resolve(root, 'dist/runtime/utils/fetch-retry.js').replaceAll('\\', '/')
    const source = readFileSync(resolve(nuxt.options.rootDir, 'utils/auth-fetch.mjs'), 'utf8')
    const plugin = () => ({
      name: 'scanlytics-credential-safe-auth-fetch', enforce: 'pre' as const,
      load(id: string) { if (id.replaceAll('\\', '/').split('?')[0] === target) return source },
    })
    nuxt.hook('vite:extendConfig', config => { config.plugins ||= []; config.plugins.push(plugin()) })
    nuxt.hook('nitro:config', config => {
      config.rollupConfig ||= {}; config.rollupConfig.plugins ||= []
      ;(config.rollupConfig.plugins as any[]).push(plugin())
    })
  },
})
