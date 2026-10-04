import assert from "node:assert/strict";
import fs from "node:fs";

const pkg = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

assert.equal(
  pkg.scripts?.dev,
  "next dev --webpack --port 3000",
  "local dev must use webpack because Turbopack route discovery returned HTML 404 for existing API routes",
);

assert.equal(
  pkg.scripts?.build,
  "next build --webpack",
  "production build remains explicitly webpack-backed",
);

console.log("stage-0-19f-f4-webpack-dev-route-safety-test: PASS");
