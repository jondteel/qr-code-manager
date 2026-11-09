import test from 'node:test'
import assert from 'node:assert/strict'
import { transitionQr } from '../server/utils/qr-lifecycle.mjs'
import { lifecycleTransition } from '../server/utils/qr-lifecycle-state.mjs'
import { storedQrPayload } from '../server/utils/qr-issuance.mjs'
import { redirectEligibility } from '../server/utils/qr-redirect.mjs'
import { savedQrTarget } from '../utils/qr-payload.mjs'
import { fixture, config, mockPrisma, handlerHarness } from './helpers/qr-edit-harness.mjs'
import { redirectFixture } from './helpers/qr-redirect-harness.mjs'
const options = { id:'qr', owner:'owner', config, stage:{nodeEnv:'test'} }
test('synthetic lifecycle transition matrix includes idempotency and terminal retirement', async t => {
  for (const from of ['active','archived','retired','unknown',undefined]) for (const to of ['active','archived','retired','unknown',undefined]) {
    await t.test(`${from} -> ${to}`, () => assert.equal(lifecycleTransition(from,to), ['active','archived'].includes(from) && ['active','archived','retired'].includes(to) || from === 'retired' && to === 'retired'))
  }
})
test('actual lifecycle utility changes only status and update time; repeats are no-ops', async t => {
  for (const [from,to] of [['active','archived'],['archived','active'],['active','retired'],['archived','retired']]) await t.test(`${from} -> ${to}`, async () => {
    const before=fixture({lifecycleStatus:from}), mock=mockPrisma(before)
    const result=await transitionQr(mock.prisma,{...options,status:to})
    assert.equal(result.lifecycleStatus,to)
    assert.deepEqual(mock.saved(),{...before,lifecycleStatus:to,updatedAt:'2026-10-17'})
    const n=mock.calls.filter(x=>x[0]==='qr').length
    await transitionQr(mock.prisma,{...options,status:to});assert.equal(mock.calls.filter(x=>x[0]==='qr').length,n)
    assert.equal(mock.calls.filter(x=>x[0]==='mapping').length,0)
  })
})
test('terminal, foreign and missing QR lifecycle requests preserve state', async () => {
  const mock=mockPrisma(fixture({lifecycleStatus:'retired'})),before=structuredClone(mock.saved())
  for(const status of ['active','archived']) await assert.rejects(transitionQr(mock.prisma,{...options,status}),{statusCode:409})
  await assert.rejects(transitionQr(mock.prisma,{...options,status:'bogus'}),{statusCode:400})
  await assert.rejects(transitionQr(mock.prisma,{...options,owner:'foreign',status:'retired'}),{statusCode:404})
  await assert.rejects(transitionQr(mock.prisma,{...options,id:'missing',status:'retired'}),{statusCode:404})
  assert.deepEqual(mock.saved(),before)
})
test('actual lifecycle PATCH authenticates, validates strict bodies and projects authoritative state',async()=>{
  const path='server/api/qr/[id]/lifecycle.patch.ts',mock=mockPrisma()
  for(const user of [null,{}]) {const h=await handlerHarness(mock.prisma,{path,user});await assert.rejects(h.invoke({status:'retired'}),{statusCode:401})}
  const h=await handlerHarness(mock.prisma,{path})
  for(const body of [{},{status:'delete'},{status:'active',data:'rewrite'},{status:'retired',issuedEncodedTarget:'rewrite'}]) await assert.rejects(h.invoke(body),{statusCode:400})
  assert.equal((await h.invoke({status:'archived'})).qrCode.lifecycleStatus,'archived')
  const conflict=await handlerHarness(mockPrisma(fixture(),{fail:'conflict'}).prisma,{path})
  await assert.rejects(conflict.invoke({status:'retired'}),{statusCode:409})
})
test('actual DELETE rejects owned, foreign, missing and unauthenticated without any write',async()=>{
  const path='server/api/qr/[id].delete.ts'
  let writes=0
  const prisma={qRCode:{findFirst:async({where})=>where.id==='qr'&&where.userId==='owner'?{id:'qr'}:null,delete:()=>writes++},$transaction:()=>writes++}
  for(const [user,id,status] of [[null,'qr',401],[{sub:'owner'},'qr',409],[{sub:'foreign'},'qr',404],[{sub:'owner'},'missing',404]]) {
    const h=await handlerHarness(prisma,{path,user,id});await assert.rejects(h.invoke(),{statusCode:status})
  }
  assert.equal(writes,0)
})
test('retired edits fail and archived tracked/direct exports retain authority',async()=>{
  const h=await handlerHarness(mockPrisma(fixture({lifecycleStatus:'retired'})).prisma)
  await assert.rejects(h.invoke({title:'New title'}),{statusCode:409})
  for(const status of ['active','archived','retired',undefined,'unknown']) {
    const row=fixture({lifecycleStatus:status}),decision=storedQrPayload(row,'owner',config,undefined,{nodeEnv:'test'})
    assert.equal(decision.payloadStatus==='available',['active','archived'].includes(status))
    const direct=storedQrPayload({...row,shortUrlId:null,shortUrl:null,issuedEncodedTarget:null,data:' exact\n '},'owner',config,undefined,{nodeEnv:'test'})
    assert.equal(direct.encodedTarget,['active','archived'].includes(status)?' exact\n ':null)
    const link=redirectFixture();link.qrCode.lifecycleStatus=status
    assert.equal(redirectEligibility(link,link.shortCode).available,['active','archived'].includes(status))
  }
  assert.equal(savedQrTarget({lifecycleStatus:'retired',encodedTarget:'stale',payloadStatus:'available',payloadState:'exact-issued'}),null)
})

test('analytics overview preserves historical metric meaning while labeling retired rows',async()=>{
  const topQRCodes=[{id:'qr',title:'Retired fictional QR',data:'direct',lifecycleStatus:'retired',scanCount:1}]
  const h=await handlerHarness({$queryRaw:async()=>[{topQRCodes,totalScans:1n,previousScans:0n,activeQRCodes:1n,buckets:[]}]},{path:'server/api/analytics/overview.get.ts'})
  const r=await h.invoke();assert.equal(r.topQRCodes[0].lifecycleStatus,'retired');assert.equal(r.topQRCodes[0].scanCount,1);assert.equal(r.stats.totalScans,1);assert.equal(r.stats.activeQRCodes,1)
})
