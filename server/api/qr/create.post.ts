import prisma from '~/server/utils/prisma'
import { requireEmailAccount } from '~/server/utils/require-email-account'
import { createError, readBody } from 'h3'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { Prisma } from '@prisma/client'
import { validateTrackedDestination, validateDirectContent, assertQrCapacity } from '~/server/utils/qr-destination.mjs'
import { resolveQrIssuanceOrigin, issuedQrTarget, presentQr, serverQrStage } from '~/server/utils/qr-issuance.mjs'

const createQrSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v === '' ? null : v)),
    data: z.string(),
    size: z.coerce.number().min(128).max(1024).default(300),
    fgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
    bgColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#FFFFFF'),
    errorLevel: z.enum(['L', 'M', 'Q', 'H']).default('M'),
    createShortUrl: z.boolean(), // required: true = tracked HTTP(S), false = direct content
  })
  .strict()

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

    // Parse + validate body
    const body = await readBody(event)
    const validatedData = createQrSchema.parse(body)
    validatedData.data = validatedData.createShortUrl
      ? validateTrackedDestination(validatedData.data)
      : validateDirectContent(validatedData.data)
    const config = validatedData.createShortUrl ? useRuntimeConfig(event) : undefined
    const stage = serverQrStage(process.env)
    const origin = validatedData.createShortUrl
      ? resolveQrIssuanceOrigin(config, process.env.VERCEL_ENV, stage)
      : null
    if (!validatedData.createShortUrl) assertQrCapacity(validatedData.data, validatedData.errorLevel)

    // Retry a code collision only after the failed transaction has rolled back.
    // Never reuse a transaction after a PostgreSQL uniqueness violation.
    for (let attempt = 0; attempt < 10; attempt++) {
      const shortCode = validatedData.createShortUrl ? nanoid(8) : null
      const target = shortCode ? issuedQrTarget(origin!, shortCode) : null
      if (target) assertQrCapacity(target, validatedData.errorLevel)
      let insertingShortCode = false
      try {
        const qr = await prisma.$transaction(async (tx) => {
          const qrCode = await tx.qRCode.create({
            data: {
              title: validatedData.title, description: validatedData.description ?? null,
              data: validatedData.data, size: validatedData.size,
              fgColor: validatedData.fgColor, bgColor: validatedData.bgColor,
              errorLevel: validatedData.errorLevel, userId: user.sub,
              issuedEncodedTarget: null,
            },
            select: { id: true },
          })
          if (shortCode) {
            insertingShortCode = true
            const link = await tx.shortUrl.create({
              data: { shortCode, originalUrl: validatedData.data, userId: user.sub },
              select: { id: true },
            })
            insertingShortCode = false
            await tx.qRCode.update({
              where: { id: qrCode.id },
              data: { shortUrlId: link.id, issuedEncodedTarget: target },
            })
          }
          // Read what was actually persisted, including linkage and provenance.
          const persisted = await tx.qRCode.findUniqueOrThrow({
            where: { id: qrCode.id },
            select: {
              id: true, lifecycleStatus: true, title: true, description: true, data: true, size: true,
              fgColor: true, bgColor: true, errorLevel: true, shortUrlId: true,
              userId: true, issuedEncodedTarget: true, createdAt: true, updatedAt: true,
              shortUrl: { select: { id: true, shortCode: true, originalUrl: true, userId: true } },
            },
          })
          if (presentQr(persisted, user.sub, config, process.env.VERCEL_ENV, stage).payloadStatus !== 'available') {
            throw createError({ statusCode: 500, statusMessage: 'Failed to create QR code' })
          }
          return persisted
        })
        const qrCode = presentQr(qr, user.sub, config, process.env.VERCEL_ENV, stage)
        if (qrCode.payloadStatus !== 'available') {
          throw createError({ statusCode: 500, statusMessage: 'Failed to create QR code' })
        }
        return {
          success: true, mode: qrCode.mode, encodedTarget: qrCode.encodedTarget,
          payloadStatus: qrCode.payloadStatus, payloadProvenance: qrCode.payloadProvenance, payloadState: qrCode.payloadState,
          qrCode, shortUrl: qrCode.shortUrl,
        }
      } catch (error) {
        if (insertingShortCode && error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' && error.meta?.modelName === 'ShortUrl' &&
            Array.isArray(error.meta?.target) && error.meta.target.length === 1 && error.meta.target[0] === 'shortCode') {
          continue
        }
        throw error
      }
    }
    throw createError({ statusCode: 500, statusMessage: 'Failed to create QR code' })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Validation failed',
        data: { issues: error.issues },
      })
    }

    if (error?.statusCode) throw error

    console.error({ event: 'qr-create', outcome: 'failed', reason: 'unexpected-error' })

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create QR code',
    })
  }
})
