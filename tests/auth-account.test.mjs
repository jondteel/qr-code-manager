import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import * as h3 from 'h3'
import * as zod from 'zod'
import * as ssr from '@supabase/ssr'
import * as supabaseJs from '@supabase/supabase-js'
import { verifyIdentity, accountReadiness, reconcileProfile } from '../server/utils/auth-account.mjs'
import { completeRecovery } from '../server/utils/auth-recovery.mjs'
import { accountReturnPath } from '../utils/auth-navigation.mjs'
import { fetchWithRetry } from '../utils/auth-fetch.mjs'

import { emailIdentity, subjectB } from './helpers/email-identity.mjs'
const user = emailIdentity()
const auth = (u=user) => ({getUser:async()=>({data:{user:u},error:null})})
function fixture({rows=[], readFail=false, createFail, commitLost=false}={}) {
  const saved=structuredClone(rows), writes=[]
  const db={user:{
    findUnique:async({where})=>{if(readFail)throw Error('private');return saved.find(r=>Object.entries(where).every(([k,v])=>r[k]===v))??null},
    create:async({data})=>{
      writes.push(data)
      if(createFail)throw createFail
      if(saved.some(r=>r.id===data.id || r.email===data.email || r.username===data.username))throw {code:'P2002'}
      saved.push(structuredClone(data));if(commitLost)throw Error('ack lost');return data
    },
  }}
  return {db,saved,writes}
}
test('fresh identity distinguishes missing session and provider outage',async t=>{
  for(const [name,error,state] of [
    ['missing',{name:'AuthSessionMissingError'},'invalid-session'],['revoked',{code:'session_not_found'},'invalid-session'],
    ['malformed',{code:'bad_jwt'},'invalid-session'],['network',{code:'auth_transport_unavailable',status:499},'temporarily-unavailable'],
    ['provider',{status:503},'temporarily-unavailable'],['unknown',{status:403},'temporarily-unavailable'],
  ])await t.test(name,async()=>assert.equal((await verifyIdentity({getUser:async()=>({error})})).state,state))
})
test('readiness exact-subject outcomes are read-only',async t=>{
  for(const [name,options,u,state] of [
    ['existing',{rows:[{...user,username:'legacy'}]},user,'ready'],['missing',{},user,'onboarding-required'],
    ['unconfirmed',{}, {...user,email_confirmed_at:null},'review-required'],['anonymous',{}, {...user,is_anonymous:true},'review-required'],
    ['foreign email',{rows:[{...user,id:'foreign'}]},user,'review-required'],['database outage',{readFail:true},user,'temporarily-unavailable'],
    ['no identity',{},null,'invalid-session'],
  ])await t.test(name,async()=>{const f=fixture(options);assert.equal((await accountReadiness(f.db,auth(u))).state,state);assert.equal(f.writes.length,0)})
})
test('existing same-subject attributes and ownership stay unchanged',async()=>{
  const row={id:user.id,email:'legacy@example.invalid',username:'Legacy_Name',createdAt:'old',qrCodes:[{id:'qr',userId:user.id,issuedEncodedTarget:'https://issuer.example.invalid/s/issued',lifecycleStatus:'retired',analytics:[{id:'scan'}]}]}
  const f=fixture({rows:[row]});assert.equal((await reconcileProfile(f.db,auth(),{username:'rename'})).state,'ready')
  assert.deepEqual(f.saved,[row]);assert.equal(f.writes.length,0)
})
test('intentional onboarding uses verified subject and normalized username',async()=>{
  const f=fixture();assert.equal((await reconcileProfile(f.db,auth(),{username:'  Valid_Name  '})).state,'ready')
  assert.deepEqual(f.saved,[{id:user.id,email:user.email,username:'valid_name'}]);assert.equal((await reconcileProfile(f.db,auth(),{username:'new_name'})).state,'ready');assert.equal(f.writes.length,1)
})
test('forged authority and invalid username cannot insert',async t=>{
  for(const body of [{username:'valid',userId:'foreign'},{username:'valid',email:'foreign@example.invalid'},{username:'a'},{username:'bad slash'},{},null])await t.test('strict input',async()=>{const f=fixture();assert.equal((await reconcileProfile(f.db,auth(),body)).state,'invalid-input');assert.equal(f.writes.length,0)})
})
test('uniqueness and uncertainty are safely reread',async t=>{
  for(const [name,options,state] of [
    ['username collision',{rows:[{id:'foreign',email:'b@example.invalid',username:'wanted'}]},'username-conflict'],
    ['email collision',{rows:[{id:'foreign',email:user.email,username:'other'}]},'review-required'],
    ['insert rejection',{createFail:Error('db unavailable')},'temporarily-unavailable'],
    ['lost commit acknowledgment',{commitLost:true},'ready'],
  ])await t.test(name,async()=>{const f=fixture(options);assert.equal((await reconcileProfile(f.db,auth(),{username:'wanted'})).state,state);assert.ok(f.saved.every(r=>r.id===user.id || r.username!== 'wanted' || r.id==='foreign'))})
})
test('same subject races are idempotent; two subjects cannot claim one username',async()=>{
  const f=fixture();const result=await Promise.all([reconcileProfile(f.db,auth(),{username:'wanted'}),reconcileProfile(f.db,auth(),{username:'second'})]);assert.ok(result.every(r=>r.state==='ready'));assert.equal(f.saved.length,1)
  const g=fixture();const outcomes=await Promise.all([reconcileProfile(g.db,auth(),{username:'wanted'}),reconcileProfile(g.db,auth(emailIdentity({id:subjectB,email:'b@example.test'})),{username:'wanted'})]);assert.deepEqual(outcomes.map(x=>x.state).sort(),['ready','username-conflict']);assert.equal(g.saved.length,1)
})
test('database read outage never attempts creation',async()=>{const f=fixture({readFail:true});assert.equal((await reconcileProfile(f.db,auth(),{username:'valid'})).state,'temporarily-unavailable');assert.equal(f.writes.length,0)})
test('anonymous onboarding fails without reading database',async()=>{const f=fixture({readFail:true});assert.equal((await reconcileProfile(f.db,auth(null),{username:'valid'})).state,'invalid-session');assert.equal(f.writes.length,0)})

