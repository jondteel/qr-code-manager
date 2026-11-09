import prisma from '~/server/utils/prisma'
import { requireEmailAccount } from '~/server/utils/require-email-account'
import { createError, getRouterParam } from 'h3'
import { presentQr, readQrSnapshot, serverQrStage } from '~/server/utils/qr-issuance.mjs'

export default defineEventHandler(async (event) => {
  try {
    const user = await requireEmailAccount(event)
    if (!user?.sub) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'QR code ID is required' })
    }

    // Fetch only the user's QR code (prevents loading someone else's data)
    const qrCode = await readQrSnapshot(prisma, (tx) => tx.qRCode.findFirst({
      where: {
        id,
        userId: user.sub,
      },
      select: {
        userId: true,
        issuedEncodedTarget: true,
        lifecycleStatus: true,
        shortUrlId: true,
        id: true,
        title: true,
        description: true,
        data: true,
        size: true,
        fgColor: true,
        bgColor: true,
        errorLevel: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        shortUrl: {
          select: {
            userId: true,
            id: true,
            shortCode: true,
            originalUrl: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            analytics: true,
          },
        },
        analytics: {
          orderBy: { timestamp: 'desc' },
          take: 50,
          select: {
            id: true,
            timestamp: true,
            ipAddress: true,
            userAgent: true,
            shortUrlId: true,
          },
        },
      },
    }))

    if (!qrCode) {
      // Covers both "not found" and "not yours" without leaking which
      throw createError({ statusCode: 404, statusMessage: 'QR code not found' })
    }

    return {
      success: true,
      qrCode: presentQr(qrCode, user.sub, useRuntimeConfig(event), process.env.VERCEL_ENV, serverQrStage(process.env)),
    }
  } catch (error: any) {
    if (error?.statusCode) throw error

    console.error({ event: 'qr-fetch', outcome: 'failed', reason: 'unexpected-error' })

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch QR code',
    })
  }
})
