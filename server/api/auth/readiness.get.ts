import prisma from '~/server/utils/prisma'
import { serverSupabaseClient } from '#supabase/server'
import { accountReadiness } from '~/server/utils/auth-account.mjs'
import { privateAccountResult } from '~/server/utils/auth-boundary'
export default defineEventHandler(async event => {
  try { return privateAccountResult(event, await accountReadiness(prisma, (await serverSupabaseClient(event)).auth)) }
  catch { return privateAccountResult(event, { state: 'temporarily-unavailable' }) }
})
