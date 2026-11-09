// Server-only Prisma repository. No provider client, mutation callback or routes.
import { bound, check, mint, opaque, parse, recipientId } from './recovery-crypto.mjs'
const txOptions = { maxWait: 10000, timeout: 10000, isolationLevel: 'ReadCommitted' }
const clock = async tx => Number((await tx.$queryRaw`SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint AS ms`)[0].ms)
const row = r => r && ({ ...r, issuedAtMs: Number(r.issuedAtMs), expiresAtMs: Number(r.expiresAtMs) })
export function recoveryLedger(db, c) {
  // The client must have query/error event logging disabled. Errors never escape.
  async function transaction(fn) { try { return await db.$transaction(fn, txOptions) } catch { return null } }
  async function budget(tx, scope, key, now, limit) {
    const window = BigInt(Math.floor(now / 3600000) * 3600000)
    const records = await tx.$queryRaw`
      INSERT INTO public."RecoveryBudget" (environment, project, scope, key, "windowMs", attempts)
      VALUES (${c.environment}, ${c.project}, ${scope}, ${key}, ${window}, 1)
      ON CONFLICT (environment, project, scope, key) DO UPDATE SET
        attempts = CASE WHEN "RecoveryBudget"."windowMs" = EXCLUDED."windowMs" THEN LEAST("RecoveryBudget".attempts + 1, 100001) ELSE 1 END,
        "windowMs" = EXCLUDED."windowMs" RETURNING attempts`
    return records[0].attempts <= limit
  }
  async function reservation(tx, id) {
    return (await tx.$queryRaw`SELECT * FROM public."RecoveryAdmission" WHERE environment=${c.environment} AND project=${c.project} AND "recipientId"=${id} FOR UPDATE`)[0]
  }
  async function subject(tx, id) {
    return row((await tx.$queryRaw`SELECT * FROM public."RecoverySubject" WHERE environment=${c.environment} AND project=${c.project} AND subject=${id} FOR UPDATE`)[0])
  }
  return Object.freeze({
    async reserve(recipient) {
      let id
      try { id = recipientId(c, recipient) } catch { return null }
      return transaction(async tx => {
        const now = await clock(tx)
        if (!await budget(tx, 'issue-global', '-', now, 1000) || !await budget(tx, 'issue-recipient', id, now, 5)) return null
        await tx.$executeRaw`INSERT INTO public."RecoveryAdmission" (environment, project, "recipientId", state) VALUES (${c.environment},${c.project},${id},'ready') ON CONFLICT DO NOTHING`
        const a = await reservation(tx, id)
        if (a.state !== 'ready') return null
        // Never automatically replace a processing/uncertain operation, even after expiry.
        if (a.subject) {
          const g = await subject(tx, a.subject)
          if (g && ['processing', 'outcome_unknown', 'issuing'].includes(g.state)) return null
        }
        const operationId = opaque()
        if (a.subject) await tx.$executeRaw`UPDATE public."RecoverySubject" SET state='issuing', "operationId"=${operationId} WHERE environment=${c.environment} AND project=${c.project} AND subject=${a.subject}`
        await tx.$executeRaw`UPDATE public."RecoveryAdmission" SET state='issuing', "operationId"=${operationId}, "issuedAtMs"=${BigInt(now)} WHERE environment=${c.environment} AND project=${c.project} AND "recipientId"=${id}`
        return { recipientId: id, operationId, issuedAtMs: now }
      })
    },
    async publish(reserved, recipient, provider) {
      // Only trusted server issuers call this method; no browser input/API.
      return transaction(async tx => {
        check(recipientId(c, recipient) === reserved.recipientId)
        const a = await reservation(tx, reserved.recipientId)
        check(a?.state === 'issuing' && a.operationId === reserved.operationId && Number(a.issuedAtMs) === reserved.issuedAtMs)
        const lifetimeMs = provider.lifetimeMs ?? 600000
        check(Number.isSafeInteger(lifetimeMs) && lifetimeMs > 0 && lifetimeMs <= 600000)
        const now = await clock(tx), expiresAtMs = reserved.issuedAtMs + Math.min(600000, lifetimeMs)
        check(now >= reserved.issuedAtMs && now < expiresAtMs)
        // A placeholder serializes first publication across different recipients.
        await tx.$executeRaw`INSERT INTO public."RecoverySubject" (environment, project, subject, generation, state) VALUES (${c.environment},${c.project},${provider.subject},0,'empty') ON CONFLICT DO NOTHING`
        const prior = await subject(tx, provider.subject)
        check(!['processing','outcome_unknown'].includes(prior.state))
        check(prior.state !== 'issuing' || prior.operationId === reserved.operationId)
        const grant = mint(c, { subject: provider.subject, recipient, proof: provider.proof,
          generation: prior.generation + 1, issuedAtMs: reserved.issuedAtMs, expiresAtMs })
        const g = grant.record
        await tx.$executeRaw`UPDATE public."RecoverySubject" SET generation=${g.generation}, state='pending', version=${g.version}, purpose=${g.purpose}, selector=${g.selector}, email=${g.email}, "recipientId"=${g.recipientId}, "keyId"=${g.keyId}, "secretDigest"=${g.secretDigest}, "proofMac"=${g.proofMac}, "issuedAtMs"=${BigInt(g.issuedAtMs)}, "expiresAtMs"=${BigInt(g.expiresAtMs)}, "operationId"=NULL, "terminalAtMs"=NULL WHERE environment=${c.environment} AND project=${c.project} AND subject=${g.subject}`
        await tx.$executeRaw`UPDATE public."RecoveryAdmission" SET subject=${g.subject} WHERE environment=${c.environment} AND project=${c.project} AND "recipientId"=${reserved.recipientId}`
        return grant
      })
    },
    async delivered(reserved) {
      return transaction(async tx => {
        const a = await reservation(tx, reserved.recipientId)
        check(a?.state === 'issuing' && a.operationId === reserved.operationId)
        await tx.$executeRaw`UPDATE public."RecoveryAdmission" SET state='ready', "operationId"=NULL WHERE environment=${c.environment} AND project=${c.project} AND "recipientId"=${reserved.recipientId}`
        return true
      })
    },
    async abandon(reserved) {
      // Uncertain generation/publication/delivery fences recipient AND known subject.
      return transaction(async tx => {
        const a = await reservation(tx, reserved.recipientId)
        check(a?.state === 'issuing' && a.operationId === reserved.operationId)
        if (a.subject) {
          const g = await subject(tx, a.subject)
          if (g && !['processing','outcome_unknown'].includes(g.state)) await tx.$executeRaw`UPDATE public."RecoverySubject" SET state='outcome_unknown', "operationId"=${reserved.operationId} WHERE environment=${c.environment} AND project=${c.project} AND subject=${a.subject}`
        }
        await tx.$executeRaw`UPDATE public."RecoveryAdmission" SET state='outcome_unknown' WHERE environment=${c.environment} AND project=${c.project} AND "recipientId"=${reserved.recipientId}`
        return true
      })
    },
    async claim(capability) {
      let p
      try { p = parse(capability) } catch { return null }
      return transaction(async tx => {
        const now = await clock(tx)
        if (!await budget(tx, 'claim-global', '-', now, 10000) || !await budget(tx, 'claim-selector', p.selector, now, 20)) return null
        const found = (await tx.$queryRaw`SELECT subject, "recipientId" FROM public."RecoverySubject" WHERE environment=${c.environment} AND project=${c.project} AND selector=${p.selector}`)[0]
        if (!found) return null
        // Lock ordering: budgets, recipient, subject. Recheck after locking.
        const a = await reservation(tx, found.recipientId)
        if (a?.state !== 'ready') return null
        const g = await subject(tx, found.subject)
        if (!g || g.state !== 'pending' || g.recipientId !== found.recipientId || !bound(c, g, capability, await clock(tx))) return null
        const operationId = opaque()
        const count = await tx.$executeRaw`UPDATE public."RecoverySubject" SET state='processing', "operationId"=${operationId} WHERE environment=${c.environment} AND project=${c.project} AND subject=${g.subject} AND state='pending' AND generation=${g.generation} AND selector=${g.selector}`
        check(count === 1)
        // This is ledger claim evidence ONLY. Provider dispatch requires this acknowledged result.
        return { subject: g.subject, email: g.email, selector: g.selector, generation: g.generation, operationId }
      })
    },
    async settle(claim, outcome) {
      if (!['consumed','refused','outcome_unknown'].includes(outcome)) return null
      return transaction(async tx => {
        const now = await clock(tx)
        const count = await tx.$executeRaw`UPDATE public."RecoverySubject" SET state=${outcome}, "terminalAtMs"=${BigInt(now)} WHERE environment=${c.environment} AND project=${c.project} AND subject=${claim.subject} AND selector=${claim.selector} AND generation=${claim.generation} AND "operationId"=${claim.operationId} AND state='processing'`
        return count === 1
      })
    },
  })
}
