import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { config, opaque, parse } from '../server/utils/recovery-crypto.mjs'
import { recoveryLedger } from '../server/utils/recovery-ledger.mjs'
import { fixtureIssuer, fictionalMailSink } from '../server/utils/recovery-fixture-issuer.mjs'
// Hard refusal against arbitrary DATABASE_URL, including any existing localhost DB.
const url=process.env.RECOVERY_TEST_DATABASE_URL
assert.equal(url,'postgresql://c12_owner@127.0.0.1:59513/c12_01a19a2c?connection_limit=1')
const dataDir=process.env.RECOVERY_TEST_PG_DATA_DIR?.replaceAll('\\', '/')
assert.ok(dataDir?.endsWith('/01a19a2c-af12-7360-84e1-df95fda70bea/pg17-c12'))
const clients=Array.from({length:8},()=>new PrismaClient({datasources:{db:{url}},log:[]}))
const db=clients[0], key=randomBytes(32), recipientKey=randomBytes(32)
const settings={environment:'isolated-fixture',project:'pg17-fictional',activeKeyId:'k1',keys:new Map([['k1',key]]),recipientKey}
const c=config(settings), repositories=clients.map(client=>recoveryLedger(client,c))
const ledger=repositories[0]
const recipient=()=>`fixture-${randomUUID()}@example.test`
const response=(mail,sub=randomUUID(),proof=randomBytes(28).toString('hex'))=>({data:{user:{id:sub,email:mail,email_confirmed_at:'2026-10-19',is_anonymous:false,is_sso_user:false,factors:[],app_metadata:{provider:'email',providers:['email']}},properties:{verification_type:'recovery',hashed_token:proof}},error:null})
async function issued({mail=recipient(),sub=randomUUID(),repo=ledger}={}) {
  const sink=fictionalMailSink(), r=response(mail,sub)
  const issue=fixtureIssuer({ledger:repo,generateFixture:async()=>r,sink})
  assert.deepEqual(await issue(mail),{state:'fixture-delivered'})
  return {mail,sub,cap:sink.take()[0].capability,response:r}
}
async function state(sub) { return (await db.$queryRaw`SELECT * FROM public."RecoverySubject" WHERE subject=${sub}`)[0] }
function lostAck(client, nth) {
  let n=0
  return {$transaction:async(fn,options)=>{ const value=await client.$transaction(fn,options);if(++n===nth)throw Error('canary-sensitive-ack');return value }}
}
// Abort the entire suite before fixture writes if any target identity differs.
try {
  const identity=(await db.$queryRaw`SELECT current_setting('data_directory') AS dir, current_setting('server_version_num') AS version, current_database() AS name, current_user AS owner, system_identifier::text AS id FROM pg_control_system()`)[0]
  assert.equal(identity.dir.replaceAll('\\','/'),dataDir)
  assert.equal(identity.name,'c12_01a19a2c');assert.equal(identity.owner,'c12_owner')
  assert.ok(Number(identity.version)>=170000 && Number(identity.version)<180000)
  assert.match(process.env.RECOVERY_TEST_PG_ID || '',/^[0-9]+$/)
  assert.equal(identity.id,process.env.RECOVERY_TEST_PG_ID)
} catch(error) { await Promise.all(clients.map(client=>client.$disconnect()));throw error }

