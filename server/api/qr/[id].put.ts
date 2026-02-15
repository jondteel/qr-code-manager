import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'
import { z } from 'zod'

const updateQrSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  data: z.string().min(1).optional(),
  size: z.number().min(128).max(1024).optional(),
  fgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  errorLevel: z.enum(['L', 'M', 'Q', 'H']).optional(),
})

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

    // Check if QR code exists and belongs to user
    const existingQR = await prisma.qRCode.findUnique({
      where: { id }
    })

    if (!existingQR) {
      return {
        error: 'QR code not found',
        statusCode: 404
      }
    }

    if (existingQR.userId !== user.sub) {
      return {
        error: 'Unauthorized to edit this QR code',
        statusCode: 403
      }
    }

    // Parse and validate request body
    const body = await readBody(event)
    const validatedData = updateQrSchema.parse(body)

    // Update QR code
    const updatedQR = await prisma.qRCode.update({
      where: { id },
      data: validatedData
    })

    return {
      success: true,
      qrCode: updatedQR,
      statusCode: 200
    }

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return {
        error: 'Validation failed',
        details: error.issues,
        statusCode: 400
      }
    }

    console.error('Update QR code error:', error)
    return {
      error: error?.message || 'Failed to update QR code',
      statusCode: 500
    }
  }
})