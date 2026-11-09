import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { createApp, createRouter, toNodeListener } from 'h3'
import { decodeRedirectCode, redirectEligibility, resolveRedirect } from '../server/utils/qr-redirect.mjs'
import { redirectHandler, redirectFixture, redirectMock, redirectCacheHandler } from './helpers/qr-redirect-harness.mjs'

test('code decoding preserves F2 historical identity and refuses unsafe paths', async t => {
  for(const code of ['A','Case-Sensitive','a'.repeat(120),'100%','literal%2F','space code','é›ª cafÃ©','a?b#c','...',' . ']) {
    await t.test(JSON.stringify(code),()=>assert.equal(decodeRedirectCode(encodeURIComponent(code)),code))
  }
  for(const raw of [undefined,'','.', '..', '%2e%2e','a%2Fb','a%5Cb','%00','%7F','%C2%80','%','%zz','%C0%AF','%ED%A0%80','%F0%28%8C%BC','a'.repeat(6200),'%20'.repeat(800)]) {
    await t.test('reject '+String(raw).slice(0,30),()=>assert.equal(decodeRedirectCode(raw),null))
  }
  assert.equal(decodeRedirectCode('%252F'),'%2F')
})

const invalid = [
  ['absent mapping',()=>null], ['missing QR',x=>{x.qrCode=null;return x}],
  ['foreign owner',x=>{x.qrCode.userId='private-owner';return x}],
  ['wrong linkage',x=>{x.qrCode.shortUrlId='private-id';return x}],
  ['wrong code',x=>{x.shortCode='Other';return x}],
  ['destination mismatch',x=>{x.qrCode.data='https://other.example.invalid';return x}],
  ...['javascript:alert(1)','https://user:pass@example.invalid','https://@example.invalid','not a URL','https://example.invalid/\nsecret','https://example.invalid/\\x','https://example.invalid/\ud800','https://example.invalid/'+ 'a'.repeat(2100),' https://example.invalid','https://example.invalid/a b'].map(value=>['unsafe destination '+JSON.stringify(value).slice(0,40),x=>{x.originalUrl=value;x.qrCode.data=value;return x}]),
  ...[undefined,'https://issuer.example.invalid/s/Other','https://issuer.example.invalid/other/Original-Code','https://issuer.example.invalid/s/Original-Code?x','https://issuer.example.invalid/s/Original-Code#','javascript:Original-Code','https://user:pass@example.invalid/s/Original-Code'].map(value=>['unsafe provenance '+String(value),x=>{x.qrCode.issuedEncodedTarget=value;return x}]),
]

test('read-only eligibility enforces linkage/owner/destination and exact provenance path',async t=>{
  for(const [name,mutate] of invalid) await t.test(name,()=>{
    const link=mutate(redirectFixture()), before=structuredClone(link)
    assert.deepEqual(redirectEligibility(link,'Original-Code'),{available:false});assert.deepEqual(link,before)
  })
  for(const code of ['Original-Code','100%','space é›ª','literal%2F']) for(const legacy of [false,true]) {
    const link=redirectFixture(code);if(legacy)link.qrCode.issuedEncodedTarget=null
    assert.equal(redirectEligibility(link,code).destination,link.originalUrl)
  }
})

test('exact lookup uses read-only RepeatableRead, no repairs or identity/provenance writes',async()=>{
  const mock=redirectMock();const decision=await resolveRedirect(mock.prisma,'Original-Code')
  assert.equal(decision.available,true)
  assert.deepEqual(mock.calls[0],['transaction',{isolationLevel:'RepeatableRead'}])
  assert.deepEqual(mock.calls[1],['readonly','SET TRANSACTION READ ONLY'])
  assert.deepEqual(mock.calls[2][1].where,{shortCode:'Original-Code'})
  assert.equal((await resolveRedirect(mock.prisma,'original-code')).available,false)
  const count=mock.calls.length;assert.equal((await resolveRedirect(mock.prisma,'a/b')).available,false);assert.equal(mock.calls.length,count)
  assert.equal(mock.scans.length,0)
})

