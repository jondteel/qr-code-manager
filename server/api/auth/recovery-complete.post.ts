import { setResponseStatus } from 'h3'
import { accountWriteBody } from '~/server/utils/auth-boundary'
import { localRecovery } from '~/server/utils/recovery-local.mjs'
export default defineEventHandler(async event => {
  const body = await accountWriteBody(event)
  const service = await localRecovery()
  const result = service ? await service.complete(body) : { state: 'recovery-unavailable' }
  setResponseStatus(event, result.state === 'password-updated' ? 200 : ['recovery-unavailable','outcome-unknown'].includes(result.state) ? 503 : 400)
  return result
})
