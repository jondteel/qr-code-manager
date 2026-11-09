import prisma from '~/server/utils/prisma'
import { serverSupabaseClient } from '#supabase/server'
import { reconcileProfile } from '~/server/utils/auth-account.mjs'
import { accountWriteBody, privateAccountResult } from '~/server/utils/auth-boundary'
export default defineEventHandler(async event => {
  const body = await accountWriteBody(event)
  try { return privateAccountResult(event, await reconcileProfile(prisma, (await serverSupabaseClient(event)).auth, body)) }
  catch { return privateAccountResult(event, { state: 'temporarily-unavailable' }) }
})
