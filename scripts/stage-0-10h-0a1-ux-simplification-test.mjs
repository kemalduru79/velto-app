import fs from "node:fs";

const failures = [];

const read = (file) => {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
};

const requireNeedles = (file, needles) => {
  const content = read(file);
  for (const needle of needles) {
    if (!content.includes(needle)) failures.push(`${file}: missing ${needle}`);
  }
  return content;
};

const layout = requireNeedles("app/layout.tsx", [
  'import "./creatorlab-ux-h0a.css";',
]);

const simplificationCss = requireNeedles("app/creatorlab-ux-h0a.css", [
  "Brief → Strategy → Production → Publish",
  ".creatorlab-step-list",
  ".creatorlab-workflow-step:nth-of-type(4)",
  'content: "Production"',
  'content: "Üretim"',
  'content: "Step 3 · Production"',
  'content: "Adım 3 · Üretim"',
  'content: "Step 4 · Publish"',
  'content: "Adım 4 · Yayınla"',
  ".creatorlab-director-mode-tabs",
  "display: none !important",
]);

const accountMenu = requireNeedles("components/auth/UserAccountMenu.tsx", [
  "account?.availableCredits",
  "account?.reservedCredits",
]);
if (accountMenu.includes("{account.availableCredits} {t.credits}")) {
  failures.push("UserAccountMenu: credits are still exposed in the primary account launcher");
}

const costGuard = requireNeedles("components/create/CreatorCostGuard.tsx", [
  "CREATOR_COST_GUARD_CONFIRMATION_THRESHOLD = 6",
  "request.estimatedCredits >= CREATOR_COST_GUARD_CONFIRMATION_THRESHOLD",
  "autoConfirmedRequestRef",
  "onConfirm();",
  "if (!request || !requiresExplicitConfirmation) return null;",
]);

const operationPolicy = requireNeedles("lib/credits/operationPolicy.ts", [
  'creator_video: { draft: 0, standard: 0, pro: 6, cinematic: 10 }',
]);

const page = read("app/create/page.tsx");
if (page && !page.includes('type CreatorProductionSubstep')) {
  failures.push("CreatorLab: existing production substep state machine was unexpectedly removed");
}
if (page && page.includes("<CreatorProductionSubnav")) {
  failures.push("CreatorLab: deprecated nested Production sub-navigation is rendered again");
}

if (!layout || !simplificationCss || !accountMenu || !costGuard || !operationPolicy) {
  // Missing-file detail is already recorded above.
}

if (failures.length > 0) {
  console.error(
    `Stage 0.10H-0A.1 UX simplification test failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`,
  );
  process.exit(1);
}

console.log("Stage 0.10H-0A.1 UX simplification test passed.");
