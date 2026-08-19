import assert from "node:assert/strict";
import fs from "node:fs";

const workflowPath = ".github/workflows/ci.yml";
assert.ok(fs.existsSync(workflowPath), `${workflowPath} must exist`);
const workflow = fs.readFileSync(workflowPath, "utf8");

assert.match(workflow, /actions\/checkout@v6/);
assert.match(workflow, /actions\/setup-node@v6/);
assert.match(workflow, /node-version:\s*(?:["']?22["']?)/);
assert.match(workflow, /run:\s*npm ci/);
assert.match(workflow, /run:\s*npm run typecheck/);
assert.match(workflow, /run:\s*npm run lint:changed/);
assert.match(workflow, /run:\s*npm run test:ci-critical/);
assert.match(workflow, /run:\s*npm run build/);
assert.match(workflow, /persist-credentials:\s*false/);
assert.match(workflow, /^permissions:\n\s+contents:\s+read\s*$/m);
assert.doesNotMatch(workflow, /^\s*\w[\w-]*:\s*write\s*$/m);

const forbiddenSecrets = [
  "SUPABASE_SERVICE_ROLE_KEY", "RUNWAY_API_KEY", "VEO_API_KEY", "OPENAI_API_KEY",
  "ELEVENLABS_API_KEY", "EPIDEMIC_API_KEY", "EPIDEMIC_SOUND_API_KEY",
];
for (const name of forbiddenSecrets) assert.ok(!workflow.includes(name), `${name} must not be referenced`);

assert.doesNotMatch(workflow, /azure\/(?:login|webapps-deploy|container-apps-deploy-action)|az\s+(?:deployment|webapp|containerapp)/i);
assert.doesNotMatch(workflow, /\bvercel\s+(?:deploy|--prod)|vercel\/.*action/i);
assert.doesNotMatch(workflow, /\brailway\s+(?:up|deploy)|railwayapp/i);
assert.doesNotMatch(workflow, /supabase\s+(?:db\s+(?:push|reset)|migration\s+(?:repair|up)|functions\s+deploy)/i);
assert.doesNotMatch(workflow, /(?:runway|veo|elevenlabs|epidemic|openai).*(?:generate|synthesi[sz]e|create)/i);
assert.doesNotMatch(workflow, /curl\b[^\n|]*\|\s*(?:ba)?sh/i);

console.log("STAGE_0_8A_CI_CONTRACT=PASS");
