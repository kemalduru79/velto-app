import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// No real process/network transport may sneak into the Step 1 v2 modules.
for(const file of ['runtimeV2Adapter.ts','runtimeV2Contracts.ts']){
 const source=fs.readFileSync('lib/creator/scientificReview/'+file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const allowed=new Set(['node:crypto','node:perf_hooks','./authorityContracts.ts','./calculationContracts.ts','./runtimeV2Contracts.ts']);
 const visit=node=>{
  if(ts.isImportDeclaration(node))assert(allowed.has(node.moduleSpecifier.text),'Unexpected v2 runtime dependency: '+node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)assert.fail('Dynamic import in disabled v2 runtime');
  ts.forEachChild(node,visit);
 };
 visit(ast);
 assert.doesNotMatch(source,/\b(?:spawn|spawnSync|execFile|execFileSync|require|fetch)\s*\(/);
}
const adapter=fs.readFileSync('lib/creator/scientificReview/runtimeV2Adapter.ts','utf8');
assert.match(adapter,/runOfflineScientificV2\([\s\S]*?return v2Fail\("DIRECTORY_RELATIVE_PERSISTENCE_UNAVAILABLE"\)/);
assert.doesNotMatch(adapter,/node:fs|node:path|durableCreate/,'No unsafe filesystem provider may remain enabled');
const profiles=fs.readFileSync('lib/creator/scientificReview/runtimeProfiles.ts','utf8');
assert.match(profiles,/SCIENTIFIC_V2_REAL_EXECUTION_ENABLED = false as const/);
assert.match(profiles,/executeScientificContainerV2\(\): Promise<never> \{\s*return v2Fail\("REAL_EXECUTION_DISABLED"\)/);
assert.doesNotMatch(profiles,/runtimeV2Adapter|process\.env|child_process/);
assert(!fs.readFileSync('lib/creator/scientificReview/index.ts','utf8').includes('export * from "./runtimeV2Adapter'));
await import('./scientific-runtime-v2-contracts-test.mjs');
await import('./scientific-runtime-v2-adapter-test.mjs');
console.log('SCIENTIFIC_V2_OFFLINE_MODEL_REGRESSIONS=PASS; REAL_EXECUTION_DISABLED=true; DURABLE_FILESYSTEM=BLOCKED');
