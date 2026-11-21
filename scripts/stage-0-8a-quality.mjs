import { spawnSync } from "node:child_process";

const gates = [
  ["TypeScript", "npm", ["run", "typecheck"]],
  ["No new lint debt", "npm", ["run", "lint:changed"]],
  ["Critical offline regressions", "npm", ["run", "test:ci-critical"]],
  ["Production build", "npm", ["run", "build"]],
  ["CI contract", "npm", ["run", "test:ci-contract"]],
];

for (const [label, command, args] of gates) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, CI: "true", NEXT_TELEMETRY_DISABLED: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nSTAGE_0_8A_QUALITY=PASS");
