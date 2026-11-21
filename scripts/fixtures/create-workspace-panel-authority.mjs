import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Test-only source ownership proof. Never concatenate parent/child sources:
// presentation assertions inspect the mounted child; mutation assertions stay
// on the parent. A disconnected copy or a changed callback binding must fail.
const guards = Object.freeze({
  CreateBriefPanel: null,
  CreatorStrategyPanel: "{isCreatorLabFlow&&creatorStageVisibility.strategy&&creatorMentorResult&&(",
  CreatorProductionPanel: "{isCreatorLabFlow&&(creatorStageVisibility.production_setup||creatorStageVisibility.create_review)&&creatorProductionPackage&&(",
  CreatorPublishPanel: "{isCreatorLabFlow&&creatorStageVisibility.publish&&creatorProductionPackage&&(",
});
const parse = (source) => ts.createSourceFile("panel.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

export function verifyWorkspacePanel(name, pageText, panelText) {
  assert(Object.hasOwn(guards, name), "Only the existing reviewed stage panels are supported");
  const page = parse(pageText), panel = parse(panelText);
  assert(page.statements.some((node) => ts.isImportDeclaration(node) &&
    node.moduleSpecifier.text === `@/components/create/${name}` && node.importClause?.name?.text === name),
  "Parent must import the exact authoritative panel");
  const workspace = page.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "CreateWorkspace");
  const returned = workspace?.body.statements.findLast(ts.isReturnStatement);
  assert(returned?.expression, "Inspect the actual workspace return, not unused JSX");
  const mounts = [];
  function visit(node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === name) mounts.push(node);
    ts.forEachChild(node, visit);
  }
  visit(returned.expression);
  assert.equal(mounts.length, 1, "Panel must have exactly one real workspace mount");
  const mount = mounts[0];
  let expression = mount.parent;
  while (expression && !ts.isJsxExpression(expression)) expression = expression.parent;
  assert.equal(expression?.getText(page).split(`<${name}`)[0].replace(/\s/g, "") ?? null,
    guards[name], "Stage visibility and production prerequisites must remain unchanged");
  const contract = panel.statements.find((node) => ts.isTypeAliasDeclaration(node) && node.name.text === `${name}Props`);
  assert(contract && ts.isTypeLiteralNode(contract.type));
  const attributes = mount.attributes.properties;
  assert(attributes.every(ts.isJsxAttribute), "No spread can hide a canonical binding");
  assert.deepEqual(attributes.map((node) => node.name.text).sort(),
    contract.type.members.map((node) => node.name.getText(panel)).sort(), "Every typed prop must remain parent-bound");
  for (const attribute of attributes) {
    const expected = ({ onUseCreatorStockMedia: "useCreatorStockMedia", onUseCreatorUploadedMedia: "useCreatorUploadedMedia" })[attribute.name.text] ?? attribute.name.text;
    assert(ts.isJsxExpression(attribute.initializer) && ts.isIdentifier(attribute.initializer.expression));
    assert.equal(attribute.initializer.expression.text, expected, `Parent binding changed: ${attribute.name.text}`);
  }
  const component = panel.statements.find((node) => ts.isFunctionDeclaration(node) &&
    node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword));
  assert(component?.body && component.parameters[0]?.type?.getText(panel) === `${name}Props`);
  let hooks = 0;
  function count(node) {
    if (ts.isCallExpression(node) && /^use[A-Z]/.test(node.expression.getText(panel))) hooks++;
    ts.forEachChild(node, count);
  }
  count(component.body);
  assert.equal(hooks, 0, "Stage panels must not acquire independent state ownership");
  return panelText;
}

export function readMountedWorkspacePanel(name) {
  return verifyWorkspacePanel(name, fs.readFileSync("app/create/page.tsx", "utf8"),
    fs.readFileSync(`components/create/${name}.tsx`, "utf8"));
}

// Execute the original JSX expression with synthetic ports; no mirrored gate
// implementation and no auth, persistence, provider or canonical state port.
export function evaluatePanelAction(sourceText, action, ports) {
  const source = parse(sourceText), found = [];
  function visit(node) {
    if (action === "production" && ts.isJsxExpression(node) &&
      ts.isBinaryExpression(node.expression) && node.expression.left.getText(source) === "!creatorProductionComplete") found.push(node.expression);
    if (action === "publish" && ts.isJsxElement(node) && node.openingElement.attributes.properties.some((attribute) =>
      ts.isJsxAttribute(attribute) && attribute.name.text === "className" && attribute.initializer?.text === "creatorlab-publish-primary-action")) found.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(found.length, 1, "Use the unique original action expression");
  const compiled = ts.transpileModule(`export const result = (${found[0].getText(source)});`, {
    fileName: "action.tsx", compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const output = { exports: {} };
  const require = createRequire(import.meta.url);
  new Function("require", "exports", ...Object.keys(ports), compiled)(
    (name) => { assert.equal(name, "react/jsx-runtime"); return require(name); }, output.exports, ...Object.values(ports));
  return output.exports.result;
}
