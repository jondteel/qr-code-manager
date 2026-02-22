import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'
import { createError, getRouterParam } from 'h3'

export default defineEventHandler(async (event) => {
  try {
    const user = await serverSupabaseUser(event)
    if (!user?.sub) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'QR code ID is required' })
    }

    // Fetch only the user's QR code (prevents loading someone else's data)
    const qrCode = await prisma.qRCode.findFirst({
      where: {
        id,
        userId: user.sub,
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
        imageUrl: true,
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
    })

    if (!qrCode) {
      // Covers both "not found" and "not yours" without leaking which
      throw createError({ statusCode: 404, statusMessage: 'QR code not found' })
    }

    return {
      success: true,
      qrCode,
    }
  } catch (error: any) {
    if (error?.statusCode) throw error

    console.error('Fetch QR code error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch QR code',
    })
  }
})