import { presentQr } from '../server/utils/qr-issuance.mjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { createContext, SourceTextModule, SyntheticModule } from 'node:vm'
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc'
import * as vue from 'vue'
import * as payload from '../utils/qr-payload.mjs'
import * as rendering from '../utils/qr-render.mjs'
import RealQR from 'qrcode'

// Execute actual compiled page setup/actions with fake network, canvas and
// clipboard boundaries. No browser/PNG decoding or physical scan is claimed.
async function pageHarness(path, { response, fetched = {}, fetcher, render, blobber, imageDecoder } = {}) {
  const source = await readFile(new URL(`../pages/${path}`, import.meta.url), 'utf8')
  const { descriptor, errors } = parse(source)
  assert.deepEqual(errors, [])
  assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: path, id: 'fixture' }).errors, [])
  const compiled = compileScript(descriptor, { id: 'fixture' })
  const calls = { requests: [], renders: [], copies: [], downloads: [] }
  const unmount = []
  const route = vue.reactive({ params: { id: 'fictional-id' } })
  const fetchedData = vue.ref(fetched), pending = vue.ref(false)
  const png = canvas => {
    const b = new Uint8Array(33); b.set([137,80,78,71,13,10,26,10]); b.set([73,72,68,82],12)
    const view = new DataView(b.buffer); view.setUint32(16,canvas.width); view.setUint32(20,canvas.height)
    return new Blob([b],{type:'image/png'})
  }
  const canvas = { width:128, height:128, getContext:()=>({drawImage(){},clearRect(){}}), toBlob: callback => blobber ? blobber(callback,canvas) : callback(png(canvas)) }
  const qr = {
    create: RealQR.create,
    toCanvas: async (_canvas, target, options) => { calls.renders.push(target); if (render) await render(_canvas,target,options); _canvas.width = options.width; _canvas.height = options.width },
  }
  const context = createContext({
    process: { client: true }, Blob, Uint8Array, DataView,
    createImageBitmap: imageDecoder ?? (async b => { const v=new DataView(await b.arrayBuffer());return {width:v.getUint32(16),height:v.getUint32(20),close(){}} }),
    console,
    setTimeout: () => 1, clearTimeout() {},
    document: { createElement: () => canvas, addEventListener() {}, removeEventListener() {} },
    window: { location: { origin: 'https://untrusted-browser.example.invalid' }, setTimeout: () => 1 },
    navigator: { clipboard: { writeText: async (target) => calls.copies.push(target) } },
    useSupabaseClient: () => ({ auth: {} }),
    // Logout is tested in the Auth suite; this harness exercises QR actions.
    useAccountLogout: () => ({ signOut() {}, logoutError: vue.ref(''), logoutBusy: vue.ref(false) }),
    useSupabaseUser: () => vue.ref({ sub: 'fictional-owner' }),
    useRouter: () => ({ currentRoute: vue.ref({ fullPath: '/fictional' }), push() {} }),
    useRoute: () => route,
    useFetch: async () => ({ data: fetchedData, pending, error: vue.ref(null), refresh: async () => {} }),
    $fetch: async (url, options) => {
      calls.requests.push({ url, options })
      return fetcher ? fetcher(url, options) : response
    },
  })
  function mod(exports) {
    return new SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v) }, { context })
  }
  const qrModule = mod({ default: qr })
  await qrModule.link(() => { throw Error('Unexpected QR import') }); await qrModule.evaluate()
  const imports = {
    vue: mod({ ...vue, onMounted() {}, onBeforeUnmount(fn) { unmount.push(fn) }, watch() {}, watchEffect() {}, withAsyncContext: (fn) => [fn(), () => {}] }),
    '~/utils/qr-payload.mjs': mod(payload),
    '~/utils/qr-render.mjs': mod(rendering),
    '~/server/utils/downloadQrPng': mod({ downloadPngBlob: async (...args) => calls.downloads.push(args) }),
    '/server/utils/downloadQrPng': mod({ downloadPngBlob: async (...args) => calls.downloads.push(args) }),
    '~/server/utils/qrToBlob.ts': new SourceTextModule(stripTypeScriptTypes(await readFile(new URL('../server/utils/qrToBlob.ts',import.meta.url),'utf8')), {context}),
  }
  const module = new SourceTextModule(stripTypeScriptTypes(compiled.content), {
    context,
    importModuleDynamically: async (specifier) => { assert.equal(specifier, 'qrcode'); return qrModule },
  })
  await module.link((specifier) => { assert.ok(Object.hasOwn(imports, specifier), `Unexpected import ${specifier}`); return imports[specifier] })
  await module.evaluate()
  const component = module.namespace.default
  const state = await component.setup({}, { expose() {} })
  if (path === 'edit/[id].vue') state.form.value.data = state.qrCode.value.data ?? ''
  return { state, calls, canvas, source, fetchedData, pending, route, makePng: png, unmount: () => unmount.forEach(fn=>fn()) }
}