test('real PG17 ledger and independent connection adversarial validation',async t=>{
  try {
    await t.test('identity, empty-core boundary and eight independent backend connections',async()=>{
      const identity=(await db.$queryRaw`SELECT current_setting('data_directory') AS dir, current_setting('server_version_num') AS version, current_database() AS name`)[0]
      assert.match(identity.dir,/01a19a2c-af12-7360-84e1-df95fda70bea\/pg17-c12$/)
      assert.ok(Number(identity.version)>=170000 && Number(identity.version)<180000)
      assert.equal(identity.name,'c12_01a19a2c')
      const control=(await db.$queryRaw`SELECT system_identifier::text AS id FROM pg_control_system()`)[0]
      assert.equal(control.id,process.env.RECOVERY_TEST_PG_ID)
      assert.equal((await db.$queryRaw`SELECT to_regclass('public."User"')::text AS core`)[0].core,null)
      const pids=await Promise.all(clients.map(client=>client.$queryRaw`SELECT pg_backend_pid() AS pid`))
      assert.equal(new Set(pids.map(x=>x[0].pid)).size,8)
    })
    await t.test('RLS and denied direct anon/authenticated access on all three tables',async()=>{
      const rows=await db.$queryRaw`SELECT c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'SELECT') AS anon_read,has_table_privilege('authenticated',c.oid,'SELECT') AS auth_read FROM pg_class c JOIN pg_namespace n ON c.relnamespace=n.oid WHERE n.nspname='public' AND c.relname IN ('RecoverySubject','RecoveryAdmission','RecoveryBudget')`
      assert.equal(rows.length,3)
      for(const r of rows){assert.equal(r.relrowsecurity,true);assert.equal(r.anon_read,false);assert.equal(r.auth_read,false)}
      for(const role of ['anon','authenticated']) await assert.rejects(db.$transaction(async tx=>{
        if(role==='anon') await tx.$executeRaw`SET LOCAL ROLE anon`
        else await tx.$executeRaw`SET LOCAL ROLE authenticated`
        await tx.$queryRaw`SELECT * FROM public."RecoverySubject"`
      }))
    })
    await t.test('eight-instance same-grant claim race yields exactly one winner',async()=>{
      const f=await issued(), results=await Promise.all(repositories.map(repo=>repo.claim(f.cap)))
      assert.equal(results.filter(Boolean).length,1)
      const won=results.find(Boolean)
      assert.equal((await state(f.sub)).state,'processing')
      assert.equal(await ledger.claim(f.cap),null)
      assert.equal(await ledger.settle({...won,operationId:opaque()},'consumed'),false)
      assert.equal(await ledger.settle(won,'consumed'),true)
      assert.equal(await ledger.claim(f.cap),null)
      assert.equal(await ledger.settle(won,'consumed'),false)
    })
    await t.test('eight-instance issuance reservation race admits one generator',async()=>{
      const mail=recipient(), sink=fictionalMailSink();let generated=0
      // Hold the issuing interval open until all replicas have tried admission.
      const reservations=await Promise.all(repositories.map(repo=>repo.reserve(mail)))
      assert.equal(reservations.filter(Boolean).length,1)
      const result=await fixtureIssuer({ledger:{...ledger,reserve:async()=>reservations.find(Boolean)},sink,generateFixture:async()=>{generated++;return response(mail)}})(mail)
      assert.equal(generated,1);assert.equal(result.state,'fixture-delivered');assert.equal(sink.take().length,1)
    })
    await t.test('wrong proof/secret rejected without consuming valid pending grant',async()=>{
      const f=await issued(), p=parse(f.cap)
      assert.equal(await ledger.claim(`r1.${p.selector}.${opaque()}.${p.proof}`),null)
      assert.equal(await ledger.claim(`r1.${p.selector}.${p.secret}.${'b'.repeat(56)}`),null)
      assert.equal(await ledger.claim(p.proof),null)
      assert.equal((await state(f.sub)).state,'pending')
      assert.ok(await ledger.claim(f.cap))
      const stored=JSON.stringify(await state(f.sub),(_,v)=>typeof v==='bigint'?v.toString():v)
      assert.equal(stored.includes(p.secret),false);assert.equal(stored.includes(p.proof),false)
    })
    await t.test('supersession invalidates selector/generation before claim',async()=>{
      const f=await issued(), next=await issued({mail:f.mail,sub:f.sub})
      assert.equal((await state(f.sub)).generation,2)
      assert.equal(await ledger.claim(f.cap),null);assert.ok(await ledger.claim(next.cap))
    })
    await t.test('claim versus replacement race cannot grant both old claim and replacement',async()=>{
      const f=await issued()
      const [claim,reserved]=await Promise.all([repositories[0].claim(f.cap),repositories[1].reserve(f.mail)])
      assert.equal(Number(!!claim)+Number(!!reserved),1)
      if(reserved) {assert.equal(await ledger.claim(f.cap),null);await ledger.abandon(reserved)}
      else assert.equal(await ledger.reserve(f.mail),null)
    })
    await t.test('known processing subject blocks new issuance across restart and new replica',async()=>{
      const f=await issued(), claim=await ledger.claim(f.cap)
      assert.ok(claim)
      const restarted=recoveryLedger(clients[7],c)
      assert.equal(await restarted.reserve(f.mail),null)
      assert.equal(await restarted.claim(f.cap),null)
      assert.equal(await restarted.settle(claim,'outcome_unknown'),true)
      assert.equal(await ledger.reserve(f.mail),null)
      assert.equal(await ledger.claim(f.cap),null)
      assert.equal(await ledger.settle(claim,'consumed'),false)
    })
    await t.test('worker exits after committed claim; a fresh process cannot take over',async()=>{
      const f=await issued()
      const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SystemRoot|WINDIR|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|COMSPEC|PATHEXT)$/i.test(k)))
      const payload={url,dataDir,systemId:process.env.RECOVERY_TEST_PG_ID,capability:f.cap,recipient:f.mail,key:key.toString('base64'),recipientKey:recipientKey.toString('base64')}
      const run=()=>{
        const r=spawnSync(process.execPath,[fileURLToPath(new URL('./helpers/recovery-worker.mjs',import.meta.url))],{input:JSON.stringify(payload),encoding:'utf8',env,timeout:20000})
        assert.equal(r.status,0);assert.equal(r.stderr,'');return JSON.parse(r.stdout)
      }
      assert.deepEqual(run(),{claimed:true,reserved:false})
      assert.deepEqual(run(),{claimed:false,reserved:false})
      assert.equal((await state(f.sub)).state,'processing')
    })
    await t.test('four independent worker processes concurrently claim one grant exactly once',async()=>{
      const f=await issued()
      const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SystemRoot|WINDIR|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|COMSPEC|PATHEXT)$/i.test(k)))
      const payload=JSON.stringify({url,dataDir,systemId:process.env.RECOVERY_TEST_PG_ID,capability:f.cap,recipient:f.mail,key:key.toString('base64'),recipientKey:recipientKey.toString('base64')})
      const workers=Array.from({length:4},()=>{
        const child=spawn(process.execPath,[fileURLToPath(new URL('./helpers/recovery-worker.mjs',import.meta.url))],{env,stdio:['pipe','pipe','pipe'],windowsHide:true})
        const result=new Promise((resolve,reject)=>{
          let output='',error=''
          const timer=setTimeout(()=>{child.kill();reject(Error('worker timeout'))},20000)
          child.stdout.on('data',chunk=>{output+=chunk});child.stderr.on('data',chunk=>{error+=chunk})
          child.on('error',err=>{clearTimeout(timer);reject(err)})
          child.on('close',code=>{clearTimeout(timer);try{assert.equal(code,0);assert.equal(error,'');resolve(JSON.parse(output))}catch(err){reject(err)}})
        })
        return {child,result}
      })
      for(const worker of workers)worker.child.stdin.end(payload)
      const results=await Promise.all(workers.map(worker=>worker.result))
      assert.equal(results.filter(result=>result.claimed).length,1)
      assert.equal(results.some(result=>result.reserved),false)
      assert.equal(await ledger.claim(f.cap),null)
    })
    await t.test('unknown recipient alias cannot publish over processing canonical subject',async()=>{
      const f=await issued();assert.ok(await ledger.claim(f.cap))
      const mail=recipient(), sink=fictionalMailSink()
      const issue=fixtureIssuer({ledger,sink,generateFixture:async()=>response(mail,f.sub)})
      assert.equal((await issue(mail)).state,'unavailable');assert.equal(sink.take().length,0)
      assert.equal((await state(f.sub)).state,'processing')
    })
    await t.test('lost reservation acknowledgment never calls provider/sink',async()=>{
      let calls=0;const sink=fictionalMailSink(),mail=recipient()
      const issue=fixtureIssuer({ledger:recoveryLedger(lostAck(db,1),c),sink,generateFixture:async()=>{calls++;return response(mail)}})
      assert.equal((await issue(mail)).state,'unavailable');assert.equal(calls,0);assert.equal(sink.take().length,0)
      assert.equal(await ledger.reserve(mail),null)
    })
    await t.test('lost publication acknowledgment never delivers and remains fenced',async()=>{
      const sink=fictionalMailSink(),mail=recipient(),r=response(mail)
      const issue=fixtureIssuer({ledger:recoveryLedger(lostAck(db,2),c),sink,generateFixture:async()=>r})
      assert.equal((await issue(mail)).state,'unavailable');assert.equal(sink.take().length,0)
      assert.equal((await state(r.data.user.id)).state,'outcome_unknown');assert.equal(await ledger.reserve(mail),null)
    })
    await t.test('lost claim acknowledgment burns authority without handing claim to caller',async()=>{
      const f=await issued(),uncertain=recoveryLedger(lostAck(db,1),c)
      assert.equal(await uncertain.claim(f.cap),null)
      assert.equal((await state(f.sub)).state,'processing')
      assert.equal(await ledger.claim(f.cap),null);assert.equal(await ledger.reserve(f.mail),null)
    })
    await t.test('lost settlement acknowledgment cannot reopen or authorize a second action',async()=>{
      const f=await issued(),claim=await ledger.claim(f.cap)
      assert.equal(await recoveryLedger(lostAck(db,1),c).settle(claim,'consumed'),null)
      assert.equal((await state(f.sub)).state,'consumed');assert.equal(await ledger.claim(f.cap),null)
    })
    await t.test('database read/write failures are sanitized and fail closed',async()=>{
      const f=await issued()
      for(const method of ['$queryRaw','$executeRaw']) {
        const failing={$transaction:(fn,options)=>db.$transaction(tx=>fn(new Proxy(tx,{get(target,key){if(key===method)return()=>{throw Error('sensitive-canary')};const v=Reflect.get(target,key);return typeof v==='function'?v.bind(target):v}})),options)}
        assert.equal(await recoveryLedger(failing,c).claim(f.cap),null)
        assert.equal((await state(f.sub)).state,'pending')
      }
    })
    await t.test('provider generation failure fences recipient without delivery',async()=>{
      const mail=recipient(),sink=fictionalMailSink()
      const issue=fixtureIssuer({ledger,sink,generateFixture:async()=>{throw Error('sensitive-canary')}})
      assert.equal((await issue(mail)).state,'unavailable');assert.equal(sink.take().length,0);assert.equal(await ledger.reserve(mail),null)
    })
    await t.test('late provider result after abandoned reservation cannot publish/deliver',async()=>{
      const mail=recipient(),reserved=await ledger.reserve(mail)
      assert.ok(reserved);assert.equal(await ledger.abandon(reserved),true)
      assert.equal(await ledger.publish(reserved,mail,{subject:randomUUID(),proof:randomBytes(28).toString('hex')}),null)
      assert.equal(await ledger.reserve(mail),null)
    })
    await t.test('late publication beyond database-clock issuance lifetime is refused',async()=>{
      const mail=recipient(),reserved=await ledger.reserve(mail)
      reserved.issuedAtMs-=600001
      await db.$executeRaw`UPDATE public."RecoveryAdmission" SET "issuedAtMs"=${BigInt(reserved.issuedAtMs)} WHERE "operationId"=${reserved.operationId}`
      assert.equal(await ledger.publish(reserved,mail,{subject:randomUUID(),proof:randomBytes(28).toString('hex')}),null)
      assert.equal(await ledger.reserve(mail),null)
    })
    await t.test('wrong subject, expiry, environment and project fail closed at DB boundary',async()=>{
      const f=await issued()
      assert.equal(await recoveryLedger(db,config({...settings,project:'other'})).claim(f.cap),null)
      assert.equal(await recoveryLedger(db,config({...settings,environment:'other'})).claim(f.cap),null)
      await db.$executeRaw`UPDATE public."RecoverySubject" SET subject=${randomUUID()} WHERE subject=${f.sub}`
      assert.equal(await ledger.claim(f.cap),null)
      const g=await issued()
      await db.$executeRaw`UPDATE public."RecoverySubject" SET "issuedAtMs"="issuedAtMs"-600001,"expiresAtMs"="expiresAtMs"-600001 WHERE subject=${g.sub}`
      assert.equal(await ledger.claim(g.cap),null)
    })
    await t.test('rotation accepts retained key and rejects unknown retired key',async()=>{
      const f=await issued(),next=randomBytes(32)
      const unknown=recoveryLedger(db,config({...settings,activeKeyId:'k2',keys:new Map([['k2',next]])}))
      assert.equal(await unknown.claim(f.cap),null)
      const rotated=recoveryLedger(db,config({...settings,activeKeyId:'k2',keys:new Map([['k1',key],['k2',next]])}))
      assert.ok(await rotated.claim(f.cap))
    })
    await t.test('shared selector attempt budget survives replica change without burning pending state',async()=>{
      const f=await issued(),p=parse(f.cap)
      for(let i=0;i<21;i++) assert.equal(await repositories[i%8].claim(`r1.${p.selector}.${opaque()}.${p.proof}`),null)
      assert.equal(await repositories[7].claim(f.cap),null)
      assert.equal((await state(f.sub)).state,'pending')
    })
    await t.test('authoritative provider TTL is capped at reservation and late publication refused',async()=>{
      const mail=recipient(),reserved=await ledger.reserve(mail),sub=randomUUID()
      const grant=await ledger.publish(reserved,mail,{subject:sub,proof:randomBytes(28).toString('hex'),lifetimeMs:60000})
      assert.ok(grant);assert.equal(grant.record.expiresAtMs-grant.record.issuedAtMs,60000)
      const lateMail=recipient(),late=await ledger.reserve(lateMail)
      late.issuedAtMs-=60001
      await db.$executeRaw`UPDATE public."RecoveryAdmission" SET "issuedAtMs"=${BigInt(late.issuedAtMs)} WHERE "operationId"=${late.operationId}`
      assert.equal(await ledger.publish(late,lateMail,{subject:randomUUID(),proof:randomBytes(28).toString('hex'),lifetimeMs:60000}),null)
    })
    await t.test('no real Auth/User/QR tables created or modified in disposable database',async()=>{
      const rows=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`
      assert.deepEqual(rows.map(x=>x.tablename),['RecoveryAdmission','RecoveryBudget','RecoverySubject'])
    })
  } finally { await Promise.all(clients.map(client=>client.$disconnect())) }
})
