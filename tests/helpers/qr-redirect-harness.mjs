import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as h3 from 'h3'
import * as redirect from '../../server/utils/qr-redirect.mjs'
import * as scan from '../../server/utils/qr-scan.mjs'

// The actual TS route and H3 implementation; only Prisma is injected.
export async function redirectHandler(prisma, logs = []) {
  const context = createContext({ console: { error: x => logs.push(x), info: x => logs.push(x) } })
  const mod = values => new SyntheticModule(Object.keys(values), function () {
    for (const [key,value] of Object.entries(values)) this.setExport(key,value)
  }, { context })
  const imports = { h3: mod(h3), '~/server/utils/prisma': mod({ default: prisma }),
    '~/server/utils/qr-redirect.mjs': mod(redirect),
    '~/server/utils/qr-scan.mjs': mod({ recordRedirectScan: (db, data) => scan.recordRedirectScan(db, data, { info: x => logs.push(x), error: x => logs.push(x) }) }) }
  const source = await readFile(new URL('../../server/routes/s/[code].get.ts', import.meta.url),'utf8')
  const route = new SourceTextModule(stripTypeScriptTypes(source), { context })
  await route.link(name => imports[name]); await route.evaluate()
  return route.namespace.default
}

export const redirectFixture = (code = 'Original-Code') => ({
  id: 'mapping', userId: 'owner', shortCode: code, originalUrl: 'https://destination.example.invalid/A%2Fb?q=Case#frag',
  qrCode: { lifecycleStatus: 'active', id: 'qr', shortUrlId: 'mapping', userId: 'owner', data: 'https://destination.example.invalid/A%2Fb?q=Case#frag',
    issuedEncodedTarget: 'https://retired.example.invalid/s/' + encodeURIComponent(code) },
})

export function redirectMock(link = redirectFixture(), { readFailure = false, scanFailure = false } = {}) {
  const calls = [], scans = []
  return { calls, scans, prisma: {
    $transaction: async (fn,options) => {
      if(options.maxWait) { calls.push(['scan-transaction',options]); return fn({ $queryRaw: async () => link && ['active','archived'].includes(link.qrCode?.lifecycleStatus) ? [{id:link.qrCode.id}] : [], $executeRaw: async sql => { calls.push(['scan-limit',sql.join('')]) }, analytics: { create: async query => { calls.push(['scan',query]); if(scanFailure) throw Error('private details'); scans.push(query.data); return { id: 'fictional-scan' } } } }) }
      calls.push(['transaction',options]); if(readFailure) throw Error('private connection details')
      return fn({ $executeRaw: async sql => { calls.push(['readonly',sql.join('')]) }, shortUrl: {
        findUnique: async query => { calls.push(['lookup',query]); return link?.shortCode === query.where.shortCode ? structuredClone(link) : null },
      } })
    },
    analytics: { create: async query => { calls.push(['scan',query]); if(scanFailure) throw Error('private details'); scans.push(query.data) } },
  } }
}

export async function redirectCacheHandler() {
  const context = createContext({})
  const imports = new SyntheticModule(Object.keys(h3), function () {
    for (const [key, value] of Object.entries(h3)) this.setExport(key, value)
  }, { context })
  const source = await readFile(new URL('../../server/middleware/redirect-cache.ts', import.meta.url), 'utf8')
  const route = new SourceTextModule(stripTypeScriptTypes(source), { context })
  await route.link(() => imports); await route.evaluate()
  return route.namespace.default
}
