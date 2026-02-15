import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'

export default defineEventHandler(async (event) => {
  try {
    // Check authentication
    const user = await serverSupabaseUser(event)
    if (!user || !user.sub) {
      return {
        error: 'Unauthorized',
        statusCode: 401
      }
    }

    // Get query params
    const query = getQuery(event)
    const period = query.period || 30

    // Calculate date range
    let startDate
    if (period === 'all') {
      startDate = new Date(0) // Beginning of time
    } else {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - parseInt(period as string))
    }

    // Get user's QR codes
    const qrCodes = await prisma.qRCode.findMany({
      where: { userId: user.sub },
      include: {
        analytics: {
          where: {
            timestamp: {
              gte: startDate
            }
          }
        },
        shortUrl: true
      }
    })

    // Calculate stats
    const totalScans = qrCodes.reduce((sum, qr) => sum + qr.analytics.length, 0)
    
    // Unique visitors (count unique IP addresses)
    const uniqueIPs = new Set()
    qrCodes.forEach(qr => {
      qr.analytics.forEach(scan => {
        if (scan.ipAddress && scan.ipAddress !== 'unknown') {
          uniqueIPs.add(scan.ipAddress)
        }
      })
    })
    const uniqueVisitors = uniqueIPs.size

    // Active QR codes (ones with at least 1 scan in period)
    const activeQRCodes = qrCodes.filter(qr => qr.analytics.length > 0).length

    // Average scans per day
    const days = period === 'all' ? Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))) : parseInt(period as string)
    const avgScansPerDay = Math.round(totalScans / days)

    // Calculate growth (placeholder - would need previous period data)
    const scanGrowth = 0

    // Top performing QR codes
    const topQRCodes = qrCodes
      .map(qr => ({
        id: qr.id,
        title: qr.title,
        data: qr.data,
        scanCount: qr.analytics.length
      }))
      .sort((a, b) => b.scanCount - a.scanCount)
      .slice(0, 10)

    return {
      success: true,
      stats: {
        totalScans,
        uniqueVisitors,
        activeQRCodes,
        avgScansPerDay,
        scanGrowth
      },
      topQRCodes
    }

  } catch (error: any) {
    console.error('Analytics error:', error)
    return {
      error: error?.message || 'Failed to fetch analytics',
      statusCode: 500
    }
  }
})