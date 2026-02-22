import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'
import { createError } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    // Auth
    const user = await serverSupabaseUser(event)
    if (!user?.sub) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    }

    // Fetch user's QR codes (minimal fields needed for dashboard)
    const qrCodes = await prisma.qRCode.findMany({
      where: {
        userId: user.sub, // ✅ fixed
      },
      select: {
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
    })

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
      qrCodes,
      stats: {
        totalQRCodes,
        totalShortUrls,
        totalScans,
        thisMonthScans,
      },
    }
  } catch (error: any) {
    if (error?.statusCode) throw error

    console.error('List QR codes error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch QR codes',
    })
  }
})