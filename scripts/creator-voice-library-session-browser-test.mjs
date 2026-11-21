import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url), playwright=process.env.VELTO_TEST_PLAYWRIGHT_MODULE;
assert(playwright,'Use an already installed Playwright module; never acquire a browser');
const {chromium}=await import(pathToFileURL(playwright).href), {webpack}=require('next/dist/compiled/webpack/webpack');
const root=process.cwd(),out=fs.mkdtempSync(path.join(os.tmpdir(),'velto-voice-session-browser-'));fs.chmodSync(out,0o700);
const compiler=webpack({mode:'none',target:'web',context:root,entry:'./scripts/fixtures/creator-voice-library-session-ui.tsx',output:{path:out,filename:'session.js'},devtool:false,resolve:{extensions:['.ts','.tsx','.js','.mjs'],alias:{'@':root}},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:[path.join(root,'scripts/fixtures/typescript-browser-loader.mjs')]}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})],optimization:{minimize:false},performance:false});
const stats=await new Promise((resolve,reject)=>compiler.run((e,s)=>e?reject(e):resolve(s)));await new Promise((resolve,reject)=>compiler.close(e=>e?reject(e):resolve()));assert.equal(stats.hasErrors(),false,stats.toString({errors:true,warnings:false}));fs.chmodSync(path.join(out,'session.js'),0o600);
let origin;
const server=http.createServer((req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'");
 if(req.method!=='GET'||req.headers.host!==new URL(origin).host){res.writeHead(403).end();return;}
 if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Synthetic voice session</title><div id="root"></div><script src="/session.js"></script></html>');return;}
 if(req.url==='/session.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'}).end(fs.readFileSync(path.join(out,'session.js')));return;}
 res.writeHead(404).end();
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen({host:'127.0.0.1',port:0,exclusive:true},resolve);});origin=`http://127.0.0.1:${server.address().port}`;
let browser, activePage;
try{
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--disable-background-networking','--disable-component-update','--no-first-run']});
 const context=await browser.newContext();let unexpected=0;
 await context.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();unexpected++;return route.abort();});
 await context.addInitScript(()=>{
  const selection=n=>({voiceId:`stored-${n}`,name:`Stored ${n}`,source:'available',selectedAt:'2026-01-01T00:00:00Z'});
  localStorage.setItem('velto:creator-voice-library:favorites',JSON.stringify(Array.from({length:60},(_,n)=>selection(n))));
  localStorage.setItem('velto:creator-voice-library:recents',JSON.stringify(Array.from({length:25},(_,n)=>selection(n))));
 });
 const page=await context.newPage(),errors=[];activePage=page;page.on('pageerror',e=>errors.push(e.message));await page.goto(origin,{waitUntil:'networkidle'});
 const test=()=>page.evaluate(()=>({reads:window.__voiceSessionTest.reads,applies:window.__voiceSessionTest.applies,clears:window.__voiceSessionTest.clears}));
 assert.equal((await test()).reads.length,0,'closed mounted session must not fetch');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('velto:creator-voice-library:favorites')).length),50);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('velto:creator-voice-library:recents')).length),20);
 const dialog=page.getByRole('dialog'),open=async scope=>{await page.getByRole('button',{name:'Open '+scope,exact:true}).click();await dialog.waitFor({state:'visible'});await dialog.locator('article').first().waitFor();};
 const click=async name=>dialog.getByRole('button',{name,exact:true}).click();
 await open('scene_narrator');assert.equal((await test()).reads.length,1);assert.equal((await test()).reads[0].language,'en');
 await page.getByRole('button',{name:'Rerender 0',exact:true}).click();assert.equal((await test()).reads.length,1,'parent rerender must not refetch');
 await click('Favorites');assert.equal(await dialog.locator('article').count(),50);await click('Recent');assert.equal(await dialog.locator('article').count(),20);await click('My & default voices');
 const search=dialog.getByPlaceholder('Search name or style');await search.fill('voice 1');assert.equal((await test()).reads.length,2,'typing filters is local until explicit load');await search.fill('');
 for(let n=0;n<4;n++)await click('Load more voices');assert.equal(await dialog.locator('article').count(),100,'catalog retains at most 100 distinct voices');
 await dialog.getByRole('button',{name:'Preview',exact:true}).first().click();await dialog.getByRole('button',{name:'Preview',exact:true}).first().click();
 await page.evaluate(()=>window.__voiceSessionTest.audio[0].onended());assert.equal(await dialog.getByRole('button',{name:'Stop preview',exact:true}).count(),1,'late old audio event cannot clear replacement preview');
 await click('Close voice library');assert(await page.evaluate(()=>window.__voiceSessionTest.audio.every(a=>a.paused)));
 await open('scene_dialogue');await search.fill('defer');await click('Apply filters');await page.waitForFunction(()=>window.__voiceSessionTest.pendingReads.length===1);
 await click('Close voice library');await open('project_narrator');await page.evaluate(()=>window.__voiceSessionTest.pendingReads.shift()());await page.waitForTimeout(25);assert.equal(await dialog.getByText('Obsolete catalog voice',{exact:true}).count(),0);
 await search.fill('failure');await click('Apply filters');await dialog.getByText('Synthetic catalog failure',{exact:true}).waitFor();await search.fill('');await click('Apply filters');
 await page.evaluate(()=>{window.__voiceSessionTest.holdApply=true;});await dialog.getByRole('button',{name:'Use voice',exact:true}).first().click();await page.waitForFunction(()=>window.__voiceSessionTest.pendingApplies.length===1);
 await click('Close voice library');await open('character');const recentsBefore=await page.evaluate(()=>localStorage.getItem('velto:creator-voice-library:recents'));await page.evaluate(()=>window.__voiceSessionTest.pendingApplies.shift()());await page.waitForTimeout(25);assert.equal(await dialog.isVisible(),true);assert.equal(await page.evaluate(()=>localStorage.getItem('velto:creator-voice-library:recents')),recentsBefore,'old apply cannot update recents or close new session');
 await page.evaluate(()=>{window.__voiceSessionTest.holdApply=false;window.__voiceSessionTest.failApply=true;});await dialog.getByRole('button',{name:'Use voice',exact:true}).first().click();await dialog.getByText('Synthetic apply failure',{exact:true}).waitFor();
 await page.evaluate(()=>{window.__voiceSessionTest.failApply=false;});await dialog.getByRole('button',{name:'Use voice',exact:true}).first().click();await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('velto:creator-voice-library:recents'))[0].voiceId),'synthetic-0');
 for(const scope of ['project_narrator','project_dialogue','scene_narrator','scene_dialogue','character']){await open(scope);await click('Use inherited default');await dialog.waitFor({state:'hidden'});}assert.equal((await test()).clears.length,5);
 await open('project_narrator');await page.getByRole('button',{name:'Toggle language',exact:true}).click();await page.getByRole('dialog',{name:'Ses kütüphanesi'}).waitFor();await page.getByRole('button',{name:'Ses kütüphanesini kapat',exact:true}).focus();await page.keyboard.press('Enter');await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Toggle language',exact:true}).click();await open('project_narrator');await dialog.getByRole('button',{name:'Preview',exact:true}).first().click();await page.getByRole('button',{name:'Toggle mount',exact:true}).click();assert(await page.evaluate(()=>window.__voiceSessionTest.audio.every(a=>a.paused)));
 await page.getByRole('button',{name:'Toggle mount',exact:true}).click();await open('project_narrator');await click('Recent');assert.equal(await dialog.locator('article').count(),20);
 const denied=await browser.newContext();
 await denied.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();unexpected++;return route.abort();});
 await denied.addInitScript(()=>{Object.defineProperty(Storage.prototype,'getItem',{value:()=>{throw new Error('Synthetic storage unavailable');}});Object.defineProperty(Storage.prototype,'setItem',{value:()=>{throw new Error('Synthetic storage unavailable');}});});
 const deniedPage=await denied.newPage();deniedPage.on('pageerror',error=>errors.push(error.message));await deniedPage.goto(origin,{waitUntil:'networkidle'});await deniedPage.getByRole('button',{name:'Open project_narrator',exact:true}).click();await deniedPage.getByRole('dialog').locator('article').first().waitFor();await denied.close();
 assert.deepEqual(errors,[]);assert.equal(unexpected,0);await page.screenshot({path:path.join(out,'session.png'),fullPage:true});fs.chmodSync(path.join(out,'session.png'),0o600);
 console.log('VOICE_SESSION_MOUNTED_CHROMIUM=PASS; real React StrictMode/session/18 states/4 effects; synthetic catalog/apply/audio; no live project or provider');console.log('PRIVATE_BROWSER_EVIDENCE='+out);
}catch(error){
 if(activePage){fs.writeFileSync(path.join(out,'failure.html'),await activePage.content(),{mode:0o600});await activePage.screenshot({path:path.join(out,'failure.png'),fullPage:true});console.error('PRIVATE_FAILURE_EVIDENCE='+out);}
 throw error;
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
