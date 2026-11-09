import test from 'node:test'
import assert from 'node:assert/strict'
import { recoveryIntegration, eligibleUser, validateGenerated } from '../server/utils/recovery-integration.mjs'
import { mint, config } from '../server/utils/recovery-crypto.mjs'
import { randomBytes, randomUUID } from 'node:crypto'
const subject=randomUUID(), recipient='integration@example.test'
const user=()=>({id:subject,email:recipient,email_confirmed_at:new Date().toISOString(),is_anonymous:false,aud:'authenticated',role:'authenticated',app_metadata:{provider:'email',providers:['email']},identities:[{provider:'email',user_id:subject}]})
const c=config({environment:'fixture',project:'fixture',activeKeyId:'k',keys:new Map([['k',randomBytes(32)]]),recipientKey:randomBytes(32)})
const proof='a'.repeat(56),capability=mint(c,{subject,recipient,proof,generation:1,issuedAtMs:Date.now(),expiresAtMs:Date.now()+60000}).capability
const body={capability,password:'New-password-1!',confirmation:'New-password-1!'}
function fixture(patch={}) {
  const events=[], signals=[];let outcome
  const ledger={reserve:async()=>{events.push('reserve');return {issuedAtMs:Date.now()}},publish:async(_r,_e,p)=>{events.push('publish');assert.equal(p.lifetimeMs,60000);return{capability}},delivered:async()=>{events.push('delivered');return true},abandon:async()=>events.push('abandon'),claim:async()=>{events.push('claim');return{subject,email:recipient}},settle:async(_c,value)=>{outcome=value;events.push('settle');return true},...patch.ledger}
  const auth={verifyOtp:async args=>{events.push('verify');assert.deepEqual(args,{type:'recovery',token_hash:proof});return {data:{user:user(),session:{access_token:'private'}},error:null}},getUser:async()=>({data:{user:user()},error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal1'},error:null})},updateUser:async()=>{events.push('update');return {data:{user:user()},error:null}},signOut:async args=>{events.push('revoke');assert.equal(args.scope,'global');return{error:null}},stopAutoRefresh(){events.push('discard')},...patch.auth}
  auth.admin={signOut:async(token,scope)=>{events.push('revoke');assert.equal(token,'private');assert.equal(scope,'global');return {error:null}},...patch.revoke}
  const admin={auth:{admin:{generateLink:async args=>{events.push('generate');assert.equal(args.type,'recovery');return{data:{user:user(),properties:{verification_type:'recovery',hashed_token:proof,redirect_to:'http://127.0.0.1:58300/auth/recovery',action_link:'http://127.0.0.1:58321/auth/v1/verify?type=recovery&redirect_to=http%3A%2F%2F127.0.0.1%3A58300%2Fauth%2Frecovery&token='+proof}},error:null}},getUserById:async()=>({data:{user:user()},error:null}),mfa:{listFactors:async()=>({data:{factors:[]},error:null})},...patch.admin}}}
  const service=recoveryIntegration({ledger,admin,userClient:()=>{events.push('client');return{auth}},origin:'http://127.0.0.1:58300',projectOrigin:'http://127.0.0.1:58321',providerLifetimeMs:60000,deliver:async()=>events.push('mail'),observe:patch.observe || (code=>signals.push(code))})
  return {service,events,signals,outcome:()=>outcome}
}
test('pinned generation selection plus fresh email-only checks does not default hidden SSO false',()=>{
  assert.equal(eligibleUser(user(),recipient),subject)
  for(const patch of [{id:'unknown'},{is_anonymous:undefined},{is_sso_user:true},{email_confirmed_at:'bad'},{new_email:'pending@example.test'},{banned_until:'2099-01-01'},{deleted_at:'2026-01-01'},{identities:[]},{factors:null},{factors:[{status:'verified'}]},{app_metadata:{provider:'saml',providers:['email','saml']}}])assert.throws(()=>eligibleUser({...user(),...patch},recipient))
})
test('trusted action link rejects wrong project and wrong proof',()=>{
  for(const link of ['http://evil.example.test/auth/v1/verify?type=recovery&redirect_to=http%3A%2F%2F127.0.0.1%3A58300%2Fauth%2Frecovery&token='+proof,'http://127.0.0.1:58321/auth/v1/verify?type=magiclink&token='+proof,'http://127.0.0.1:58321/auth/v1/verify?type=recovery&token=bad'])assert.throws(()=>validateGenerated({data:{user:user(),properties:{verification_type:'recovery',hashed_token:proof,redirect_to:'http://127.0.0.1:58300/auth/recovery',action_link:link}}},recipient,'http://127.0.0.1:58321','http://127.0.0.1:58300'))
})
test('issuer publishes before mail and uses authoritative shorter lifetime',async()=>{const f=fixture();await f.service.request(recipient);assert.deepEqual(f.events,['reserve','generate','publish','mail','delivered'])})
test('uncertain publication never sends mail or retries generation',async()=>{const f=fixture({ledger:{publish:async()=>null}});await f.service.request(recipient);assert.deepEqual(f.events,['reserve','generate','abandon'])})
test('fresh provider subject mismatch never publishes',async()=>{const f=fixture({admin:{generateLink:async()=>({data:{user:{...user(),id:randomUUID()},properties:{verification_type:'recovery',hashed_token:proof,redirect_to:'http://127.0.0.1:58300/auth/recovery',action_link:'http://127.0.0.1:58321/auth/v1/verify?type=recovery&redirect_to=http%3A%2F%2F127.0.0.1%3A58300%2Fauth%2Frecovery&token='+proof}}})}});await f.service.request(recipient);assert.equal(f.events.includes('publish'),false)})
test('completion claims before client, updates once, globally revokes then settles',async()=>{const f=fixture();assert.deepEqual(await f.service.complete(body),{state:'password-updated'});assert.deepEqual(f.events,['claim','client','verify','update','revoke','discard','settle']);assert.equal(f.outcome(),'consumed')})
test('failed or lost claim acknowledgment prevents all provider dispatch',async()=>{const f=fixture({ledger:{claim:async()=>null}});assert.equal((await f.service.complete(body)).state,'invalid-or-expired');assert.deepEqual(f.events,[])})
test('ordinary session/OTP and password mismatch cannot invoke ledger',async()=>{const f=fixture();for(const b of [{...body,password:'other'},{...body,capability:'123456'},{...body,token:proof},{password:'New-password-1!',confirmation:'New-password-1!'}])assert.notEqual((await f.service.complete(b)).state,'password-updated');assert.deepEqual(f.events,[])})
test('MFA next AAL2 refuses before password mutation',async()=>{const f=fixture({auth:{mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal1',nextLevel:'aal2'}})}}});assert.equal((await f.service.complete(body)).state,'recovery-refused');assert.equal(f.events.includes('update'),false);assert.equal(f.outcome(),'refused')})
test('native password refusal consumes application authority without retry',async()=>{const f=fixture({auth:{updateUser:async()=>({error:{status:422}})}});assert.equal((await f.service.complete(body)).state,'recovery-refused');assert.equal(f.outcome(),'refused')})
test('lost password acknowledgment remains unknown and never revokes/retries',async()=>{let calls=0;const f=fixture({auth:{updateUser:async()=>{calls++;throw Error('secret-canary')}}});assert.equal((await f.service.complete(body)).state,'outcome-unknown');assert.equal(calls,1);assert.equal(f.events.includes('revoke'),false);assert.equal(f.outcome(),'outcome_unknown')})
test('sanitized transport uncertainty is not a definite refusal',async()=>{const f=fixture({auth:{updateUser:async()=>({error:{status:499}})}});assert.equal((await f.service.complete(body)).state,'outcome-unknown');assert.equal(f.outcome(),'outcome_unknown')})
test('revocation failure after update cannot report success',async()=>{const f=fixture({revoke:{signOut:async()=>({error:{status:499}})}});assert.equal((await f.service.complete(body)).state,'outcome-unknown');assert.equal(f.outcome(),'outcome_unknown')})
test('lost settlement acknowledgment never reports definite success',async()=>{const f=fixture({ledger:{settle:async()=>null}});assert.equal((await f.service.complete(body)).state,'outcome-unknown')})

test('native logout 401/403/404 must remain unknown rather than SDK soft success',async()=>{for(const status of [401,403,404]){const f=fixture({revoke:{signOut:async()=>({error:{status}})}});assert.equal((await f.service.complete(body)).state,'outcome-unknown');assert.equal(f.outcome(),'outcome_unknown')}})

test('uncertain issuance emits fixed review codes and preserves fencing failure',async()=>{
  const f=fixture({ledger:{publish:async()=>{throw Error('private-proof recipient@example.test')},abandon:async()=>null}})
  assert.equal(await f.service.request(recipient),undefined)
  assert.deepEqual(f.signals,['issuance-uncertain','issuance-fence-unconfirmed'])
  assert.equal(f.events.includes('mail'),false)
})
test('uncertain update diagnostics never include credential/error material',async()=>{
  const f=fixture({auth:{updateUser:async()=>{throw Error(body.password+' '+body.capability)}}})
  assert.equal((await f.service.complete(body)).state,'outcome-unknown')
  assert.deepEqual(f.signals,['completion-uncertain'])
  assert.equal(f.outcome(),'outcome_unknown')
})
test('revocation and settlement uncertainty produce distinct fixed operator signals',async()=>{
  const f=fixture({revoke:{signOut:async()=>({error:{status:503,message:body.capability}})},ledger:{settle:async()=>null}})
  assert.equal((await f.service.complete(body)).state,'outcome-unknown')
  assert.deepEqual(f.signals,['revocation-unconfirmed','completion-uncertain','settlement-unconfirmed'])
})
test('diagnostic sink failure cannot retry mutation or change fail-closed result',async()=>{
  let updates=0
  const f=fixture({observe:()=>{throw Error('sink unavailable')},auth:{updateUser:async()=>{updates++;throw Error('private')}}})
  assert.equal((await f.service.complete(body)).state,'outcome-unknown')
  assert.equal(updates,1);assert.equal(f.outcome(),'outcome_unknown')
})
test('successful completion and definite native policy refusal do not signal uncertainty',async()=>{
  const ok=fixture();assert.equal((await ok.service.complete(body)).state,'password-updated');assert.deepEqual(ok.signals,[])
  const no=fixture({auth:{updateUser:async()=>({error:{status:422}})}});assert.equal((await no.service.complete(body)).state,'recovery-refused');assert.deepEqual(no.signals,[])
})

// These are adapter-contract tests, not genuine provider/passwordless acceptance.
test('confirmed email-only issuance and completion need no enrollment/password-history flag',async()=>{
  const f=fixture()
  await f.service.request(recipient)
  assert.equal(f.events.includes('mail'),true)
  assert.equal((await f.service.complete(body)).state,'password-updated')
})

test('unsupported identity composition and confirmation fail closed',()=>{
  for(const patch of [
    {email_confirmed_at:undefined},{email_confirmed_at:null},{email_confirmed_at:''},
    {identities:undefined},{identities:null},{identities:[{provider:'saml:x',user_id:subject}]},
    {identities:[{provider:'email',user_id:randomUUID()}]},
    {identities:[{provider:'email',user_id:subject},{provider:'google',user_id:subject}]},
    {app_metadata:{}},{app_metadata:{provider:'email',providers:['email','google']}},
    {app_metadata:{provider:'email',providers:undefined}},{email_change_sent_at:'2026-11-01'},
    {is_sso_user:null},{is_sso_user:'false'},
  ]) assert.throws(()=>eligibleUser({...user(),...patch},recipient,subject))
})

test('current provider eligibility failure prevents publication with neutral request result',async()=>{
  for(const patch of [{banned_until:'2099-01-01'},{deleted_at:'2026-11-01'},{new_email:'pending@example.test'},{email_confirmed_at:null},{identities:[]}]){
    const f=fixture({admin:{getUserById:async()=>({data:{user:{...user(),...patch}},error:null})}})
    assert.equal(await f.service.request(recipient),undefined)
    assert.equal(f.events.includes('publish'),false);assert.equal(f.events.includes('mail'),false)
  }
})

test('provider read/factor errors and verified or unknown factor states refuse',async()=>{
  for(const admin of [
    {getUserById:async()=>({error:{status:503}})},
    {getUserById:async()=>{throw Error('private-provider-error')}},
    {mfa:{listFactors:async()=>({error:{status:503}})}},
    {mfa:{listFactors:async()=>({data:{factors:null}})}},
    {mfa:{listFactors:async()=>({data:{factors:[{status:'verified'}]}})}},
    {mfa:{listFactors:async()=>({data:{factors:[{status:'unknown'}]}})}},
  ]) {
    const f=fixture({admin});await f.service.request(recipient)
    assert.equal(f.events.includes('publish'),false)
    assert.equal((await f.service.complete(body)).state,'recovery-refused')
    assert.equal(f.events.includes('update'),false)
  }
})

test('eligibility rechecked after proof verification immediately before password mutation',async()=>{
  let reads=0
  const f=fixture({admin:{getUserById:async()=>({data:{user:++reads===1?user():{...user(),new_email:'pending@example.test'}}})}})
  assert.equal((await f.service.complete(body)).state,'recovery-refused')
  assert.equal(reads,2);assert.equal(f.events.includes('verify'),true);assert.equal(f.events.includes('update'),false)
})

test('deleted/recreated different subject cannot inherit a claimed grant',async()=>{
  const f=fixture({admin:{getUserById:async()=>({data:{user:{...user(),id:randomUUID()}}})}})
  assert.equal((await f.service.complete(body)).state,'recovery-refused')
  assert.equal(f.events.includes('client'),false);assert.equal(f.events.includes('update'),false)
})