async function serve(prisma,fn,logs=[]){
  const handler=await redirectHandler(prisma,logs),app=createApp({debug:false}),router=createRouter()
  app.use(await redirectCacheHandler());router.get('/s/:code',handler);app.use(router);const server=createServer(toNodeListener(app))
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const get=path=>new Promise((resolve,reject)=>{
    request({hostname:'127.0.0.1',port:server.address().port,path,method:'GET',headers:{'user-agent':'Fictional UA','x-forwarded-for':'192.0.2.5, 192.0.2.6'}},res=>{
      let body='';res.on('data',x=>body+=x);res.on('end',()=>{try{if(path==='/s'||path.startsWith('/s/'))for(const key of ['cache-control','cdn-cache-control','vercel-cdn-cache-control'])assert.equal(res.headers[key],'no-store');resolve({status:res.statusCode,location:res.headers.location,body})}catch(error){reject(error)}})
    }).on('error',reject).end()
  })
  try{await fn(get)}finally{await new Promise(resolve=>server.close(resolve))}
}

test('actual TS route + real H3 HTTP: status, encoding, scans, privacy and failures',async t=>{
  for(const code of ['Original-Code','100%','literal%2F','space code','é›ª cafÃ©','a?b#c','...']) await t.test('HTTP legacy '+code,async()=>{
    const link=redirectFixture(code);link.qrCode.issuedEncodedTarget=null;const before=structuredClone(link),mock=redirectMock(link)
    await serve(mock.prisma,async get=>{
      const r=await get('/s/'+encodeURIComponent(code));assert.equal(r.status,302);assert.equal(r.location,link.originalUrl)
      assert.equal(mock.scans.length,1);assert.equal(mock.scans[0].ipAddress,'192.0.2.5');assert.equal(mock.scans[0].userAgent,'Fictional UA')
      assert.equal((await get('/s/'+encodeURIComponent(code.toUpperCase()+'wrong'))).status,404);assert.equal(mock.scans.length,1)
    });assert.deepEqual(link,before)
  })
  for(const [name,mutate] of invalid) await t.test('HTTP '+name,async()=>{
    const link=mutate(redirectFixture()),before=structuredClone(link),mock=redirectMock(link)
    await serve(mock.prisma,async get=>{
      const r=await get('/s/Original-Code');assert.equal(r.status,404);assert.equal(r.location,undefined)
      assert.ok(r.body.includes('Link unavailable'));for(const secret of ['private-owner','private-id','destination.example.invalid','user:pass'])assert.ok(!r.body.includes(secret))
    });assert.equal(mock.scans.length,0);assert.deepEqual(link,before)
  })
  await t.test('malformed/separator/empty paths never query or scan',async()=>{
    const mock=redirectMock();await serve(mock.prisma,async get=>{for(const path of ['/s/','/s/%','/s/%zz','/s/%2F','/s/%5C','/s/%2e%2e','/s/%C0%AF','/s/a/b']){const r=await get(path);assert.equal(r.status,404);assert.equal(r.location,undefined)}});assert.equal(mock.calls.length,0)
  })
  await t.test('database failure is generic 503, no scan',async()=>{
    const mock=redirectMock(undefined,{readFailure:true});await serve(mock.prisma,async get=>{const r=await get('/s/Original-Code');assert.equal(r.status,503);assert.equal(r.location,undefined);assert.ok(!r.body.includes('private'))});assert.equal(mock.scans.length,0)
  })
  await t.test('accepted scan failure still redirects with exact stored Location',async()=>{
    const mock=redirectMock(undefined,{scanFailure:true});await serve(mock.prisma,async get=>{const r=await get('/s/Original-Code');assert.equal(r.status,302);assert.equal(r.location,redirectFixture().originalUrl)});assert.equal(mock.calls.filter(x=>x[0]==='scan').length,1)
  })
})

