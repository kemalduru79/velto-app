import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const route = read("app/api/credits/route.ts");

function handlerBody(name) {
  const start = route.indexOf(`async function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const open = route.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < route.length; index += 1) {
    if (route[index] === "{") depth += 1;
    if (route[index] === "}") depth -= 1;
    if (depth === 0) return route.slice(open + 1, index);
  }
  assert.fail(`${name} body could not be parsed`);
}

const getBody = handlerBody("getHandler");
const postBody = handlerBody("postHandler");

assert.match(getBody, /authenticateRequest\(request\)/, "GET must authenticate");
assert.match(getBody, /creditEngine\.getAccount\(principal\.id\)/, "GET must derive its account ID from the authenticated principal");
assert.doesNotMatch(getBody, /creditEngine\.(reserve|settle|release|markProviderDispatch)/, "GET must be read-only");

assert.match(postBody, /status:\s*405/, "POST must return 405");
assert.match(postBody, /Allow:\s*["']GET["']/, "POST must advertise Allow: GET");
assert.match(postBody, /Credit mutations are not available through this endpoint\./, "POST must return the stable generic response");
assert.doesNotMatch(postBody, /authenticateRequest|request\.(json|text|arrayBuffer|formData)\s*\(/, "POST must neither authenticate nor consume the body");
assert.doesNotMatch(postBody, /creditEngine\.(reserve|settle|release|markProviderDispatch)|grant|provider[_ -]?dispatch/i, "POST must not reach a credit mutation");

const sourceRoots = ["app", "components", "lib"];
const sourceFiles = [];
function walk(directory) {
  for (const entry of readdirSync(join(root, directory))) {
    const path = join(directory, entry);
    const stats = statSync(join(root, path));
    if (stats.isDirectory()) walk(path);
    else if (/\.(?:ts|tsx|js|jsx)$/.test(entry)) sourceFiles.push(path);
  }
}
sourceRoots.forEach(walk);

const publicMutationRoutes = sourceFiles.filter((path) => {
  if (path === "app/api/credits/route.ts") return false;
  const source = read(path);
  return /\/api\/credits/.test(source) && /method\s*:\s*["']POST["']/.test(source);
});
assert.deepEqual(publicMutationRoutes, [], "No alternate browser/public POST /api/credits caller may exist");

const accountMenu = read("components/auth/UserAccountMenu.tsx");
assert.match(accountMenu, /fetch\(["']\/api\/credits["']/, "Browser balance GET must remain present");
assert.doesNotMatch(accountMenu, /method\s*:\s*["']POST["']/, "Browser balance caller must remain GET-only");

const metering = read("lib/credits/serverMetering.ts");
for (const helper of ["reserveMeteredOperation", "markMeteredOperationProviderDispatch", "settleMeteredOperation", "releaseMeteredOperation"]) {
  assert.match(metering, new RegExp(`export async function ${helper}`), `${helper} must remain available`);
}

const meteredRoutes = [
  "app/api/creator-export/route.ts",
  "app/api/creator-video/route.ts",
  "app/api/image/route.ts",
  "app/api/store-audio/route.ts",
  "app/api/store-dialogue-audio/route.ts",
];
for (const path of meteredRoutes) {
  assert.match(read(path), /@\/lib\/credits\/serverMetering/, `${path} must retain server-owned metering`);
}

const cancellation = read("app/api/jobs/[jobId]/route.ts");
assert.match(cancellation, /creditRepository\.settle\(/, "Job cancellation settlement must remain present");
assert.match(cancellation, /creditReservationId/, "Job cancellation must retain reservation association");

const expectedMigrationHashes = {
  "supabase/migrations/20260728090000_foundation_p1_auth_credit_ledger.sql": "459cb55c26e55c60ce28435bb9bad4b3f7da35e1b1464daf600d08742f0fefc9",
  "supabase/migrations/20260730120000_fin_p1c_credit_reconciliation.sql": "50862a6f4150d28a9d456dbc675c78980eef3b2f8747039a87b562a67c8b7dff",
};
for (const [path, expected] of Object.entries(expectedMigrationHashes)) {
  const actual = createHash("sha256").update(readFileSync(join(root, path))).digest("hex");
  assert.equal(actual, expected, `${path} must remain byte-for-byte unchanged`);
}

console.log("BETA-DATA-P1B-1 credit lockdown smoke test passed.");
