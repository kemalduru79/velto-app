import fs from "node:fs";

const page = fs.readFileSync("app/create/page.tsx", "utf8");

const required = [
  "DIRECTOR-P1R2 VELTO BRAND IDENTITY",
  "creatorlab-copilot-header-brand",
  "creatorlab-copilot-launcher-brand",
  ">VS</b>",
];

for (const marker of required) {
  if (!page.includes(marker)) {
    throw new Error(`Missing DIRECTOR-P1R2 marker: ${marker}`);
  }
}

const forbidden = [
  "/velto-copilot-director.png",
  "creatorlab-copilot-launcher-avatar",
  "creatorlab-director-empty-avatar",
  "creatorlab-director-empty-brand",
  "creatorlab-director-empty-brand-mark",
  "creatorlab-director-empty-brand-name",
];

for (const marker of forbidden) {
  if (page.includes(marker)) {
    throw new Error(`Obsolete Director identity marker still exists: ${marker}`);
  }
}

console.log("DIRECTOR-P1R2 Velto Brand Identity smoke test passed.");
