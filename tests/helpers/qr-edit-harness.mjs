import * as analyticsWindow from '../../server/utils/analytics-window.mjs'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as h3 from 'h3'
import * as zod from 'zod'
import * as lifecycle from '../../server/utils/qr-lifecycle.mjs'
import * as edit from '../../server/utils/qr-edit.mjs'
import * as issuance from '../../server/utils/qr-issuance.mjs'

export const config = { qrIssuanceOrigin: 'https://issuer.example.invalid', qrIssuanceEnvironment: 'isolated' }
export const fixture = (patch = {}) => ({
  lifecycleStatus: 'active', id: 'qr', userId: 'owner', title: 'Fictional', description: 'Notes', data: 'https://old.example.invalid/A',
  shortUrlId: 'mapping', issuedEncodedTarget: 'https://issuer.example.invalid/s/Original-Code',
  size: 300, errorLevel: 'M', fgColor: '#000000', bgColor: '#FFFFFF',
  createdAt: '2026-01-01', updatedAt: '2026-01-01', analytics: [{ id: 'scan' }],
  shortUrl: { id: 'mapping', userId: 'owner', shortCode: 'Original-Code', originalUrl: 'https://old.example.invalid/A',
    qrCode: { id: 'qr', userId: 'owner', shortUrlId: 'mapping' } }, ...patch,
})

// Actual handlers, synthetic Auth/event only; accepts real Prisma for PG17 runs.
export async function handlerHarness(prisma, { path = 'server/api/qr/[id].put.ts', user = { sub: 'owner' }, id = 'qr', runtimeConfig = config } = {}) {
  let body
  const context = createContext({ defineEventHandler: h => h, useRuntimeConfig: () => runtimeConfig,
    process: { env: { NODE_ENV: 'test' } }, console: { error() {} } })
  const mod = (exports) => new SyntheticModule(Object.keys(exports), function () { for (const [k,v] of Object.entries(exports)) this.setExport(k,v) }, { context })
  const imports = {
    '~/server/utils/prisma': mod({ default: prisma }), '~/server/utils/require-email-account': mod({ requireEmailAccount: async () => { if (!user?.sub) throw h3.createError({ statusCode: 401 }); return user } }),
    h3: mod({ ...h3, getRouterParam: () => id, readBody: async () => body, getQuery: () => ({ period: 'all' }),
      getHeader: () => undefined, sendRedirect: (_event, target, status) => ({ target, status }) }),
    '~/server/utils/qr-lifecycle.mjs': mod(lifecycle), zod: mod(zod), '~/server/utils/qr-edit.mjs': mod(edit), '~/server/utils/qr-issuance.mjs': mod(issuance), '~/server/utils/analytics-window.mjs': mod(analyticsWindow),
  }
  const source = await readFile(new URL('../../' + path, import.meta.url), 'utf8')
  const route = new SourceTextModule(stripTypeScriptTypes(source), { context })
  await route.link(name => { assert.ok(Object.hasOwn(imports, name), name); return imports[name] }); await route.evaluate()
  return { invoke: (input) => { body = input; return route.namespace.default({}) } }
}

export function mockPrisma(initial = fixture(), { fail, profile = true } = {}) {
  let saved = structuredClone(initial)
  const calls = []
  const prisma = { $transaction: async (fn, options) => {
    calls.push(['transaction', options]); let pending = structuredClone(saved), reads = 0
    const tx = {
      $executeRaw: async (sql) => { calls.push(['settings', sql.join('?')]); return 0 },
      $queryRaw: async (sql, id, owner) => { const text = sql.join('?'); calls.push(['lock', text, id, owner]);
        if (fail === 'conflict') throw { code: 'P2034' }
        if (text.includes('"QRCode"')) return pending && pending.id === id && pending.userId === owner ? [{ id }] : []
        return pending?.shortUrl?.id === id && pending.shortUrl.userId === owner ? [{ id }] : []
      },
      user: { findUnique: async () => profile ? { id: 'owner' } : null },
      qRCode: {
        findFirst: async () => { reads++; return fail === 'final' && reads === 2 ? { ...pending, data: 'corrupt' } : structuredClone(pending) },
        update: async ({ data }) => { calls.push(['qr', data]); if (fail === 'qr') throw Error('private DB details'); Object.assign(pending, data, { updatedAt: '2026-10-17' }); return pending },
      },
      shortUrl: { update: async ({ data }) => { calls.push(['mapping', data]); if (fail === 'mapping') throw Error('private DB details'); Object.assign(pending.shortUrl, data); return pending.shortUrl } },
    }
    const result = await fn(tx); saved = pending; return result
  } }
  return { prisma, calls, saved: () => saved }
}
