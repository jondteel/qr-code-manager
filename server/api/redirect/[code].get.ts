import prisma from '~/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const code = getRouterParam(event, 'code')
    
    if (!code) {
      return {
        error: 'No short code provided',
        statusCode: 400
      }
    }

    // Find the short URL
    const shortUrl = await prisma.shortUrl.findUnique({
      where: { shortCode: code },
      include: { qrCode: true }
    })

    if (!shortUrl) {
      return {
        error: 'Short URL not found',
        statusCode: 404
      }
    }

    // Log analytics (track the scan)
    await prisma.analytics.create({
      data: {
        shortUrlId: shortUrl.id,
        qrCodeId: shortUrl.qrCode?.id,
        userAgent: getHeader(event, 'user-agent'),
        // Note: Getting real IP requires proper configuration
        ipAddress: getHeader(event, 'x-forwarded-for') || 'unknown',
      }
    })

    // Return the original URL for redirect
    return {
      url: shortUrl.originalUrl,
      statusCode: 200
    }

  } catch (error: any) {
    console.error('Redirect error:', error)
    return {
      error: error?.message || 'Redirect failed',
      statusCode: 500
    }
  }
})