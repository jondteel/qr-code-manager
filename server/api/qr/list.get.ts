import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    // Check authentication
    const user = await serverSupabaseUser(event)
    if (!user) {
      return {
        error: 'Unauthorized',
        statusCode: 401
      }
    }

    // Fetch user's QR codes with their short URLs and analytics count
    const qrCodes = await prisma.qRCode.findMany({
      where: {
        userId: user.id
      },
      include: {
        shortUrl: true,
        analytics: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate stats
    const totalQRCodes = qrCodes.length
    const totalShortUrls = qrCodes.filter(qr => qr.shortUrlId).length
    const totalScans = qrCodes.reduce((sum, qr) => sum + qr.analytics.length, 0)
    
    // Calculate this month's scans
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthScans = qrCodes.reduce((sum, qr) => {
      return sum + qr.analytics.filter(a => a.timestamp >= startOfMonth).length
    }, 0)

    return {
      success: true,
      qrCodes,
      stats: {
        totalQRCodes,
        totalShortUrls,
        totalScans,
        thisMonthScans
      }
    }

  } catch (error: any) {
    console.error('List QR codes error:', error)
    return {
      error: error?.message || 'Failed to fetch QR codes',
      statusCode: 500
    }
  }
})