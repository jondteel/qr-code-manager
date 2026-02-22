import prisma from '~/server/utils/prisma'
import { serverSupabaseUser } from '#supabase/server'
import { createError, readBody } from 'h3'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { Prisma } from '@prisma/client'

const createQrSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v === '' ? null : v)),
    data: z.string().trim().min(1), // destination URL or any content
    size: z.coerce.number().min(128).max(1024).default(300),
    fgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
    bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
    errorLevel: z.enum(['L', 'M', 'Q', 'H']).default('M'),
    createShortUrl: z.boolean().default(false),
  })
  .strict()

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

    // Parse + validate body
    const body = await readBody(event)
    const validatedData = createQrSchema.parse(body)

    // Create QR (and optionally short URL) atomically
    const result = await prisma.$transaction(async (tx) => {
      const qrCode = await tx.qRCode.create({
        data: {
          title: validatedData.title,
          description: validatedData.description ?? null,
          data: validatedData.data,
          size: validatedData.size,
          fgColor: validatedData.fgColor,
          bgColor: validatedData.bgColor,
          errorLevel: validatedData.errorLevel,
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
          userId: true,
          shortUrlId: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      let shortUrl: {
        id: string
        shortCode: string
        originalUrl: string
      } | null = null

      if (validatedData.createShortUrl) {
        const createdShortUrl = await createShortUrlWithRetry(tx, {
          originalUrl: validatedData.data,
          userId: user.sub,
        })

        await tx.qRCode.update({
          where: { id: qrCode.id },
          data: { shortUrlId: createdShortUrl.id },
        })

        shortUrl = {
          id: createdShortUrl.id,
          shortCode: createdShortUrl.shortCode,
          originalUrl: createdShortUrl.originalUrl,
        }

        // reflect linkage in returned qr object without another query
        return {
          qrCode: { ...qrCode, shortUrlId: createdShortUrl.id },
          shortUrl,
        }
      }

      return {
        qrCode,
        shortUrl,
      }
    })

    return {
      success: true,
      qrCode: result.qrCode,
      shortUrl: result.shortUrl,
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

    console.error('QR creation error:', error)

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create QR code',
    })
  }
})

// Generates + inserts a unique short URL record with retry on collisions.
// This handles both "pre-check collision" and race-condition unique constraint collisions.
async function createShortUrlWithRetry(
  tx: Prisma.TransactionClient,
  params: { originalUrl: string; userId: string }
) {
  const maxAttempts = 10

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shortCode = nanoid(8)

    try {
      return await tx.shortUrl.create({
        data: {
          shortCode,
          originalUrl: params.originalUrl,
          userId: params.userId,
        },
        select: {
          id: true,
          shortCode: true,
          originalUrl: true,
        },
      })
    } catch (err: any) {
      // Prisma unique constraint violation (e.g., shortCode collision)
      if (err?.code === 'P2002') {
        continue
      }
      throw err
    }
  }

  throw new Error('Failed to generate unique short code after multiple attempts')
}