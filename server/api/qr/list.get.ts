import prisma from '~/server/utils/prisma'
import { requireEmailAccount } from '~/server/utils/require-email-account'
import { createError, getQuery } from 'h3'
import { presentQr, readQrSnapshot, serverQrStage } from '~/server/utils/qr-issuance.mjs'

export default defineEventHandler(async (event) => {
  try {
    // Auth
    const user = await requireEmailAccount(event)
    if (!user?.sub) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }

    const status = getQuery(event).status ?? 'active'
    if (!['active', 'archived', 'retired'].includes(status as string)) throw createError({ statusCode: 400, statusMessage: 'Invalid QR lifecycle filter' })

    // Fetch user's QR codes (minimal fields needed for dashboard)
    const qrCodes = await readQrSnapshot(prisma, (tx) => tx.qRCode.findMany({
      where: {
        userId: user.sub, // ✅ fixed
      },
      select: {
        userId: true,
        issuedEncodedTarget: true,
        lifecycleStatus: true,
        id: true,
        title: true,
        description: true,
        data: true,
        size: true,
        fgColor: true,
        bgColor: true,
        errorLevel: true,
        shortUrlId: true,
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
        analytics: {
          select: {
            id: true,
            timestamp: true, // enough for counts + month filtering
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }))

    // Stats
    const totalQRCodes = qrCodes.length
    const totalShortUrls = qrCodes.filter((qr) => !!qr.shortUrlId).length
    const totalScans = qrCodes.reduce((sum, qr) => sum + qr.analytics.length, 0)

    // This month's scans
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const thisMonthScans = qrCodes.reduce((sum, qr) => {
      return sum + qr.analytics.filter((a) => new Date(a.timestamp) >= startOfMonth).length
    }, 0)

    return {
      success: true,
      qrCodes: qrCodes.filter(qr => qr.lifecycleStatus === status).map((qr) => presentQr(qr, user.sub, useRuntimeConfig(event), process.env.VERCEL_ENV, serverQrStage(process.env))),
      stats: {
        totalQRCodes,
        totalShortUrls,
        totalScans,
        thisMonthScans,
      },
    }
  } catch (error: any) {
    if (error?.statusCode) throw error

    console.error({ event: 'qr-list', outcome: 'failed', reason: 'unexpected-error' })

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch QR codes',
    })
  }
})
