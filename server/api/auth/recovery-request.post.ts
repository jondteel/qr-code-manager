import { z } from 'zod'
import { createError, setResponseStatus } from 'h3'
import { accountWriteBody } from '~/server/utils/auth-boundary'
import { localRecovery } from '~/server/utils/recovery-local.mjs'
export default defineEventHandler(async event => {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict().safeParse(await accountWriteBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Enter a valid email address' })
  const service = await localRecovery()
  if (!service) {
    setResponseStatus(event,503)
    return { state: 'recovery-unavailable', message: 'Password recovery is temporarily unavailable. Please try again later.' }
  }
  await service.request(parsed.data.email)
  return { state: 'request-received', message: 'If this account is eligible, recovery instructions will arrive shortly. Check your email.' }
})
