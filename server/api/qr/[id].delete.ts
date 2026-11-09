import prisma from '~/server/utils/prisma'
import { requireEmailAccount } from '~/server/utils/require-email-account'
import { createError, getRouterParam } from 'h3'

// Preserve the authenticated endpoint for old clients, but never hard-delete.
export default defineEventHandler(async event => {
  try {
    const user = await requireEmailAccount(event)
    if (!user?.sub) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'QR code ID is required' })
    const qr = await prisma.qRCode.findFirst({ where: { id, userId: user.sub }, select: { id: true } })
    if (!qr) throw createError({ statusCode: 404, statusMessage: 'QR code not found' })
    throw createError({ statusCode: 409, statusMessage: 'Permanent QR deletion is unavailable. Use Archive or Retire.' })
  } catch (error: any) {
    if (error?.statusCode) throw error
    throw createError({ statusCode: 500, statusMessage: 'Failed to verify QR code' })
  }
})
