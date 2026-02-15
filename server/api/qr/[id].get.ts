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

    // Get QR code ID
    const id = getRouterParam(event, 'id')
    
    if (!id) {
      return {
        error: 'QR code ID is required',
        statusCode: 400
      }
    }

    // Fetch QR code with related data
    const qrCode = await prisma.qRCode.findUnique({
      where: { id },
      include: {
        shortUrl: true,
        analytics: true,
      }
    })

    if (!qrCode) {
      return {
        error: 'QR code not found',
        statusCode: 404
      }
    }

    if (qrCode.userId !== user.sub) {
      return {
        error: 'Unauthorized to view this QR code',
        statusCode: 403
      }
    }

    return {
      success: true,
      qrCode,
      statusCode: 200
    }

  } catch (error: any) {
    console.error('Fetch QR code error:', error)
    return {
      error: error?.message || 'Failed to fetch QR code',
      statusCode: 500
    }
  }
})