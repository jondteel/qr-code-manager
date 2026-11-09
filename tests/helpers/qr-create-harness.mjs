import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import * as h3 from 'h3'
import * as zod from 'zod'
import { Prisma } from '@prisma/client'
import * as destination from '../../server/utils/qr-destination.mjs'
import * as issuance from '../../server/utils/qr-issuance.mjs'
const isolated = { qrIssuanceOrigin: 'https://issuer.example.invalid', qrIssuanceEnvironment: 'isolated' }
export async function createHarness({ config = isolated, fail, user = { sub: 'fictional-owner' }, environment, platform = environment ? '1' : undefined, nodeEnv = 'test', collisions = 0, constraint, corrupt } = {}) {
  let body, sequence = 0
  const calls = [], state = [], committed = []
  // Prisma returns only selected fields; returning full fixture rows concealed
  // the creation route's missing lifecycleStatus projection.
  const project = (row, select) => row == null ? row : Object.fromEntries(
    Object.entries(select).map(([key, value]) => [key,
      value === true ? row[key] : project(row[key], value.select)]))
  const prisma = {
    $transaction: async (callback) => {
      calls.push('transaction')
      const pending = []; let qr, link
      const tx = {
        qRCode: {
          create: async ({ data }) => {
            calls.push(['qr', data]); pending.push('qr')
            if (fail === 'qr') throw Error('fictional failure')
            qr = { lifecycleStatus: 'active', ...data, id: 'fictional-qr-' + sequence, shortUrlId: null }
            return { id: qr.id }
          },
          update: async ({ data }) => {
            calls.push(['link', data]); if (fail === 'link') throw Error('fictional failure')
            pending.push('link'); Object.assign(qr, data)
          },
          findUniqueOrThrow: async ({ select }) => {
            if (fail === 'read') throw Error('fictional failure')
            return project({ ...qr, shortUrl: link ?? null, ...(corrupt || {}) }, select)
          },
        },
        shortUrl: { create: async ({ data }) => {
          calls.push(['short', data])
          if (constraint || collisions-- > 0) throw new Prisma.PrismaClientKnownRequestError('Fictional constraint', {
            code: constraint?.code || 'P2002', clientVersion: '5.22.0',
            meta: constraint?.meta || { modelName: 'ShortUrl', target: ['shortCode'] },
          })
          if (fail === 'short') throw Error('fictional failure')
          pending.push('short'); link = { ...data, id: 'fictional-short-' + sequence }; return { id: link.id }
        } },
      }
      const result = await callback(tx)
      state.push(...pending); committed.push(result)
      return result
    },
  }
  const context = createContext({
    defineEventHandler: (handler) => handler,
    useRuntimeConfig: () => config,
    process: { env: { VERCEL_ENV: environment, VERCEL: platform, NODE_ENV: nodeEnv, VERCEL_URL: 'evil.example.invalid' } },
    console: { error() {} },
  })
  function mod(exports) {
    return new SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v) }, { context })
  }
  const imports = {
    '~/server/utils/prisma': mod({ default: prisma }),
    '~/server/utils/require-email-account': mod({ requireEmailAccount: async () => { if (!user?.sub) throw h3.createError({ statusCode: 401 }); return user } }),
    h3: mod({ ...h3, readBody: async () => body }), zod: mod(zod),
    nanoid: mod({ nanoid: () => sequence++ === 0 ? 'fixture8' : 'retry' + sequence }),
    '@prisma/client': mod({ Prisma }),
    '~/server/utils/qr-destination.mjs': mod(destination),
    '~/server/utils/qr-issuance.mjs': mod(issuance),
  }
  const source = await readFile(new URL('../../server/api/qr/create.post.ts', import.meta.url), 'utf8')
  const route = new SourceTextModule(stripTypeScriptTypes(source), { context })
  await route.link((specifier) => { assert.ok(Object.hasOwn(imports, specifier), `Unexpected import ${specifier}`); return imports[specifier] })
  await route.evaluate()
  return { calls, state, committed,
    invoke: (input, headers = {}) => { body = input; return route.namespace.default({ node: { req: { headers } } }) },
  }
}
