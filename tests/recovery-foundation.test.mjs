import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { config, mint, bound, parse, opaque } from '../server/utils/recovery-crypto.mjs'
import { fixtureIssuer, fictionalMailSink, validateFixtureResponse } from '../server/utils/recovery-fixture-issuer.mjs'
const key = randomBytes(32), recipientKey = randomBytes(32)
const settings = { environment:'isolated-fixture', project:'pg17-fictional', activeKeyId:'k1', keys:new Map([['k1',key]]), recipientKey }
const c = config(settings), now = Date.now()
const input = { subject:'11111111-1111-4111-8111-111111111111', recipient:'alice@example.test', proof:'a'.repeat(56), generation:1, issuedAtMs:now, expiresAtMs:now+600000 }
const response = () => ({ data:{ properties:{verification_type:'recovery',hashed_token:input.proof}, user:{id:input.subject,email:input.recipient,email_confirmed_at:'2026-10-19',is_anonymous:false,is_sso_user:false,factors:[],app_metadata:{provider:'email',providers:['email']}}},error:null })
test('canonical grant integrity and independent 256-bit secret',()=>{
  const a=mint(c,input), b=mint(c,input)
  assert.notEqual(a.capability,b.capability)
  assert.equal(Buffer.from(parse(a.capability).secret,'base64url').length,32)
  assert.equal(bound(c,a.record,a.capability,now),true)
  assert.equal(bound(c,a.record,a.capability,now+599999),true)
  assert.equal(bound(c,a.record,a.capability,now+600000),false)
  assert.equal(bound(c,a.record,a.capability,now-1),false)
  for(const secret of [input.proof,parse(a.capability).secret,a.capability]) assert.equal(JSON.stringify(a.record).includes(secret),false)
})
test('every authorization tuple field is bound',async t=>{
  const g=mint(c,input)
  for(const [field,value] of Object.entries({version:2,purpose:'signin',environment:'other',project:'other',subject:'22222222-2222-4222-8222-222222222222',selector:opaque(),email:'bob@example.test',recipientId:'b'.repeat(64),keyId:'k2',generation:2,issuedAtMs:now-1,expiresAtMs:now+1000,secretDigest:'0'.repeat(64),proofMac:'0'.repeat(64)})) {
    await t.test(field,()=>assert.equal(bound(c,{...g.record,[field]:value},g.capability,now),false))
  }
})
test('missing, altered, sign-in-only and noncanonical proof or secret fail closed',()=>{
  const g=mint(c,input), p=parse(g.capability)
  for(const cap of [null,{},'',input.proof,'123456',`r1.${p.selector}.${opaque()}.${p.proof}`,`r1.${p.selector}.${p.secret}.${'b'.repeat(56)}`,`r1.${p.selector}.${p.secret}.123456`,g.capability+'.extra',g.capability+'\n',g.capability.replace('r1.','r2.'),g.capability.replace(p.secret,p.secret+'='),g.capability.toUpperCase()]) assert.equal(bound(c,g.record,cap,now),false)
})
test('key rotation retains only explicitly provisioned verification keys',()=>{
  const g=mint(c,input), next=randomBytes(32)
  const rotated=config({...settings,activeKeyId:'k2',keys:new Map([['k1',key],['k2',next]])})
  assert.equal(bound(rotated,g.record,g.capability,now),true)
  assert.equal(mint(rotated,input).record.keyId,'k2')
  assert.equal(bound(config({...settings,activeKeyId:'k2',keys:new Map([['k2',next]])}),g.record,g.capability,now),false)
  assert.equal(bound(config({...settings,project:'other'}),g.record,g.capability,now),false)
  assert.equal(bound(config({...settings,environment:'other'}),g.record,g.capability,now),false)
})
test('missing configuration and malformed keys are refused without defaults',()=>{
  for(const patch of [{environment:undefined},{project:undefined},{activeKeyId:undefined},{recipientKey:Buffer.alloc(16)},{keys:new Map([['k1',Buffer.alloc(8)]])},{keys:new Map()}]) assert.throws(()=>config({...settings,...patch}),/foundation refused/)
})
test('trusted fixture response validation rejects provider purpose/subject eligibility ambiguity',()=>{
  assert.deepEqual(validateFixtureResponse(response(),input.recipient),{subject:input.subject,proof:input.proof})
  for(const mutate of [r=>r.error={},r=>r.data.properties.verification_type='magiclink',r=>r.data.user.email='bob@example.test',r=>r.data.user.is_anonymous=true,r=>r.data.user.is_sso_user=true,r=>r.data.user.factors=[{status:'verified'}],r=>r.data.user.banned_until='2027-01-01',r=>r.data.user.email_confirmed_at=null,r=>r.data.user.new_email='other@example.test',r=>r.data.user.app_metadata.providers.push('saml')]) { const r=response();mutate(r);assert.throws(()=>validateFixtureResponse(r,input.recipient),/foundation refused/) }
})
test('no delivery on missing/uncertain persistence; neutral safe failures',async()=>{
  for(const fail of ['reserve','publish','deliver','delivered','generate']) {
    const calls=[], sink=fictionalMailSink()
    const ledger={reserve:async()=>{calls.push('reserve');if(fail==='reserve')throw Error('SECRET');return {operationId:opaque()}},publish:async()=>{calls.push('publish');if(fail==='publish')throw Error('SECRET');return mint(c,input)},delivered:async()=>{if(fail==='delivered')throw Error('SECRET');return true},abandon:async()=>calls.push('abandon')}
    const issue=fixtureIssuer({ledger,generateFixture:async args=>{calls.push('generate');assert.equal(args.type,'recovery');if(fail==='generate')throw Error('SECRET');return response()},sink:{deliver:async m=>{if(fail==='deliver')throw Error('SECRET');await sink.deliver(m)}}})
    assert.deepEqual(await issue(input.recipient),{state:'unavailable'})
    assert.equal(sink.take().length,fail==='delivered'?1:0)
    if(fail==='reserve') assert.deepEqual(calls,['reserve'])
  }
})
test('issuer accepts fictional recipient only, never caller identity/type/redirect or cookies',async()=>{
  let called=0
  const issue=fixtureIssuer({ledger:{reserve:async()=>{called++;return null}},generateFixture:()=>{throw Error()},sink:fictionalMailSink()})
  for(const value of [{email:input.recipient,type:'recovery',subject:input.subject},'real@company.com','Alice@example.test',null]) assert.deepEqual(await issue(value),{state:'unavailable'})
  assert.equal(called,0)
})
test('no password/session mutation adapter and no capability logging in foundation',()=>{
  for(const file of ['recovery-crypto.mjs','recovery-ledger.mjs','recovery-fixture-issuer.mjs']) {
    const src=readFileSync(new URL('../server/utils/'+file,import.meta.url),'utf8')
    assert.doesNotMatch(src,/console\.|updateUser\(|updateUserById\(|verifyOtp\(|serverSupabase|document\.|localStorage/)
  }
})
test('secret-carrying fixture errors never reach console logging',async()=>{
  const captured=[], originals={}
  for(const method of ['log','error','warn','debug','info']) {originals[method]=console[method];console[method]=(...args)=>captured.push(args)}
  try {
    const issue=fixtureIssuer({ledger:{reserve:async()=>({operationId:opaque()}),abandon:async()=>{throw Error('private-capability-canary')}},generateFixture:async()=>{throw Error('private-capability-canary')},sink:fictionalMailSink()})
    assert.deepEqual(await issue(input.recipient),{state:'unavailable'})
    assert.equal(captured.length,0)
  } finally {for(const method of Object.keys(originals))console[method]=originals[method]}
})