test('generator drafts do not call creation; saved tracked preview and PNG use authoritative response', async () => {
  const target = 'https://issuer.example.invalid/s/fixture8'
  const h = await pageHarness('generate.vue', { response: { success: true, mode: 'tracked', encodedTarget: target, qrCode: { id: 'fictional-id', data: 'https://example.invalid/a' }, shortUrl: { shortCode: 'fixture8' } } })
  h.state.canvasRef.value = h.canvas
  h.state.content.value = 'https://example.invalid/a'
  h.state.label.value = 'Fictional QR'
  await h.state.renderQr()
  assert.deepEqual(h.calls.renders, ['https://example.invalid/a'])
  assert.equal(h.calls.requests.length, 0)
  assert.match(h.source, /Draft preview/)
  assert.match(h.source, /Saved payload preview/)
  await h.state.saveTrackedQr()
  assert.equal(h.calls.requests.length, 1)
  assert.equal(h.calls.requests[0].options.body.createShortUrl, true)
  await h.state.renderQr()
  assert.equal(h.calls.renders.at(-1), target)
  await h.state.downloadSavedPng()
  assert.equal(h.calls.downloads.length, 1)
  assert.ok(h.calls.renders.slice(1).every((value) => value === target))
})

test('direct generator sends and renders exact content without tracking code or analytics claim', async () => {
  const content = '  Fictional\nDirect payload  '
  const h = await pageHarness('generate.vue', { response: { success: true, mode: 'direct', encodedTarget: content, qrCode: { id: 'direct-id', data: content }, shortUrl: null } })
  h.state.canvasRef.value = h.canvas
  h.state.createShortUrl.value = false
  h.state.content.value = content
  h.state.label.value = 'Direct fixture'
  await h.state.renderQr()
  await h.state.saveTrackedQr()
  assert.equal(h.calls.requests[0].options.body.data, content)
  assert.equal(h.calls.requests[0].options.body.createShortUrl, false)
  assert.equal(h.state.savedShortCode.value, null)
  await h.state.downloadSavedPng()
  assert.ok(h.calls.renders.every((value) => value === content))
  assert.match(h.source, /no server scan analytics/)
})

test('in-flight changes remain draft and cannot download or overwrite a saved destination', async () => {
  let resolve
  const h = await pageHarness('generate.vue', { fetcher: () => new Promise((done) => { resolve = done }) })
  h.state.content.value = 'https://example.invalid/first'
  h.state.label.value = 'Fixture'
  const saving = h.state.saveTrackedQr()
  h.state.content.value = 'https://example.invalid/second'
  resolve({ mode: 'tracked', encodedTarget: 'https://issuer.example.invalid/s/fixture8', qrCode: { id: 'id', data: 'https://example.invalid/first' }, shortUrl: { shortCode: 'fixture8' } })
  await saving
  assert.equal(h.state.isDirtySinceSave.value, true)
  assert.equal(h.state.canDownloadSaved.value, false)
  assert.equal(h.state.previewTarget.value, 'https://example.invalid/second')
  await h.state.saveTrackedQr()
  assert.equal(h.calls.requests.length, 1)
  assert.match(h.state.errorMessage.value, /destination-edit repair/)
})