test('one awaited scan attempt, exact metadata and sanitized committed event',async()=>{
  const mock=redirectMock(),logs=[]
  await serve(mock.prisma,async get=>assert.equal((await get('/s/Original-Code')).status,302),logs)
  assert.equal(mock.calls.filter(x=>x[0]==='scan').length,1)
  assert.deepEqual(mock.calls.find(x=>x[0]==='scan-transaction')[1],{maxWait:1000,timeout:1500})
  assert.deepEqual(mock.calls.filter(x=>x[0]==='scan-limit').map(x=>x[1]),["SET LOCAL statement_timeout = '750ms'","SET LOCAL lock_timeout = '500ms'"])
  assert.deepEqual(logs,[{event:'redirect-scan',redirect:'resolved',outcome:'succeeded',reason:'committed'}])
})

test('same saved code observes a fictional atomic destination edit without stale Location',async()=>{
  const link=redirectFixture(),mock=redirectMock(link)
  await serve(mock.prisma,async get=>{
    assert.equal((await get('/s/Original-Code')).location,link.originalUrl)
    link.originalUrl=link.qrCode.data='https://edited.example.invalid/next'
    assert.equal((await get('/s/Original-Code')).location,link.originalUrl)
  })
  assert.equal(mock.scans.length,2)
})

test('scan failures and malformed DB replies keep verified destination and never retry',async t=>{
  for(const fault of ['reject','missing','invalid','commit','timeout','constraint','ack-missing','ack-invalid','logger']) await t.test(fault,async()=>{
    const mock=redirectMock(),logs=[];const ordinary=mock.prisma.$transaction
    mock.prisma.$transaction=async(fn,options)=>{
      if(!options.maxWait)return ordinary(fn,options)
      let result=await fn({$queryRaw:async()=>[{id:'qr'}],$executeRaw:async()=>{},analytics:{create:async query=>{
        mock.calls.push(['scan',query])
        if(fault==='reject')throw Error('private destination/IP/UA/connection')
        if(fault==='timeout')throw Object.assign(Error('private'),{code:'P2028'})
        if(fault==='constraint')throw Object.assign(Error('private'),{code:'P2003'})
        if(fault==='missing')return undefined
        if(fault==='invalid')return {id:42}
        return {id:'fictional'}
      }}})
      if(fault==='commit')throw Object.assign(Error('lost commit acknowledgment'),{code:'P1017'})
      if(fault==='ack-missing')return undefined
      if(fault==='ack-invalid')return {}
      return result
    }
    if(fault==='logger')logs.push=()=>{throw Error('sink unavailable')}
    await serve(mock.prisma,async get=>{const r=await get('/s/Original-Code');assert.equal(r.status,302);assert.equal(r.location,redirectFixture().originalUrl)},logs)
    assert.equal(mock.calls.filter(x=>x[0]==='scan').length,1)
    if(fault!=='logger'){
      assert.equal(logs[0].outcome,fault==='constraint'?'failed':'unknown')
      assert.deepEqual(Object.keys(logs[0]),['event','redirect','outcome','reason'])
      assert.ok(!JSON.stringify(logs).includes('private'))
    }
  })
})

test('scan success is emitted only after commit acknowledgment, without detached work',async()=>{
  const {recordRedirectScan}=await import('../server/utils/qr-scan.mjs')
  let finish,entered;const barrier=new Promise(r=>finish=r),ready=new Promise(r=>entered=r),logs=[]
  const pending=recordRedirectScan({$transaction:async fn=>{
    const receipt=await fn({$queryRaw:async()=>[{id:'qr'}],$executeRaw:async()=>{},analytics:{create:async()=>({id:'fictional'})}})
    entered();await barrier;return receipt
  }},{},{info:x=>logs.push(x),error:x=>logs.push(x)})
  await ready;assert.equal(logs.length,0);finish()
  assert.equal((await pending).outcome,'succeeded');assert.equal(logs.length,1)
})
