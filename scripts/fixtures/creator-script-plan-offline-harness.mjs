import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import {createJiti} from 'jiti';

// Evaluate actual route declarations/imported pure logic without its auth/DB
// boundary or any real OpenAI client. No server or live provider is started.
export async function createOfflineScriptPlanHarness(options = {}) {
  const repo=new URL('../..',import.meta.url).pathname.replace(/\/$/,'');
  const source=options.sourceText??fs.readFileSync(repo+'/app/api/creator-script-plan/route.ts','utf8');
  const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  const jiti=createJiti(import.meta.url,{fsCache:false,alias:{'@':repo}});
  const calls=[],logs=[];
  const forbidden=()=>{throw Error('OFFLINE_AUTH_OR_DATABASE_FORBIDDEN');};
  const context={Response,Request,URL,console:{info:(...args)=>logs.push(args),warn:(...args)=>logs.push(args),error:(...args)=>logs.push(args)},process:{env:{OPENAI_API_KEY:'offline-placeholder'}},fetch:forbidden,exports:{}};
  for(const node of ast.statements.filter(ts.isImportDeclaration)) {
    const spec=node.moduleSpecifier.text;let dependency;
    if(spec==='next/server') dependency={NextResponse:{json:(body,init)=>Response.json(body,init)}};
    else if(spec==='openai') dependency={default:class {responses={create:async request=>{
      const body=JSON.parse(request.input.find(item=>item.role==='user').content);calls.push({request,body});
      if(body.sourceScenes && options.sceneResponder)return options.sceneResponder(body);
      if(!body.requestedSectionBudgets)throw Error('OFFLINE_STOP_AT_ACCEPTANCE_REPAIR');
      const sections=body.requestedSectionBudgets.map((budget,index)=>({heading:`Synthetic viewpoint ${calls.length+index}`,text:Array.from({length:budget.targetWords},(_,i)=>['The','documented','premise','remains','bounded','by','available','evidence.'][i%8]).join(' '),claimIds:body.allowedClaimIds.slice(0,1)}));
      return{status:'completed',output_text:JSON.stringify({title:'Synthetic documentary',sections})};
    }}}};
    else if(/economics/.test(spec))dependency={recordOpenAITextEconomics:async()=>{}};
    else if(/supabase/.test(spec) && options.authenticatedUserId) dependency={createServerSupabaseClient:()=>({auth:{getUser:async()=>({data:{user:{id:options.authenticatedUserId}},error:null})}})};
    else if(/persistence/.test(spec) && options.readProjectForOwner) dependency={getPersistenceServices:()=>({projectRepository:{getForOwner:options.readProjectForOwner}})};
    else if(/persistence|supabase/.test(spec))dependency=new Proxy({}, {get:()=>forbidden});
    else dependency=await jiti.import(spec.startsWith('@/')?repo+'/'+spec.slice(2):path.resolve(repo+'/app/api/creator-script-plan',spec));
    const clause=node.importClause;if(!clause||clause.isTypeOnly)continue;
    if(clause.name)context[clause.name.text]=dependency.default;
    for(const element of clause.namedBindings?.elements||[])if(!element.isTypeOnly)context[element.name.text]=dependency[element.propertyName?.text||element.name.text];
  }
  const declarations=ast.statements.filter(node=>!ts.isImportDeclaration(node)&&!(ts.isFunctionDeclaration(node)&&node.name?.text==='POST'&&!options.includePost)).map(node=>node.getFullText(ast)).join('\n');
  const compiled=ts.transpileModule(declarations,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.createContext(context);vm.runInContext(compiled+'\nthis.execute=executeCreatorScriptOperation;this.authority=validateCreatorScriptProjectAuthority;this.sceneBudgets=createSceneBudgets;',context);
  if(options.includePost)vm.runInContext('this.post=POST;',context);
  assert.equal(typeof context.execute,'function');
  return{calls,logs,execute:context.execute,authority:context.authority,post:context.post,sceneBudgets:context.sceneBudgets};
}
