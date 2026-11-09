import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, handlerHarness, mockPrisma } from './helpers/qr-edit-harness.mjs'
import { isQrEditConflict } from '../server/utils/qr-edit.mjs'
const destination = 'https://New.example.invalid:443/a%2Fb?Q=Exact#Frag'
async function setup(row, options, auth) {
  const m = mockPrisma(row, options); return { ...m, ...await handlerHarness(m.prisma, auth) }
}
test('synthetic tracked PUT synchronizes exact spelling and preserves identities/provenance/history', async () => {
  const h = await setup(); const before = structuredClone(h.saved()); const response = await h.invoke({ data: destination })
  assert.equal(h.saved().data, destination); assert.equal(h.saved().shortUrl.originalUrl, destination)
  for (const key of ['id','userId','shortUrlId','issuedEncodedTarget','createdAt','analytics']) assert.deepEqual(h.saved()[key], before[key])
  for (const key of ['id','userId','shortCode']) assert.equal(h.saved().shortUrl[key], before.shortUrl[key])
  assert.equal(response.qrCode.encodedTarget, before.issuedEncodedTarget)
  assert.equal(response.qrCode.shortUrl.qrCode, undefined); assert.equal(response.qrCode.userId, undefined)
  assert.equal(h.saved().description, 'Notes'); assert.equal(h.calls.filter(c => c[0] === 'transaction').length, 1)
  assert.deepEqual(h.calls[0][1], { isolationLevel: 'RepeatableRead', maxWait: 3000, timeout: 8000 })
})
test('synthetic invalid destinations never commit', async t => {
  for (const value of ['', 'javascript:alert(1)','data:text/plain,x','file:///a','/relative','https://u:p@x.invalid','https://x.invalid/\n','https:\\x.invalid','https://x.invalid/\ud800','https://x.invalid/'+ 'é'.repeat(1020),'https://x.invalid/a b','https:///missing']) {
    await t.test(JSON.stringify(value).slice(0,70), async () => { const h = await setup(); const before = h.saved(); await assert.rejects(h.invoke({ data: value }), { statusCode: 400 }); assert.deepEqual(h.saved(), before) })
  }
})
test('synthetic ownership and corrupt linkage fail closed', async t => {
  const base = fixture()
  const rows = [null, fixture({ userId:'foreign' }), fixture({ shortUrl:null }), fixture({ shortUrlId:null }),
    fixture({ shortUrl:{...base.shortUrl,userId:'foreign'} }), fixture({ shortUrl:{...base.shortUrl,id:'wrong'} }),
    fixture({ shortUrl:{...base.shortUrl,qrCode:null} }), fixture({ shortUrl:{...base.shortUrl,qrCode:{ id:'other' }} }),
    fixture({ shortUrl:{...base.shortUrl,originalUrl:'https://mismatch.invalid'} }),
    fixture({ shortUrl:{...base.shortUrl,shortCode:'a/b'} }), fixture({ issuedEncodedTarget:'https://issuer.example.invalid/s/other' })]
  for (const [index,row] of rows.entries()) await t.test(String(index), async () => { const h = await setup(row); await assert.rejects(h.invoke({data:destination}), {statusCode: index < 2 ? 404 : 409}); assert.deepEqual(h.saved(),row) })
  const missingProfile = await setup(base,{ profile:false }); await assert.rejects(missingProfile.invoke({data:destination}),{statusCode:404})
  const unauth = await setup(base,{}, {user:null}); await assert.rejects(unauth.invoke({data:destination}),{statusCode:401}); assert.equal(unauth.calls.length,0)
})
test('synthetic transaction failures roll back; errors generic and conflict bounded', async t => {
  for (const fail of ['qr','mapping','final','conflict']) await t.test(fail,async () => { const h=await setup(fixture(),{fail}); const before=h.saved(); const error=await h.invoke({data:destination}).catch(e=>e); assert.equal(error.statusCode,['final','conflict'].includes(fail)?409:500); assert.doesNotMatch(error.statusMessage,/private/); assert.deepEqual(h.saved(),before); assert.equal(h.calls.filter(c=>c[0]==='transaction').length,1) })
  for (const code of ['40001','40P01','55P03','57014']) assert.equal(isQrEditConflict({code:'P2010',meta:{code}}),true)
  assert.equal(isQrEditConflict({code:'P2010',meta:{code:'unknown'}}),false)
})
test('synthetic direct, metadata, immutable mode, capacity and legacy null semantics',async()=>{
  const direct=fixture({shortUrlId:null,shortUrl:null,issuedEncodedTarget:null,data:'old'})
  const h=await setup(direct); const exact='  Exact\nopaque direct text  '; const r=await h.invoke({data:exact}); assert.equal(r.qrCode.encodedTarget,exact); assert.equal(h.saved().shortUrl,null)
  const large=await setup(direct); await assert.rejects(large.invoke({data:'é'.repeat(1000),errorLevel:'H'}),{statusCode:400})
  for(const key of ['createShortUrl','mode','shortUrlId','issuedEncodedTarget','userId']) { const x=await setup(); await assert.rejects(x.invoke({[key]:true}),{statusCode:400}); assert.equal(x.calls.length,0) }
  const legacy=await setup(fixture({issuedEncodedTarget:null})); const out=await legacy.invoke({data:destination}); assert.equal(out.qrCode.encodedTarget,null); assert.equal(out.qrCode.payloadStatus,'issuance-origin-unknown'); assert.equal(legacy.saved().issuedEncodedTarget,null)
  const style=await setup(fixture({issuedEncodedTarget:null})); await assert.rejects(style.invoke({errorLevel:'H'}),{statusCode:409})
  const broken=fixture({shortUrl:null}); const metadata=await setup(broken); const result=await metadata.invoke({title:'Correction',size:300,errorLevel:'M'}); assert.equal(result.qrCode.payloadState,'unavailable'); assert.equal(metadata.saved().data,broken.data); assert.equal(metadata.saved().shortUrl,null)
  const normal=await setup(); const old=normal.saved(); await normal.invoke({description:''}); assert.equal(normal.saved().description,null); assert.equal(normal.saved().data,old.data); assert.equal(normal.calls.some(c=>c[0]==='mapping'),false)
})
