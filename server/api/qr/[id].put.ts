import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'
import { createError, getRouterParam, readBody } from 'h3'
import { z } from 'zod'

const updateQrSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    description: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v === '' ? null : v)),
    data: z.string().trim().min(1).optional(),
    size: z.coerce.number().min(128).max(1024).optional(),
    fgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    errorLevel: z.enum(['L', 'M', 'Q', 'H']).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  })

export default defineEventHandler(async (event) => {
  try {
    // Auth
    const user = await serverSupabaseUser(event)
    if (!user?.sub) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    // Route param
    const id = getRouterParam(event, 'id')
    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'QR code ID is required' })
    }

    // Validate body
    const body = await readBody(event)
    const validatedData = updateQrSchema.parse(body)

    // Check ownership (minimal select)
    const existingQR = await prisma.qRCode.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!existingQR) {
      throw createError({ statusCode: 404, statusMessage: 'QR code not found' })
    }

    if (existingQR.userId !== user.sub) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }

    // Update QR
    const updatedQR = await prisma.qRCode.update({
      where: { id },
      data: validatedData,
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
        shortUrlId: true,
        userId: true,
      },
    })

    return {
      success: true,
      qrCode: updatedQR,
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: { issues: error.issues },
      })
    }

    if (error?.statusCode) throw error

    console.error('Update QR code error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update QR code',
    })
  }
})