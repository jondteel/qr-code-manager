import { serverSupabaseClient } from '#supabase/server'
import { z } from 'zod'
import { createError } from 'h3'
import { accountWriteBody, authOrigin } from '~/server/utils/auth-boundary'
const schema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(6).max(128) }).strict()
export default defineEventHandler(async event => {
  const parsed = schema.safeParse(await accountWriteBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Enter a valid email and a password of 6 to 128 characters' })
  try {
    const client = await serverSupabaseClient(event)
    await client.auth.signUp({ ...parsed.data, options: { emailRedirectTo: authOrigin(event) + '/auth/confirm' } })
  } catch { /* Ambiguous provider outcome: never replay, insert a profile or log. */ }
  return { state: 'request-received', message: 'If signup is available, follow the email instructions, then sign in. If you can already sign in, continue to profile setup. A username is chosen after authentication.' }
})
