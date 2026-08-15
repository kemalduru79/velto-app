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

const reports = requireNeedles("components/reports/CreatorReportsCenter.tsx", [
  "export default function CreatorReportsCenter",
  '<ProductTopNavigation tone="light" active="reports" />',
  'fetch("/api/projects"',
  "`/api/load-project/${encodeURIComponent(selectedProjectId)}`",
  "setQuery(event.target.value)",
  "setStatusFilter(event.target.value as StatusFilter)",
  "handleDownloadHtml",
  "createCreatorProjectPerformanceReportHtml(report)",
  "handleDownloadJson",
  'href="/create?flow=creator_lab"',
  "Open project in Velto Studio",
  "Project Readiness Score",
  "report.performanceScore",
  "report.lifecycle.status",
  "report.production.visualReadyScenes",
  "report.production.voiceReadyScenes",
  "report.credits.estimatedTotalCredits",
  "report.credits.estimatedUsedCredits",
  "report.credits.estimatedRemainingCredits",
  "report.production.targetDurationSec",
  "report.continuity.status",
  "report.publish.readinessPercent",
  "report.findings.blockers",
  "report.findings.warnings",
  "report.nextActions",
  "report.findings.strengths",
  "report.lifecycle.history",
  'className={`reports-project-row ${selected ? "is-selected" : ""}`}',
  "aria-pressed={selected}",
  "aria-label={copy.search}",
  "aria-label={copy.allStatuses}",
  'className="reports-primary-action"',
  'className="reports-decisions"',
  'className="reports-portfolio-secondary"',
  'className="reports-supporting-signals"',
]);

const forbiddenMetricLabels = [
  /["']Views["']/,
  /["']Impressions["']/,
  /["']Watch Time["']/,
  /["']Retention["']/,
  /["']CTR["']/,
  /["']Engagement Rate["']/,
  /["']Followers["']/,
  /["']Subscribers["']/,
  /["']Likes["']/,
  /["']Comments["']/,
];

for (const pattern of forbiddenMetricLabels) {
  if (pattern.test(reports)) {
    failures.push(`Reports introduces unsupported post-publish metric: ${pattern}`);
  }
}

const css = requireNeedles("app/creatorlab-reports.css", [
  ".reports-shell",
  ".reports-portfolio-primary",
  ".reports-project-row.is-selected",
  ".reports-primary-signals",
  ".reports-decisions",
  "@media (max-width: 1050px)",
  ":focus-visible",
]);

requireNeedles("app/layout.tsx", ['import "./creatorlab-reports.css";']);

if (/radial-gradient|#07101f|neon/i.test(css)) {
  failures.push("Reports cohesion stylesheet reintroduces the separate dark-dashboard treatment");
}

if (failures.length > 0) {
  console.error(`UX-P2D Reports Cohesion smoke test failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("UX-P2D Reports Cohesion smoke test passed.");