test('dashboard renders/downloads/copies authoritative target, preserves direct content, blocks unknown host', async () => {
  const tracked = { id: 'tracked', shortUrl: { shortCode: 'unchanged-old-code' }, encodedTarget: 'https://issuer.example.invalid/s/unchanged-old-code', errorLevel: 'M' }
  const direct = { id: 'direct', data: ' exact\n ', errorLevel: 'M' }
  const legacy = { id: 'legacy', data: 'https://example.invalid', shortUrl: { shortCode: 'legacy-code' }, encodedTarget: null }
  const h = await pageHarness('dashboard.vue', { fetched: { qrCodes: [tracked, direct, legacy] } })
  for (const qr of [tracked, direct, legacy]) h.state.setCanvasRef(qr.id, h.canvas)
  await h.state.renderAllQrs()
  assert.deepEqual(h.calls.renders, [tracked.encodedTarget, direct.data])
  await h.state.copyShortLink(tracked)
  assert.deepEqual(h.calls.copies, [tracked.encodedTarget])
  await h.state.downloadQR(tracked)
  assert.equal(h.calls.renders.at(-1), tracked.encodedTarget)
  await h.state.downloadQR(legacy)
  assert.equal(h.calls.downloads.length, 1)
  assert.equal(h.state.getShortLink(legacy), '')
  assert.equal(legacy.shortUrl.shortCode, 'legacy-code')
})

test('edit preview and analytics display/copy consume trusted fields; legacy regeneration unavailable', async () => {
  const target = 'https://issuer.example.invalid/s/fixture8'
  const qr = { id: 'fictional-id', data: 'https://example.invalid', encodedTarget: target, shortUrl: { shortCode: 'fixture8' } }
  const edit = await pageHarness('edit/[id].vue', { fetched: { qrCode: qr } })
  edit.state.canvasRef.value = edit.canvas
  await edit.state.renderPreviewNow()
  assert.deepEqual(edit.calls.renders, [target])
  const analytics = await pageHarness('analytics/[id].vue', { fetched: { qr } })
  assert.equal(analytics.state.publicShortLink.value, target)
  await analytics.state.copyPublicShortLink()
  assert.deepEqual(analytics.calls.copies, [target])
  const legacy = await pageHarness('edit/[id].vue', { fetched: { qrCode: { ...qr, encodedTarget: null } } })
  legacy.state.canvasRef.value = legacy.canvas
  await legacy.state.renderPreviewNow()
  assert.deepEqual(legacy.calls.renders, [])
})