function recovery(overrides={}) {
  let updates=0,verifications=0
  return {get updates(){return updates},get verifications(){return verifications},client:{...auth(),
    verifyOtp:async input=>{verifications++;assert.equal(input.type,'recovery');return {data:{user,session:{user}},error:null}},
    updateUser:async()=>{updates++;return {data:{user},error:null}},...overrides}}
}
const reset={email:user.email,token:'123456',password:'fictional-new-password',confirmation:'fictional-new-password'}
test('recovery containment denies ambiguous OTP and hash authority without provider calls',async t=>{
  for(const [name,proof] of [
    ['recovery OTP',{email:user.email,token:'123456'}],['magiclink OTP',{email:user.email,token:'654321'}],
    ['recovery hash',{tokenHash:'a'.repeat(64)}],['magiclink hash',{tokenHash:'b'.repeat(64)}],
    ['signup proof',{email:user.email,token:'234567'}],['invite proof',{tokenHash:'c'.repeat(64)}],
    ['email change proof',{email:user.email,token:'345678'}],['expired proof',{email:user.email,token:'456789'}],
    ['foreign subject proof',{email:'b@example.invalid',token:'567890'}],['forged hash',{tokenHash:'d'.repeat(64)}],
  ])await t.test(name,async()=>{
    let calls=0;const client=new Proxy({}, {get(){calls++;throw Error('Provider must not be touched')}})
    const result=await completeRecovery(client,{...proof,password:reset.password,confirmation:reset.confirmation})
    assert.equal(result.state,'recovery-unavailable');assert.equal(calls,0)
  })
})
test('ordinary session and client purpose declarations cannot authorize recovery',async()=>{
  const f=recovery();assert.equal((await completeRecovery(f.client,{password:reset.password,confirmation:reset.confirmation})).state,'recovery-proof-required')
  for(const patch of [{type:'recovery'},{userId:user.id},{metadata:{purpose:'recovery'}}])assert.equal((await completeRecovery(f.client,{...reset,...patch})).state,'invalid-input')
  assert.equal(f.updates,0);assert.equal(f.verifications,0)
})
test('invalid passwords refuse recovery without consuming proof',async()=>{
  const f=recovery();for(const patch of [{password:'a'},{confirmation:'different'},{password:'a'.repeat(129)}])assert.equal((await completeRecovery(f.client,{...reset,...patch})).state,'invalid-password')
  assert.equal(f.verifications,0);assert.equal(f.updates,0)
})
test('concurrent and repeated recovery requests cannot consume or mutate authority',async()=>{
  const f=recovery();const outcomes=await Promise.all(Array.from({length:8},()=>completeRecovery(f.client,reset)))
  assert.ok(outcomes.every(x=>x.state==='recovery-unavailable'));assert.equal(f.verifications,0);assert.equal(f.updates,0)
})
test('provider timeout or response loss cannot trigger recovery work during containment',async()=>{
  let calls=0;const f=recovery({verifyOtp:async()=>{calls++;throw Error('lost verification response')},getUser:async()=>{calls++;throw Error('timeout')},updateUser:async()=>{calls++;throw Error('lost update response')}})
  assert.equal((await completeRecovery(f.client,reset)).state,'recovery-unavailable');assert.equal(calls,0)
})
test('internal return paths are strictly allowlisted',async t=>{
  for(const input of ['//evil.example.invalid','https://evil.example.invalid','/dashboard?next=//evil','/dashboard/../signup','/analytics/%2f%2fhost','/edit/a\\b','/onboarding','/auth/recovery','/login',null,['/generate']])await t.test('rejected path',()=>assert.equal(accountReturnPath(input),'/dashboard'))
  for(const input of ['/generate','/analytics','/analytics/fictional-id','/edit/fictional-id'])await t.test('allowed path',()=>assert.equal(accountReturnPath(input),input))
})

