// Supplemental fail-closed diagnostics. This does not replace the native
// calculation acceptance suite or attest a Python/container runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {
 scientificSha256,scientificCalculationFail,validateScientificCalculationRequest,
 validateScientificContainerRuntimeManifest,buildScientificContainerInvocation,
} from '../lib/creator/scientificReview/index.ts';

const runnerUrl=new URL('../lib/creator/scientificReview/calculationRunner.ts',import.meta.url);
const manifestUrl=new URL('../lib/creator/scientificReview/scientificComputeRuntime.v1.json',import.meta.url);
const bytes=fs.readFileSync(manifestUrl);const manifest=JSON.parse(bytes);
const source=fs.readFileSync(runnerUrl,'utf8');
const ast=ts.createSourceFile('calculationRunner.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
// Execute the actual private loader, retaining its pinned constants and checks.
// Only OS reads are supplied; dispatch and artifact writes are forbidden.
const declarations=ast.statements.filter(n=>!ts.isImportDeclaration(n)).map(n=>n.getFullText(ast)).join('\n').replaceAll('import.meta.url',JSON.stringify(runnerUrl.href));
const compiled=ts.transpileModule(declarations,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let dispatches=0,writes=0;
async function checkLoader({manifestBytes=bytes,binary=Buffer.from('unattested-python-executable'),symlink=false,missing=false}={}){
 const exported={};
 const context={exports:exported,Buffer,Error,structuredClone,path,fileURLToPath,process:{platform:'linux'},
  scientificSha256,scientificCalculationFail,validateScientificCalculationRequest,
  readFile:async name=>String(name).endsWith('scientificComputeRuntime.v1.json')?manifestBytes:binary,
  lstat:async()=>{if(missing)throw Error('unavailable');return{isFile:()=>true,isSymbolicLink:()=>symlink};},
  spawn:()=>{dispatches++;throw Error('DISPATCH_FORBIDDEN');},
  mkdir:()=>{writes++;throw Error('WRITE_FORBIDDEN');},
 };
 vm.createContext(context);vm.runInContext(compiled+'\nthis.load=loadPinnedRuntime;',context);
 return context.load();
}
await assert.rejects(checkLoader(),/CALCULATION_PYTHON_IDENTITY_MISMATCH/);
await assert.rejects(checkLoader({symlink:true}),/CALCULATION_PYTHON_IDENTITY_MISMATCH/);
await assert.rejects(checkLoader({missing:true}),/CALCULATION_PYTHON_UNAVAILABLE/);
await assert.rejects(checkLoader({manifestBytes:Buffer.from(bytes.toString().replace(manifest.profileId,'unreviewed-runtime'))}),/CALCULATION_RUNTIME_MANIFEST_IDENTITY_MISMATCH/);
assert.equal(scientificSha256(fs.readFileSync(new URL('../'+manifest.workerPath,import.meta.url))),manifest.workerSha256);
const container=validateScientificContainerRuntimeManifest(JSON.parse(fs.readFileSync(new URL('../lib/creator/scientificReview/scientificComputeContainerRuntime.v1.json',import.meta.url))));
assert.equal(container.status,'BLOCKED_UNPROVISIONED');
assert.deepEqual(container.image,{reference:null,imageId:null,repoDigest:null});
assert.throws(()=>buildScientificContainerInvocation(container),/CONTAINER_RUNTIME_NOT_PROVISIONED/);
assert.equal(dispatches,0);assert.equal(writes,0);
console.log('PR45_SCIENTIFIC_IDENTITY_REJECTION_AND_UNPROVISIONED_CONTAINER=PASS');
console.log('NUMERICAL_RUNTIME_ACCEPTANCE=NOT_ESTABLISHED_BY_THIS_SUPPLEMENTAL_TEST');
