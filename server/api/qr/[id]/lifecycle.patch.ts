import prisma from '~/server/utils/prisma'
import { requireEmailAccount } from '~/server/utils/require-email-account'
import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { transitionQr } from '~/server/utils/qr-lifecycle.mjs'
import { isQrEditConflict } from '~/server/utils/qr-edit.mjs'
import { serverQrStage } from '~/server/utils/qr-issuance.mjs'

const schema = z.object({ status: z.enum(['active', 'archived', 'retired']) }).strict()
export default defineEventHandler(async event => {
  try {
    const user = await requireEmailAccount(event)
    if (!user?.sub) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'QR code ID is required' })
    const { status } = schema.parse(await readBody(event))
    const qrCode = await transitionQr(prisma, { id, owner: user.sub, status, config: useRuntimeConfig(event), environment: process.env.VERCEL_ENV, stage: serverQrStage(process.env) })
    return { success: true, qrCode }
  } catch (error: any) {
    if (error instanceof z.ZodError) throw createError({ statusCode: 400, statusMessage: 'Invalid QR lifecycle request' })
    if (error?.statusCode) throw error
    if (isQrEditConflict(error)) throw createError({ statusCode: 409, statusMessage: 'QR changed; reload before trying again' })
    throw createError({ statusCode: 500, statusMessage: 'Failed to update QR lifecycle' })
  }
})
