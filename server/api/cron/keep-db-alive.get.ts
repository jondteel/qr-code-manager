import prisma from '~/server/utils/prisma'
import { createError, getHeader, setResponseHeader } from 'h3'
import { createKeepAliveHandler } from '~/server/utils/keepalive-handler.mjs'

export default defineEventHandler(createKeepAliveHandler({
  getSecret: () => process.env.CRON_SECRET,
  getAuthorization: (event) => getHeader(event, 'authorization'),
  getRequestId: (event) => getHeader(event, 'x-vercel-id'),
  getDeploymentId: () => process.env.VERCEL_DEPLOYMENT_ID,
  setResponseHeader: (event, name, value) => setResponseHeader(event, name, value),
  query: () => prisma.$queryRaw`SELECT 1`,
  createHttpError: (statusCode, statusMessage) => createError({ statusCode, statusMessage }),
}))
