import fs from "node:fs";

const failures = [];

const requireNeedles = (file, needles) => {
  if (!fs.existsSync(file)) {
    failures.push(`${file}: missing`);
    return "";
  }

  const content = fs.readFileSync(file, "utf8");
  for (const needle of needles) {
    if (!content.includes(needle)) {
      failures.push(`${file}: missing ${needle}`);
    }
  }
  return content;
};

requireNeedles("app/layout.tsx", [
  'import "./creatorlab-ux-p2a-final.css";',
  'import "./creatorlab-ux-p2b.css";',
]);

requireNeedles("app/creatorlab-ux-p2b.css", [
  ".creatorlab-idea-lab-panel",
  "#creatorlab-strategy-canvas.creatorlab-strategy-experience",
  ".creatorlab-strategy-recommendation",
  "#creatorlab-strategy-youtube.creatorlab-strategy-panel",
  "#creatorlab-strategy-action.creatorlab-strategy-action-bar",
  "prefers-reduced-motion",
]);

const page = requireNeedles("app/create/page.tsx", [
  '<details className="creatorlab-secondary-panel creatorlab-idea-lab-panel">',
  "onClick={handleBulkGenerateIdeas}",
  "onClick={handleGenerateSelectedBulk}",
  "onChange={() => toggleBulkSelection(index)}",
  'id="creatorlab-brief-action" className="creatorlab-brief-action-bar"',
  'onClick={createSetup} disabled={loadingSetup || !input.trim()} className="creatorlab-primary-action"',
  'id="creatorlab-strategy-canvas" className="creatorlab-strategy-experience"',
  'id="creatorlab-strategy-recommendation"',
  'id="creatorlab-strategy-youtube"',
  'id="creatorlab-strategy-action" className="creatorlab-strategy-action-bar"',
  "onClick={handleCreatorProductionPackage}",
]);

if (page && !page.includes('useState("recommended")')) {
  failures.push("Strategy: recommended direction default changed or missing");
}

if (page && !page.includes("setCreatorSelectedStrategyDirectionId")) {
  failures.push("Strategy: direction selection behavior missing");
}

if (failures.length > 0) {
  console.error("UX-P2B Brief & Strategy smoke test failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("UX-P2B Brief & Strategy smoke test passed.");
