import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createIntegratedFixture} from './fixtures/creator-integrated-workflow.mjs';
import {geopoliticalTestProposal} from './fixtures/creator-geopolitical-fiction-draft.mjs';

// Explicit offline test only: no normal Chrome profile, credentials or app
// service. All browser requests are restricted to this temporary loopback host.
const require=createRequire(import.meta.url);
const playwright=process.env.VELTO_TEST_PLAYWRIGHT_MODULE;
assert(playwright,'Use an already installed Playwright module; do not acquire a browser');
const {chromium}=await import(pathToFileURL(playwright).href);
const {webpack}=require('next/dist/compiled/webpack/webpack');
const root=path.dirname(path.dirname(new URL(import.meta.url).pathname));
const out=fs.mkdtempSync(path.join(os.tmpdir(),'velto-integrated-browser-'));fs.chmodSync(out,0o700);
const compiler=webpack({mode:'none',target:'web',context:root,entry:'./scripts/fixtures/creator-script-quality-browser-ui.tsx',output:{path:out,filename:'workflow.js'},devtool:false,resolve:{extensions:['.ts','.tsx','.js','.mjs'],alias:{'@':root}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:[path.join(root,'scripts/fixtures/typescript-browser-loader.mjs')]}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('production'),'process.env.NEXT_PUBLIC_VERCEL_ENV':JSON.stringify('development'),'process.env.NEXT_PUBLIC_CREATOR_SCRIPT_FULL_REFINEMENT_PREVIEW_ENABLED':JSON.stringify('false')})],optimization:{minimize:false},performance:false});
const stats=await new Promise((resolve,reject)=>compiler.run((e,s)=>e?reject(e):resolve(s)));await new Promise((resolve,reject)=>compiler.close(e=>e?reject(e):resolve()));
assert.equal(stats.hasErrors(),false,stats.toString({errors:true,warnings:false}));
fs.chmodSync(path.join(out,'workflow.js'),0o600);
const duration=Number(process.env.VELTO_TEST_DURATION_SEC||540);assert([540,600,720].includes(duration));
const fixture=await createIntegratedFixture({targetDurationSec:duration,scriptProvider:geopoliticalTestProposal});
let origin,unexpected=0;
const server=http.createServer(async(req,res)=>{
 try{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
  if(req.headers.host!==new URL(origin).host){res.writeHead(403).end();return;}
  if(req.url==='/api/creator-script-build' && req.method==='POST'){
   if(req.headers.origin!==origin || req.headers['sec-fetch-site']!=='same-origin'){res.writeHead(403).end();return;}
   const parts=[];let n=0;for await(const chunk of req){n+=chunk.length;if(n>16384){res.writeHead(413).end();return;}parts.push(chunk);}
   const response=await fixture.api.post(new Request(origin+req.url,{method:'POST',headers:{authorization:req.headers.authorization||'','content-type':'application/json'},body:Buffer.concat(parts)}));
   res.writeHead(response.status,{'Content-Type':'application/json'}).end(JSON.stringify(response.body));return;
  }
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><html lang="en"><title>CreatorLab isolated workflow test</title><div id="root"></div><script src="/workflow.js"></script></html>');return;}
  if(req.url==='/workflow.js'){res.writeHead(200,{'Content-Type':'text/javascript'}).end(fs.readFileSync(path.join(out,'workflow.js')));return;}
  if(req.url==='/fixture.json'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({projectId:fixture.project.id,expectedProjectUpdatedAt:fixture.project.updated_at,strategyFingerprint:fixture.snapshot.strategyFingerprint}));return;}
  res.writeHead(404).end();
 }catch{res.writeHead(500).end();}
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:0,exclusive:true},resolve);});origin=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 const context=await browser.newContext();
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();unexpected++;return route.abort();});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Review research and build test draft'}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor({state:'visible'});
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
 assert.equal(fixture.calls.generation,0,'Escape must stop without approval');
 await page.getByRole('button',{name:'Review research and build test draft'}).click();
 await dialog.waitFor({state:'visible'});

 assert.equal(fixture.calls.generation,0);
 assert.equal(await dialog.locator('fieldset').count(),14);
 const approve=dialog.getByRole('button',{name:'Approve reviewed research & preview script draft'});
 assert.equal(await approve.isDisabled(),true);
 await dialog.getByRole('checkbox',{name:`Use the five-section fictional geopolitical story (2055–2075), ${duration} seconds`,exact:true}).check();
 assert.equal(await dialog.locator('ol li').count(),5);
 await dialog.getByRole('textbox',{name:'Editorial review rationale'}).fill('Synthetic fixture review only: dated starting facts stay separate from explicit fiction.');
 assert.equal(await approve.isDisabled(),true,'rationale alone never grants approval');
 await dialog.getByRole('checkbox',{name:'I have inspected the claims, passages, scope and fiction labels and approve this draft scope.',exact:true}).check();
 assert.equal(await approve.isEnabled(),true);
 await approve.click();
  const editor=page.locator('[data-sq8h-real-component="true"] [data-creator-script-document="continuous"]');
  await editor.waitFor({state:'visible'});
  await page.waitForFunction(()=>Boolean(window.__sq8h));
  const state=()=>page.evaluate(()=>window.__sq8h.current());
  const snapshot=await state();
  const first=snapshot.script.sections[0].text;
  const original=await editor.inputValue();
  assert(original.includes(first),'canonical editor must contain the actual opening');
  assert.equal(snapshot.script.revision>=1,true);
  console.log('8H_A_OPEN_EXISTING_SYNTHETIC_SCRIPT=PASS');

  const edited=original.replace(first,first+' Chrome8HManualChange');
  await editor.fill(edited);
  assert.equal(await editor.inputValue(),edited);
  await page.getByRole('button',{name:'Save Script Changes'}).click();
  await page.waitForFunction(()=>window.__sq8h.current().script.revision>1);
  let saved=await state();
  assert.equal(saved.script.revision,snapshot.script.revision+1);
  assert(saved.script.sections[0].text.includes('Chrome8HManualChange'));
  assert.equal(saved.revisionHistory.length,1);
  assert.equal(await page.locator('[data-sq8h-status]').innerText(),'SYNTHETIC_MANUAL_SAVE_CONFIRMED');
  console.log('8H_B_MANUAL_SAVE_AND_REVISION=PASS');

  const prompt=page.locator('[data-creator-refinement-prompt="iterative"]');
  const preview=page.locator('[data-creator-refinement-action="preview"]');
  const instruction='Shorten the opening paragraph for clarity.';
  await prompt.fill(instruction);
  await preview.click();
  await page.waitForFunction(()=>Boolean(window.__sq8h.pending()));
  let pending=await page.evaluate(()=>window.__sq8h.pending());
  let lastRequest=await page.evaluate(()=>window.__sq8h.requests().at(-1));
  assert(['opening','selection'].includes(lastRequest.scope),'focused opening must not route to whole script');
  assert.equal(lastRequest.mode,'focused_edit');
  assert.equal(pending.baseRevision,saved.script.revision);
  const region=page.getByRole('region',{name:'Refinement preview'});
  await region.waitFor({state:'visible'});
  console.log('8H_C_REFINEMENT_ROUTE_AND_PREVIEW=PASS');

  await region.getByRole('button',{name:/discard/i}).click();
  await region.waitFor({state:'hidden'});
  assert.equal((await state()).script.revision,saved.script.revision);
  assert.equal((await state()).revisionHistory.length,1);
  console.log('8H_D_DISCARD_PRESERVATION=PASS');

  await prompt.fill(instruction);
  await preview.click();
  await region.waitFor({state:'visible'});
  await region.getByRole('button',{name:/apply/i}).click();
  await region.waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.__sq8h.current().script.revision>2);
  saved=await state();
  assert.equal(saved.script.revision,snapshot.script.revision+2);
  assert.equal(saved.revisionHistory.length,2);
  assert(saved.script.sections[0].text.includes('Synthetic opening refinement verified in Chrome.'));
  assert.equal(await page.locator('[data-creator-script-revision-history]').count(),1);
  console.log('8H_E_APPLY_AND_HISTORY=PASS');

  await page.reload({waitUntil:'networkidle'});
  await page.locator('[data-sq8h-real-component="true"]').waitFor();
  await page.waitForFunction(()=>Boolean(window.__sq8h));
  assert.equal((await state()).script.revision,saved.script.revision);
  assert.equal((await state()).revisionHistory.length,2);
  assert((await editor.inputValue()).includes('Synthetic opening refinement verified in Chrome.'));
  console.log('8H_F_SYNTHETIC_RELOAD_PRESERVES_HISTORY=PASS');

  const stable=await state();
  await page.evaluate(()=>window.__sq8h.failNextSave());
  const documentBeforeFailure=await editor.inputValue();
  await editor.fill(documentBeforeFailure.replace(stable.script.sections[0].text,
    stable.script.sections[0].text+' Chrome8HUnsavedChange'));
  await page.getByRole('button',{name:'Save Script Changes'}).click();
  await page.getByText('SIMULATED_SAVE_FAILURE',{exact:true}).waitFor();
  assert.equal((await state()).script.revision,stable.script.revision);
  assert((await editor.inputValue()).includes('Chrome8HUnsavedChange'));
  assert(await page.getByText('Unsaved script changes',{exact:true}).isVisible());
  console.log('8H_G_FAILED_SAVE_PRESERVES_UNSAVED_EDITOR=PASS');

  await page.reload({waitUntil:'networkidle'});
  await editor.waitFor({state:'visible'});
  assert.equal((await state()).script.revision,stable.script.revision);
  assert.equal((await state()).revisionHistory.length,2);
  assert(!(await editor.inputValue()).includes('Chrome8HUnsavedChange'));
  assert.deepEqual(errors,[]);
  assert.equal(unexpected,0,'no external browser requests are allowed');
  console.log('8H_H_FAILED_SAVE_DOES_NOT_PERSIST_FALSE_SUCCESS=PASS');
  console.log('SCRIPT_QUALITY_CHROME_SCENARIOS=8/8_PASS');
  console.log('SCRIPT_QUALITY_REAL_REACT_COMPONENT=PASS');
  console.log('SCRIPT_QUALITY_PERSISTENCE=ISOLATED_LOCALSTORAGE_FIXTURE_ONLY');
  console.log('SCRIPT_QUALITY_REAL_AUTH_DB_UAT=NOT_RUN');
  console.log('PRIVATE_BROWSER_EVIDENCE='+out);
}finally{
  await browser?.close();await new Promise(resolve=>server.close(resolve));
}
