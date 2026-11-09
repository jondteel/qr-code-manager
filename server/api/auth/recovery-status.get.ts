import { localRecovery } from '~/server/utils/recovery-local.mjs'
export default defineEventHandler(async () => ({ enabled: !!await localRecovery() }))
