import prisma from '~/server/utils/prisma'
import { createError, getHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const cronSecret = config.cronSecret

  if (!cronSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Cron secret is not configured',
    })
  }

  const authorization = getHeader(event, 'authorization')

  if (authorization !== `Bearer ${cronSecret}`) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }

  await prisma.$queryRaw`SELECT 1`

  return {
    success: true,
    status: 'ok',
    checkedAt: new Date().toISOString(),
  }
})
