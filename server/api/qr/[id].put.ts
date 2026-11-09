import prisma from '~/server/utils/prisma'
import { requireEmailAccount } from '~/server/utils/require-email-account'
import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'
import { editQr, isQrEditConflict } from '~/server/utils/qr-edit.mjs'
import { serverQrStage } from '~/server/utils/qr-issuance.mjs'

const updateQrSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(1000).transform((v) => v === '' ? null : v).optional(),
  data: z.string().optional(),
  size: z.coerce.number().int().min(128).max(1024).optional(),
  fgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  errorLevel: z.enum(['L', 'M', 'Q', 'H']).optional(),
}).strict().refine((data) => Object.values(data).some((v) => v !== undefined), {
  message: 'At least one field must be provided',
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireEmailAccount(event)
    if (!user?.sub) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'QR code ID is required' })
    const parsed = updateQrSchema.parse(await readBody(event))
    const changes = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined))
    const qrCode = await editQr(prisma, {
      id, owner: user.sub, changes, config: useRuntimeConfig(event),
      environment: process.env.VERCEL_ENV, stage: serverQrStage(process.env),
    })
    return { success: true, qrCode }
  } catch (error: any) {
    if (error instanceof z.ZodError) throw createError({ statusCode: 400, statusMessage: 'Validation failed', data: { issues: error.issues } })
    if (error?.statusCode) throw error
    if (isQrEditConflict(error)) throw createError({ statusCode: 409, statusMessage: 'QR edit conflicted; reload before trying again' })
    // Never log Prisma error objects: driver details can contain connection data.
    throw createError({ statusCode: 500, statusMessage: 'Failed to update QR code' })
  }
})
