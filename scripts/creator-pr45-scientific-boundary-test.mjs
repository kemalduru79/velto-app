/**
 * Ensure the isolated scientific calculation adapter is NOT a runtime
 * dependency of CreatorLab script/research APIs. Conservative static import
 * graph: dynamic local imports, unresolved local imports and suspicious
 * string references all fail rather than silently claiming independence.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root=process.cwd();
const targets=[
 "app/api/creator-script-plan/route.ts",
 "app/api/creator-script-build/route.ts",
 "app/api/creator-editorial-analysis/route.ts",
 "app/api/creator-research/route.ts",
 "app/api/creator-editorial-primary-coverage/route.ts",
 "app/api/creator-script/approve/route.ts",
 "app/api/creator-script/refine/route.ts",
 "app/api/creator-script/verify-section/route.ts",
];
const extensions=["",".ts",".tsx",".js",".jsx",".mjs",".mts",".json","/index.ts","/index.tsx","/index.js"];
const seen=new Set();
const edges=new Map();
const scientificDir=path.join(root,"lib/creator/scientificReview")+path.sep;
const resolveLocal=(from,spec)=>{
 let target;
 if(spec.startsWith("@/"))target=path.join(root,spec.slice(2));
 else if(spec.startsWith("."))target=path.resolve(path.dirname(from),spec);
 else return null;
 if(target!==root && !target.startsWith(root+path.sep))throw Error("LOCAL_IMPORT_ESCAPES_REPO");
 const match=extensions.map(ext=>target+ext).find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
 if(!match)throw Error("UNRESOLVED_LOCAL_IMPORT: "+path.relative(root,from)+" -> "+spec);
 return match;
};
const traverse=file=>{
 if(file.startsWith(scientificDir))throw Error("CREATOR_PRODUCTION_DEPENDS_ON_SCIENTIFIC_CALCULATION: "+path.relative(root,file));
 if(seen.has(file))return;
 if(seen.size>5000)throw Error("UNBOUNDED_MODULE_GRAPH");
 seen.add(file);
 const source=fs.readFileSync(file,"utf8");
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 const discovered=new Set();
 const visit=node=>{
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)){
   discovered.add(node.moduleSpecifier.text);
  }
  if(ts.isCallExpression(node) && (node.expression.kind===ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression)&&node.expression.text==="require"))){
   if(node.arguments.length!==1 || !ts.isStringLiteral(node.arguments[0]))throw Error("UNRESOLVED_DYNAMIC_IMPORT: "+path.relative(root,file));
   discovered.add(node.arguments[0].text);
  }
  ts.forEachChild(node,visit);
 };
 visit(ast);
 const resolved=[];
 for(const spec of discovered){
  if(spec.includes("scientificReview")||spec.includes("runScientificCalculation"))
   throw Error("CREATOR_PRODUCTION_REFERENCES_SCIENTIFIC_ENGINE: "+path.relative(root,file));
  const next=resolveLocal(file,spec);
  if(next){resolved.push(next);traverse(next);}
 }
 edges.set(file,resolved);
};
for(const rel of targets){
 const abs=path.join(root,rel);
 assert.ok(fs.existsSync(abs),"missing audited creator route: "+rel);
 traverse(abs);
}
assert.ok(seen.size>25,"Import graph unexpectedly small; audit is not meaningful.");
const critical=fs.readFileSync("scripts/stage-0-8a-critical-regression.mjs","utf8");
const scientific=fs.readFileSync(".github/workflows/scientific-ci.yml","utf8");
const main=fs.readFileSync(".github/workflows/ci.yml","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
assert.doesNotMatch(critical,/["']scripts\/stage-5e1g-b-scientific-computing-test\.mjs["']/);
assert.match(pkg.scripts["test:ci-scientific"],/stage-5e1g-b-scientific-computing-test\.mjs/);
assert.match(scientific,/run:\s*npm run test:ci-scientific/);
assert.match(main,/run:\s*npm run test:ci-critical/);
for(const workflow of [main,scientific]){
 assert.doesNotMatch(workflow,/continue-on-error|\|\|\s*true|\bexit\s+0\b/);
}
console.log("PR45_CREATOR_SCRIPT_SCIENTIFIC_RUNTIME_IMPORT_BOUNDARY=PASS",JSON.stringify({routes:targets.length,localModules:seen.size,mainCI:"enabled",scientificCI:"independently enforced"}));
