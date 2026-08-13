import fs from "node:fs";

const required = {
  "app/layout.tsx": [
    'import "./creatorlab-ux-p2a.css";',
    'import "./creatorlab-ux-p2a-compat.css";',
  ],
  "components/experience/CreatorLabShell.tsx": [
    "creatorlab-uxp2a-shell",
    "creatorlab-uxp2a-ambient",
    "creatorlab-uxp2a-content",
  ],
  "components/create/CreatorOutcomeStart.tsx": [
    "creatorlab-uxp2a-outcome-card",
    "creatorlab-uxp2a-outcome-grid",
    "data-selected",
  ],
  "components/create/CreatorProductionSubnav.tsx": [
    "creatorlab-uxp2a-production-nav",
    "creatorlab-uxp2a-production-nav-item",
    "data-production-substep-selected",
  ],
  "app/creatorlab-ux-p2a.css": [
    "--cl-brand-strong",
    "prefers-reduced-motion",
    ":focus-visible",
  ],
  "app/creatorlab-ux-p2a-compat.css": [
    ".creatorlab-uxp2a-shell .creatorlab-topbar-tool-button",
    ".creatorlab-uxp2a-shell .creatorlab-workspace-stage",
  ],
};

const failures = [];

for (const [file, needles] of Object.entries(required)) {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing`);
    continue;
  }

  const content = fs.readFileSync(file, "utf8");
  for (const needle of needles) {
    if (!content.includes(needle)) {
      failures.push(`${file}: missing ${needle}`);
    }
  }
}

const outcome = fs.readFileSync("components/create/CreatorOutcomeStart.tsx", "utf8");
if (!outcome.includes("onClick={() => onSelect(definition.value)}")) {
  failures.push("CreatorOutcomeStart: outcome selection behavior changed");
}

const production = fs.readFileSync("components/create/CreatorProductionSubnav.tsx", "utf8");
if (!production.includes("onClick={() => onChange(item.value)}")) {
  failures.push("CreatorProductionSubnav: navigation behavior changed");
}

if (failures.length > 0) {
  console.error("UX-P2A foundation smoke test failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("UX-P2A foundation smoke test passed.");