test('consumer source contains no browser-origin tracked construction; edit converter receives a canvas', async () => {
  for (const path of ['generate.vue', 'dashboard.vue', 'edit/[id].vue', 'analytics/[id].vue']) {
    const source = await readFile(new URL(`../pages/${path}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /window\.location\.origin|appOrigin/)
  }
  const edit = await readFile(new URL('../pages/edit/[id].vue', import.meta.url), 'utf8')
  assert.match(edit, /canvasToPngBlob\(canvas\)/)
})

test('dashboard renders persisted reload projection and refuses unknown/incoherent tracked rows', async () => {
  const config = { qrIssuanceOrigin: 'https://issuer.example.invalid', qrIssuanceEnvironment: 'isolated' }
  const persisted = {
    id: 'reloaded', lifecycleStatus: 'active', userId: 'owner', shortUrlId: 'link', data: 'https://destination.example.invalid',
    issuedEncodedTarget: 'https://issuer.example.invalid/s/kept-code', errorLevel: 'M',
    shortUrl: { id: 'link', lifecycleStatus: 'active', userId: 'owner', shortCode: 'kept-code', originalUrl: 'https://destination.example.invalid' },
  }
  const project = row => presentQr(row, 'owner', config, undefined, { nodeEnv: 'test' })
  const rows = [project(persisted), project({ ...persisted, id: 'legacy', issuedEncodedTarget: null }), project({ ...persisted, id: 'inconsistent', shortUrlId: null, shortUrl: null })]
  const h = await pageHarness('dashboard.vue', { fetched: { qrCodes: rows } })
  for (const qr of rows) h.state.setCanvasRef(qr.id, h.canvas)
  await h.state.renderAllQrs()
  assert.deepEqual(h.calls.renders, [persisted.issuedEncodedTarget])
  for (const qr of rows) await h.state.downloadQR(qr)
  assert.equal(h.calls.downloads.length, 1)
  assert.equal(h.calls.renders.at(-1), persisted.issuedEncodedTarget)
})

test('F2 canonical projection renders/downloads/copies with honest notices through saved consumers', async () => {
  const config = { qrIssuanceOrigin: 'https://issuer.example.invalid', qrIssuanceEnvironment: 'isolated', qrLegacyCanonicalRegenEnabled: true, qrLegacyCanonicalCompatibility: 'isolated|https://issuer.example.invalid/s/[code]|same-store-v1' }
  const persisted = { id: 'qr', lifecycleStatus: 'active', userId: 'owner', shortUrlId: 'link', issuedEncodedTarget: null, data: 'https://destination.example.invalid', errorLevel: 'M', shortUrl: { id: 'link', lifecycleStatus: 'active', userId: 'owner', shortCode: 'fixture8', originalUrl: 'https://destination.example.invalid' } }
  const row = presentQr(persisted, 'owner', config, undefined, { nodeEnv: 'test' })
  assert.equal(row.payloadState, 'canonical-regeneration')
  assert.match(payload.savedQrNotice(row), /originally issued QR URL is unknown/)
  const dashboard = await pageHarness('dashboard.vue', { fetched: { qrCodes: [row] } })
  dashboard.state.setCanvasRef(row.id, dashboard.canvas)
  await dashboard.state.renderAllQrs(); await dashboard.state.downloadQR(row); await dashboard.state.copyShortLink(row)
  assert.deepEqual(dashboard.calls.renders, [row.encodedTarget, row.encodedTarget])
  assert.deepEqual(dashboard.calls.copies, [row.encodedTarget]); assert.equal(dashboard.calls.downloads.length, 1)
  const edit = await pageHarness('edit/[id].vue', { fetched: { qrCode: row } })
  edit.state.canvasRef.value = edit.canvas; await edit.state.renderPreviewNow()
  assert.deepEqual(edit.calls.renders, [row.encodedTarget])
  await edit.state.downloadPng()
  assert.equal(edit.calls.downloads.length, 1)
  assert.equal(edit.state.downloadError.value, '')
  const analytics = await pageHarness('analytics/[id].vue', { fetched: { qr: row } })
  await analytics.state.copyPublicShortLink(); assert.deepEqual(analytics.calls.copies, [row.encodedTarget])
  for (const h of [dashboard, edit, analytics]) {
    assert.match(h.source, /Canonical QR regeneration/)
    assert.match(h.source, /savedQrNotice/)
  }
})

test('F2 unavailable decision defeats stale encodedTarget/data and redacted mapping fallbacks', async () => {
  const unavailable = { id: 'qr', mode: 'tracked', data: 'https://destination.example.invalid', shortUrl: null, shortUrlId: null, encodedTarget: 'https://stale.example.invalid/s/fixture8', payloadState: 'unavailable', payloadStatus: 'unavailable' }
  assert.equal(payload.savedQrTarget(unavailable), null)
  assert.match(payload.savedQrNotice(unavailable), /could not be verified/)
  const dashboard = await pageHarness('dashboard.vue', { fetched: { qrCodes: [unavailable] } })
  dashboard.state.setCanvasRef('qr', dashboard.canvas); await dashboard.state.renderAllQrs()
  await dashboard.state.downloadQR(unavailable); await dashboard.state.copyShortLink(unavailable)
  assert.deepEqual(dashboard.calls.renders, []); assert.deepEqual(dashboard.calls.copies, []); assert.deepEqual(dashboard.calls.downloads, [])
  const edit = await pageHarness('edit/[id].vue', { fetched: { qrCode: unavailable } })
  edit.state.canvasRef.value = edit.canvas; await edit.state.renderPreviewNow(); await edit.state.downloadPng()
  assert.deepEqual(edit.calls.renders, []); assert.deepEqual(edit.calls.downloads, [])
  const analytics = await pageHarness('analytics/[id].vue', { fetched: { qr: unavailable } })
  await analytics.state.copyPublicShortLink(); assert.deepEqual(analytics.calls.copies, [])
  const generator = await pageHarness('generate.vue', { response: { ...unavailable, qrCode: { id: 'qr', data: unavailable.data } } })
  generator.state.content.value = unavailable.data; generator.state.label.value = 'Fixture'
  await generator.state.saveTrackedQr(); assert.equal(generator.state.canDownloadSaved.value, false)
})

test('F2 direct and exact decisions remain exact; missing/loading and partial states fail closed', () => {
  for (const payloadState of ['direct-content', 'exact-issued']) {
    const row = { mode: payloadState === 'direct-content' ? 'direct' : 'tracked', payloadState, payloadStatus: 'available', encodedTarget: '  exact\n ' }
    assert.equal(payload.savedQrTarget(row), row.encodedTarget); assert.equal(payload.savedQrNotice(row), '')
  }
  for (const row of [null, undefined, { payloadState: 'unavailable', data: 'stale' }, { payloadStatus: 'available', data: 'stale' }, { payloadState: 'canonical-regeneration', payloadStatus: 'unavailable', encodedTarget: 'stale' }]) {
    assert.equal(payload.savedQrTarget(row), null)
    assert.doesNotMatch(payload.savedQrNotice(row), /verified current Scanlytics/)
  }
})

test('edit consumes committed server result and hides unsaved content preview; PNG uses committed content', async () => {
  const old = { id:'qr', title:'Old', data:'old', mode:'direct', payloadState:'direct-content', payloadStatus:'available', encodedTarget:'old' }
  const saved = { ...old, data:'  Exact\nnew  ', encodedTarget:'  Exact\nnew  ', title:'Updated' }
  const h = await pageHarness('edit/[id].vue', { fetched:{qrCode:old}, response:{success:true,qrCode:saved} })
  h.state.form.value = { title:'Updated', data:saved.data, description:'', size:300, fgColor:'#000000', bgColor:'#FFFFFF', errorLevel:'M' }
  h.state.canvasRef.value = h.canvas
  await h.state.renderPreviewNow(); assert.equal(h.calls.renders.length,0); assert.equal(h.state.renderedTarget.value,null)
  await h.state.saveChanges(); assert.equal(h.calls.requests[0].options.body.data,saved.data)
  assert.equal(h.state.qrCode.value.data,saved.data); assert.equal(h.state.qrCode.value.encodedTarget,saved.data)
  await h.state.renderPreviewNow(); assert.equal(h.calls.renders.at(-1),saved.data); assert.equal(h.state.renderedTarget.value,h.state.previewFingerprint.value)
  await h.state.downloadPng(); assert.equal(h.calls.downloads.length,1)
})

// Phase 2B.1: action boundaries use real compiled setup; canvas pixels are mocked here.
const issued = { id:'fictional-id', title:'Fixture', data:'https://destination.example.invalid', mode:'tracked', payloadState:'exact-issued', payloadStatus:'available', encodedTarget:'https://issuer.example.invalid/s/fixture8', size:320, errorLevel:'M', fgColor:'#000000', bgColor:'#ffffff' }
for (const path of ['generate.vue','edit/[id].vue','dashboard.vue']) {
  async function setup(options={}) {
    const h = await pageHarness(path,{ response:{ ...issued, qrCode:issued,shortUrl:{shortCode:'fixture8'} },fetched:path==='dashboard.vue'?{qrCodes:[{...issued}]}:{qrCode:{...issued}},...options })
    h.state.canvasRef && (h.state.canvasRef.value=h.canvas)
    if (path==='generate.vue') { h.state.content.value=issued.data; h.state.label.value='Fixture'; await h.state.saveTrackedQr() }
    const action = () => path==='generate.vue'?h.state.downloadSavedPng():path==='dashboard.vue'?h.state.downloadQR(h.state.qrCodes.value[0]):h.state.downloadPng()
    return {...h,action}
  }
  test(`${path}: duplicate clicks produce one export`,async()=>{
    let done; const h=await setup({render:()=>new Promise(r=>{done=r})})
    const first=h.action(); await new Promise(r=>setImmediate(r)); await h.action(); done(); await first
    assert.equal(h.calls.downloads.length,1)
  })
  for (const mutation of ['content','styling','unavailable','record','loading','unmount']) {
    test(`${path}: cancels pending PNG after ${mutation} change`,async()=>{
      // A valid mock blob is supplied after mutation; cancellation must come from state, not invalid PNG.
      let finish
      const g=await setup({render:()=>new Promise(r=>{finish=r})})
      const task=g.action(); await new Promise(r=>setImmediate(r))
      if(mutation==='unmount') g.unmount()
      else if(path==='generate.vue') {
        if(mutation==='styling') g.state.size.value=512
        else if(mutation==='unavailable') g.state.savedEncodedTarget.value=null
        else if(mutation==='loading') g.state.isSaving.value=true
        else if(mutation==='record') g.state.savedQrId.value='another'
        else g.state.content.value='changed'
      } else if(path==='dashboard.vue') {
        if(mutation==='loading') g.pending.value=true
        else { const row=g.state.qrCodes.value[0]; if(mutation==='unavailable') row.payloadState='unavailable'; else if(mutation==='styling') row.size=512; else if(mutation==='record') g.fetchedData.value={qrCodes:[]}; else row.encodedTarget='changed' }
      } else {
        if(mutation==='loading') g.pending.value=true
        else if(mutation==='record') g.route.params.id='another'
        else if(mutation==='unavailable') g.fetchedData.value.qrCode.payloadState='unavailable'
        else if(mutation==='styling') g.state.form.value.size=512
        else g.state.form.value.data='changed'
      }
      finish(); await task; assert.equal(g.calls.downloads.length,0)
    })
  }
  for(const failure of ['throw','null','empty','bad-signature','wrong-size','missing-api']) {
    test(`${path}: PNG ${failure} is not success`,async()=>{
      const h=await setup({blobber:(cb,canvas)=>{
        if(failure==='throw') throw Error('fictional failure')
        if(failure==='null') return cb(null)
        if(failure==='empty') return cb(new Blob([],{type:'image/png'}))
        const b=new Uint8Array(33)
        if(failure==='wrong-size'){b.set([137,80,78,71,13,10,26,10]);b.set([73,72,68,82],12)}
        cb(new Blob([b],{type:'image/png'}))
      }})
      if(failure==='missing-api') h.canvas.toBlob=undefined
      await h.action(); assert.equal(h.calls.downloads.length,0)
    })
  }
}
test('renderer validates settings, preserves supported sizes/colors/ECL and refuses capacity overflow',async()=>{
  for(const errorLevel of ['L','M','Q','H']) for(const size of [128,320,1024]) {
    const options=rendering.qrRenderOptions({size,errorLevel,fgColor:'#123',bgColor:'#ffffff',margin:0})
    assert.equal(options.width,size); assert.equal(options.margin,4); assert.equal(options.errorCorrectionLevel,errorLevel)
  }
  for(const settings of [{size:127},{size:1025},{errorLevel:'X'},{fgColor:'bad'},{bgColor:'#ffffff00'}]) assert.throws(()=>rendering.qrRenderOptions(settings))
  await assert.rejects(rendering.renderQrCanvas(RealQR,{getContext(){}},'x'.repeat(4000),{errorLevel:'H'}))
  await assert.rejects(rendering.renderQrCanvas(RealQR,{getContext(){}},'x'.repeat(1800),{size:128,errorLevel:'L'}),/larger QR size/)
  await assert.rejects(rendering.renderQrCanvas(RealQR,{},'content',{}))
})
test('generator consumes unavailable server styling-save decision instead of retaining old issuance',async()=>{
  let n=0
  const h=await pageHarness('generate.vue',{fetcher:()=>++n===1?{...issued,qrCode:issued,shortUrl:{shortCode:'fixture8'}}:{qrCode:{...issued,payloadState:'unavailable',payloadStatus:'unavailable'}}})
  h.state.content.value=issued.data; h.state.label.value='Fixture'; await h.state.saveTrackedQr()
  h.state.size.value=512; await h.state.saveTrackedQr(); await h.state.downloadSavedPng()
  assert.equal(h.state.savedEncodedTarget.value,null); assert.equal(h.calls.downloads.length,0)
})
test('generator reset during save discards late server response',async()=>{
  let finish; const h=await pageHarness('generate.vue',{fetcher:()=>new Promise(r=>{finish=r})})
  h.state.content.value=issued.data; h.state.label.value='Fixture'; const task=h.state.saveTrackedQr()
  h.state.resetToDefaults(); finish({...issued,qrCode:issued,shortUrl:{shortCode:'fixture8'}}); await task
  assert.equal(h.state.savedQrId.value,null); assert.equal(h.state.canDownloadSaved.value,false)
})

for(const path of ['generate.vue','edit/[id].vue','dashboard.vue']) {
  test(`${path}: target change during toBlob cancels otherwise valid PNG`,async()=>{
    let finish
    const h=await pageHarness(path,{ response:{...issued,qrCode:issued,shortUrl:{shortCode:'fixture8'}},fetched:path==='dashboard.vue'?{qrCodes:[{...issued}]}:{qrCode:{...issued}},blobber:(cb,canvas)=>{finish=()=>cb(h.makePng(canvas))} })
    if(path==='generate.vue') { h.state.content.value=issued.data; h.state.label.value='Fixture'; await h.state.saveTrackedQr() }
    const task=path==='generate.vue'?h.state.downloadSavedPng():path==='dashboard.vue'?h.state.downloadQR(issued):h.state.downloadPng()
    await new Promise(r=>setImmediate(r))
    if(path==='generate.vue') h.state.content.value='changed'
    else if(path==='dashboard.vue') h.fetchedData.value={qrCodes:[]}
    else h.state.form.value.data='changed'
    finish();await task;assert.equal(h.calls.downloads.length,0)
  })
}
test('saved copy actions refuse loading and replaced unavailable projections',async()=>{
  const row={...issued,shortUrl:{shortCode:'fixture8'}}
  const dashboard=await pageHarness('dashboard.vue',{fetched:{qrCodes:[row]}})
  dashboard.pending.value=true;await dashboard.state.copyShortLink(row)
  dashboard.pending.value=false;dashboard.fetchedData.value={qrCodes:[{...row,payloadState:'unavailable'}]};await dashboard.state.copyShortLink(row)
  assert.equal(dashboard.calls.copies.length,0)
  const analytics=await pageHarness('analytics/[id].vue',{fetched:{qr:row}})
  analytics.pending.value=true;await analytics.state.copyPublicShortLink();assert.equal(analytics.calls.copies.length,0)
})

test('browser PNG decode failure refuses all three compiled export actions',async()=>{
  for(const path of ['generate.vue','edit/[id].vue','dashboard.vue']) {
    const h=await pageHarness(path,{response:{...issued,qrCode:issued,shortUrl:{shortCode:'fixture8'}},fetched:path==='dashboard.vue'?{qrCodes:[issued]}:{qrCode:issued},imageDecoder:async()=>{throw Error('fictional truncated image')}})
    if(path==='generate.vue'){h.state.content.value=issued.data;h.state.label.value='Fixture';await h.state.saveTrackedQr();await h.state.downloadSavedPng()}
    else if(path==='edit/[id].vue')await h.state.downloadPng();else await h.state.downloadQR(issued)
    assert.equal(h.calls.downloads.length,0)
  }
})
test('real download helper rechecks freshness after asynchronous mobile share failure',async()=>{
  let current=true, clicked=false
  const context=createContext({File,URL:{createObjectURL(){clicked=true;return 'blob:fictional'},revokeObjectURL(){}},setTimeout(){},navigator:{userAgent:'Android',canShare:()=>true,share:async()=>{current=false;throw Error('fictional share failure')}},window:{},document:{}})
  const module=new SourceTextModule(stripTypeScriptTypes(await readFile(new URL('../server/utils/downloadQrPng.ts',import.meta.url),'utf8')),{context,initializeImportMeta:meta=>{meta.client=true}})
  await module.link(()=>{throw Error('unexpected import')});await module.evaluate()
  await assert.rejects(module.namespace.downloadPngBlob(new Blob(['fixture'],{type:'image/png'}),{filename:'fixture.png',isCurrent:()=>current}),/changed/)
  assert.equal(clicked,false)
})

test('dashboard lifecycle projection removes moved cards, preserves analytics and moves keyboard focus',async()=>{
  const row={...issued,lifecycleStatus:'active',analytics:[{id:'history'}]}
  const h=await pageHarness('dashboard.vue',{fetched:{qrCodes:[row],stats:{totalQRCodes:1}}})
  let focused=0;h.state.lifecycleSelect.value={focus(){focused++}}
  await h.state.applyLifecycle({...row,lifecycleStatus:'archived'})
  assert.equal(h.state.qrCodes.value.length,0);assert.equal(focused,1)
  assert.match(h.state.lifecycleMessage.value,/archived/)
  h.state.lifecycleFilter.value='archived';h.fetchedData.value={qrCodes:[{...row,lifecycleStatus:'archived'}]}
  assert.equal(h.state.qrCodes.value.length,1)
  await h.state.applyLifecycle({...row,lifecycleStatus:'active'})
  assert.equal(h.state.qrCodes.value.length,0)
})
test('dashboard/edit retired targets cannot export or save, including stale available payloads',async()=>{
  const row={...issued,lifecycleStatus:'retired',shortUrl:{shortCode:'fixture8'}}
  for(const path of ['dashboard.vue','edit/[id].vue']){
    const h=await pageHarness(path,{fetched:path==='dashboard.vue'?{qrCodes:[row]}:{qrCode:row}})
    if(path==='dashboard.vue'){h.state.lifecycleFilter.value='retired';await h.state.downloadQR(row);assert.equal(h.state.getShortLink(row),'')}
    else{await h.state.downloadPng();await h.state.saveChanges()}
    assert.equal(h.calls.downloads.length,0);assert.equal(h.calls.requests.length,0)
  }
})
test('lifecycle in flight invalidates dashboard/edit pending PNG deliveries',async()=>{
  for(const path of ['dashboard.vue','edit/[id].vue']){
    let finish;const row={...issued,lifecycleStatus:'active'}
    const h=await pageHarness(path,{fetched:path==='dashboard.vue'?{qrCodes:[row]}:{qrCode:row},blobber:(cb,canvas)=>{finish=()=>cb(h.makePng(canvas))}})
    const action=path==='dashboard.vue'?h.state.downloadQR(row):h.state.downloadPng()
    while(!finish)await new Promise(r=>setImmediate(r))
    if(path==='dashboard.vue')h.state.setLifecycleBusy(row.id,true);else h.state.lifecycleBusy.value=true
    finish();await action;assert.equal(h.calls.downloads.length,0)
  }
})

async function lifecycleComponent({status='active',fetcher,disabled=false}={}){
  const path='../components/QrLifecycleActions.vue',source=await readFile(new URL(path,import.meta.url),'utf8'),{descriptor,errors}=parse(source)
  assert.deepEqual(errors,[]);assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:path,id:'lifecycle-fixture'}).errors,[])
  const calls=[],events=[],unmount=[],props=vue.reactive({qr:{id:'fixture',title:'Fictional',lifecycleStatus:status},disabled})
  const context=createContext({$fetch:async(...args)=>{calls.push(args);return fetcher?fetcher(...args):{qrCode:{...props.qr,lifecycleStatus:args[1].body.status}}}})
  const imports=new SyntheticModule(Object.keys(vue),function(){for(const[k,v]of Object.entries(vue))this.setExport(k,k==='onBeforeUnmount'?fn=>unmount.push(fn):v)},{context})
  const module=new SourceTextModule(compileScript(descriptor,{id:'lifecycle-fixture'}).content,{context});await module.link(()=>imports);await module.evaluate()
  const state=module.namespace.default.setup(props,{emit:(...args)=>events.push(args),expose(){}})
  let opens=0,closes=0;state.retireDialog.value={showModal(){opens++},close(){closes++}}
  return {state,calls,events,props,opens:()=>opens,closes:()=>closes,unmount:()=>unmount.forEach(fn=>fn())}
}
test('compiled lifecycle control requires confirmation before retirement and uses authoritative response',async()=>{
  const h=await lifecycleComponent();h.state.openRetire({currentTarget:{focus(){}}});assert.equal(h.opens(),1);assert.equal(h.calls.length,0)
  await h.state.confirmRetire();assert.equal(h.closes(),1);assert.equal(h.calls[0][0],'/api/qr/fixture/lifecycle');assert.equal(h.calls[0][1].body.status,'retired')
  assert.equal(h.events.find(x=>x[0]==='changed')[1].lifecycleStatus,'retired')
})
test('compiled lifecycle controls block duplicates, disabled and retired operations',async()=>{
  let finish;const h=await lifecycleComponent({fetcher:()=>new Promise(r=>finish=r)})
  const first=h.state.changeStatus('archived');await h.state.changeStatus('retired');assert.equal(h.calls.length,1)
  finish({qrCode:{id:'fixture',lifecycleStatus:'archived'}});await first
  for(const options of [{status:'retired'},{disabled:true}]){const blocked=await lifecycleComponent(options);await blocked.state.changeStatus('active');blocked.state.openRetire({currentTarget:{}});assert.equal(blocked.calls.length,0);assert.equal(blocked.opens(),0)}
})
test('compiled lifecycle failure reloads and unmounted responses cannot replace current records',async()=>{
  const failed=await lifecycleComponent({fetcher:()=>{throw Error('fictional')}});await failed.state.changeStatus('retired');assert.ok(failed.events.some(x=>x[0]==='reload'));assert.ok(!failed.events.some(x=>x[0]==='changed'))
  let finish;const stale=await lifecycleComponent({fetcher:()=>new Promise(r=>finish=r)}),pending=stale.state.changeStatus('retired');stale.unmount();finish({qrCode:{id:'fixture',lifecycleStatus:'retired'}});await pending;assert.ok(!stale.events.some(x=>x[0]==='changed'))
})
