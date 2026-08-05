import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function requireText(file, values) {
  const content = read(file);
  for (const value of values) {
    if (!content.includes(value)) {
      throw new Error(`${file} is missing required marker: ${value}`);
    }
  }
  return content;
}

const protectedRoutes = [
  "app/api/creator-mentor/route.ts",
  "app/api/creator-thumbnail/route.ts",
  "app/api/creator-youtube-metadata/route.ts",
];

for (const file of protectedRoutes) {
  const content = requireText(file, [
    'from "@/lib/auth/server"',
    "authenticateRequest(req)",
    "error instanceof AuthenticationError",
    "status: 401",
    'error: "Authentication required."',
  ]);

  const authIndex = content.indexOf("await authenticateRequest(req)");
  const providerIndex = content.indexOf("getOpenAIClient()", content.indexOf("export async function POST"));
  const bodyIndex = content.indexOf("req.json", content.indexOf("export async function POST"));

  if (authIndex < 0 || providerIndex < 0 || authIndex > providerIndex) {
    throw new Error(`${file} must authenticate before initializing the provider client.`);
  }

  if (bodyIndex >= 0 && authIndex > bodyIndex) {
    throw new Error(`${file} must authenticate before reading the request body.`);
  }
}

const createPage = read("app/create/page.tsx");
const metadataRoute = 'fetch("/api/creator-youtube-metadata"';
let cursor = 0;
let metadataCalls = 0;

while (true) {
  const index = createPage.indexOf(metadataRoute, cursor);
  if (index < 0) break;

  const snippet = createPage.slice(index, index + 360);
  if (!snippet.includes('Authorization: `Bearer ${accessToken}`')) {
    throw new Error("Every creator-youtube-metadata call must send the bearer token.");
  }

  metadataCalls += 1;
  cursor = index + metadataRoute.length;
}

if (metadataCalls !== 2) {
  throw new Error(`Expected exactly 2 creator-youtube-metadata calls, found ${metadataCalls}.`);
}

const packageJson = JSON.parse(read("package.json"));
if (packageJson.scripts?.["test:beta-sec-p1a"] !== "node scripts/beta-sec-p1a-smoke-test.mjs") {
  throw new Error("package.json is missing test:beta-sec-p1a.");
}

console.log("BETA-SEC-P1A-1 authentication boundary smoke test passed.");