async function load(source,imports,globals={}) {
  const context=createContext({console,...globals}),module=new SourceTextModule(stripTypeScriptTypes(source),{context})
  const records=new Map()
  await module.link(name=>{assert.ok(imports[name],name);if(!records.has(name))records.set(name,new SyntheticModule(Object.keys(imports[name]),function(){for(const [k,v]of Object.entries(imports[name]))this.setExport(k,v)},{context}));return records.get(name)})
  await module.evaluate();return module.namespace
}
test('signup actual handler never imports or writes Prisma across all provider outcomes',async t=>{
  const source=await readFile(new URL('../server/api/auth/signup.post.ts',import.meta.url),'utf8')
  for(const outcome of [{data:{user:{id:'obfuscated'},session:null}},{data:{user,session:{user}}},{error:{message:'private registered identity'}},null,'throw'])await t.test('neutral outcome',async()=>{
    let attempts=0
    const ns=await load(source,{'#supabase/server':{serverSupabaseClient:async()=>({auth:{signUp:async()=>{attempts++;if(outcome==='throw')throw Error('private');return outcome}}})},zod,h3,'~/server/utils/auth-boundary':{accountWriteBody:async()=>({email:user.email,password:'fictional-password'}),authOrigin:()=> 'https://app.example.invalid'}},{defineEventHandler:h=>h})
    const first=await ns.default({});assert.equal(first.state,'request-received');assert.equal(attempts,1)
  })
})
test('recovery request actual handler does not issue unusable recovery email',async()=>{
  const source=await readFile(new URL('../server/api/auth/recovery-request.post.ts',import.meta.url),'utf8');let status
  const ns=await load(source,{zod,h3:{...h3,setResponseStatus:(_e,s)=>status=s},'~/server/utils/auth-boundary':{accountWriteBody:async()=>({email:user.email})},'~/server/utils/recovery-local.mjs':{localRecovery:async()=>null}},{defineEventHandler:h=>h})
  const result=await ns.default({});assert.equal(result.state,'recovery-unavailable');assert.equal(status,503)
})
test('recovery completion actual handler returns unavailable without constructing Auth client',async()=>{
  const source=await readFile(new URL('../server/api/auth/recovery-complete.post.ts',import.meta.url),'utf8');let status
  const ns=await load(source,{h3:{...h3,setResponseStatus:(_e,s)=>status=s},'~/server/utils/auth-boundary':{accountWriteBody:async()=>reset},'~/server/utils/recovery-local.mjs':{localRecovery:async()=>null}},{defineEventHandler:h=>h})
  assert.equal((await ns.default({})).state,'recovery-unavailable');assert.equal(status,503)
})
test('transport sanitizes repeated exceptions, headers, body, URL and response loss with no replay or logs',async()=>{
  const originalFetch=globalThis.fetch,originalConsole={...console};let attempts=0,logs=[]
  const secret='fictional-private-canary';try{
    for(const method of ['error','warn','log','debug','trace'])console[method]=(...args)=>logs.push(args)
    globalThis.fetch=async()=>{attempts++;const e=new Error(secret);e.request={headers:{Authorization:secret},body:secret};throw e}
    for(let i=0;i<3;i++)assert.equal((await fetchWithRetry('https://auth.example.invalid/?code='+secret,{method:'POST',headers:{Authorization:secret,apikey:secret,Cookie:secret},body:secret})).status,499)
    assert.equal(attempts,3)
    globalThis.fetch=async()=>{attempts++;return {ok:true,text:async()=>{throw Error(secret)}}}
    assert.equal((await fetchWithRetry('https://auth.example.invalid/')).status,499);assert.equal(attempts,4)
    assert.equal(logs.length,0)
  }finally{globalThis.fetch=originalFetch;Object.assign(console,originalConsole)}
})
test('transport removes unsafe provider errors and disables retryable 5xx',async()=>{
  const original=globalThis.fetch
  try{for(const status of [400,401,429,500,502,503,504]){globalThis.fetch=async()=>new Response(JSON.stringify({message:'fictional-private-canary',code:'private-code'}),{status});const response=await fetchWithRetry('https://auth.example.invalid/');assert.equal(response.status,status>=500?499:status);assert.equal((await response.text()).includes('fictional-private-canary'),false)}}finally{globalThis.fetch=original}
})
test('actual installed browser, SSR plugin and server helper use safe transport and do not replay mutation failures',async t=>{
  const base=new URL('../node_modules/@nuxtjs/supabase/dist/runtime/',import.meta.url)
  const config={public:{supabase:{url:'http://127.0.0.1:1',key:'fictional-key',cookiePrefix:'fixture-auth',useSsrCookies:true,cookieOptions:{},clientOptions:{auth:{autoRefreshToken:false,detectSessionInUrl:false}}}}}
  for(const file of ['plugins/supabase.client.js','plugins/supabase.server.js','server/services/serverSupabaseClient.js'])await t.test(file,async()=>{
    let client,attempts=0,logs=[];const prior=globalThis.fetch,priorConsole={...console}
    try{
      globalThis.fetch=async()=>{attempts++;throw new Error('fictional-private-canary')}
      for(const name of ['log','warn','error','debug','trace'])console[name]=(...args)=>logs.push(args)
      const state=()=>({value:null}),imports={
        '@supabase/ssr':{...ssr,createBrowserClient:(url,key,options)=>ssr.createBrowserClient(url,key,{...options,isSingleton:false,cookies:{getAll:()=>[],setAll(){}}})},'@supabase/supabase-js':supabaseJs,h3:{...h3,getHeader:()=>''},
        '../utils/fetch-retry.js':{fetchWithRetry},'../../utils/fetch-retry.js':{fetchWithRetry},
        '../composables/useSupabaseSession.js':{useSupabaseSession:state},'../composables/useSupabaseUser.js':{useSupabaseUser:state},
        '../utils/cookies.js':{setCookies(){}},'../../utils/cookies.js':{setCookies(){}},
        '../server/services/index.js':{serverSupabaseUser:async()=>null,serverSupabaseSession:async()=>null},
        '#imports':{defineNuxtPlugin:x=>x,useRuntimeConfig:()=>config,useNuxtApp:()=>({hook(){}}),useRequestEvent:()=>({}),useSupabaseUser:state,useSupabaseSession:state},
      }
      const ns=await load(await readFile(new URL(file,base),'utf8'),imports)
      if(ns.serverSupabaseClient)client=await ns.serverSupabaseClient({context:{}})
      else await ns.default.setup({provide:(_name,value)=>{client=value.client}})
      await client.auth.signUp({email:user.email,password:'fictional-private-canary'})
      assert.equal(attempts,1);assert.equal(logs.length,0)
      await client.auth.resetPasswordForEmail(user.email);assert.equal(attempts,2)
      await client.auth.getUser('fictional-private-canary');assert.equal(attempts,3);assert.equal(logs.length,0)
      await client.auth.refreshSession({refresh_token:'fictional-private-canary'});assert.equal(attempts,4);assert.equal(logs.length,0)
      await client.auth.signInWithPassword({email:user.email,password:'fictional-private-canary'});assert.equal(attempts,5);assert.equal(logs.length,0)
    }finally{globalThis.fetch=prior;Object.assign(console,priorConsole)}
  })
})
test('body boundary refuses foreign origins and non-JSON requests',async()=>{
  const source=await readFile(new URL('../server/utils/auth-boundary.ts',import.meta.url),'utf8')
  const ns=await load(source,{h3},{useRuntimeConfig:()=>({authSiteOrigin:'https://app.example.invalid'}),Buffer,Date,URL})
  function event(headers={},body='{}') {return h3.createEvent({method:'POST',url:'/',headers:{origin:'https://app.example.invalid','content-type':'application/json',...headers},on(){},once(){},socket:{},[Symbol.asyncIterator]:async function*(){yield Buffer.from(body)}},{setHeader(){},getHeader(){}})}
  // Actual stream behavior is covered through compiled HTTP; origin checks need no stream.
  await assert.rejects(ns.accountWriteBody(event({origin:'https://foreign.example.invalid'})),{statusCode:403})
  await assert.rejects(ns.accountWriteBody(event({'content-type':'text/plain'})),{statusCode:415})
})

test('actual shared logout handles returned errors and uses local session scope',async t=>{
  const source=await readFile(new URL('../composables/useAccountLogout.ts',import.meta.url),'utf8')
  for(const mode of ['success','error','throw'])await t.test(mode,async()=>{
    const states=new Map();let navigation=0,scope,userState={value:{sub:'owner'}},sessionState={value:{user:{id:'owner'}}}
    const ns=await load(source,{}, {useSupabaseClient:()=>({auth:{signOut:async options=>{scope=options.scope;if(mode==='throw')throw Error('private');return {error:mode==='error'?{message:'private'}:null}}}}),useState:(key,fn)=>{if(!states.has(key))states.set(key,{value:fn()});return states.get(key)},useSupabaseUser:()=>userState,useSupabaseSession:()=>sessionState,navigateTo:async()=>navigation++})
    const result=ns.useAccountLogout();await result.signOut();assert.equal(scope,'local')
    assert.equal(navigation,mode==='success'?1:0);assert.equal(!!result.logoutError.value,mode!=='success')
    assert.equal(userState.value===null,mode==='success');assert.equal(result.logoutBusy.value,false)
  })
})
