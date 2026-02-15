import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  const user = await serverSupabaseUser(event)
  if (!user?.sub) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'QR code ID is required' })
  }

  const qrCode = await prisma.qRCode.findUnique({
    where: { id },
    select: { id: true, userId: true, shortUrlId: true },
  })

  if (!qrCode) {
    throw createError({ statusCode: 404, statusMessage: 'QR code not found' })
  }

  if (qrCode.userId !== user.sub) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  await prisma.$transaction(async (tx) => {
    if (qrCode.shortUrlId) {
      await tx.analytics.deleteMany({ where: { shortUrlId: qrCode.shortUrlId } })
      await tx.shortUrl.delete({ where: { id: qrCode.shortUrlId } })
    }

    await tx.qRCode.delete({ where: { id: qrCode.id } })
  })

  return { success: true }
})
