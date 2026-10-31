import type {
  CreatorEvidenceGovernanceReport,
} from "./evidenceGovernance";

export const CREATOR_PACKAGE_AI_DISCLOSURE =
  "Some visuals in this documentary were generated using AI and are intended as illustrations, not original footage of the events or research discussed.";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as RecordValue
    : {};

export function prepareCreatorPackageSyntheticDisclosure(input: {
  productionPackage: unknown;
  metadata: unknown;
  syntheticMediaCount: number;
}) {
  const productionPackage = record(input.productionPackage);
  const metadata = record(input.metadata);
  const syntheticMediaUsed = Number.isFinite(input.syntheticMediaCount) && input.syntheticMediaCount > 0;
  if (!syntheticMediaUsed) {
    return { productionPackage, metadata, syntheticDisclosureIncluded: false };
  }

  const existingDescription = typeof metadata.description === "string"
    ? metadata.description.trim()
    : "";
  const description = existingDescription.includes(CREATOR_PACKAGE_AI_DISCLOSURE)
    ? existingDescription
    : [existingDescription, CREATOR_PACKAGE_AI_DISCLOSURE].filter(Boolean).join("\n\n");

  // This flag is valid for this export only because the generated publishing
  // description actually contains the disclosure. Do not assert that the
  // source project is already marked, or overwrite its canonical revision.
  return {
    productionPackage: {
      ...productionPackage,
      publishGovernance: {
        ...record(productionPackage.publishGovernance),
        syntheticDisclosurePresent: true,
        syntheticDisclosureText: CREATOR_PACKAGE_AI_DISCLOSURE,
      },
    },
    metadata: { ...metadata, description },
    syntheticDisclosureIncluded: true,
  };
}

/**
 * Resolve only the disclosure issue satisfied by this particular output.
 * Unsupported claims, missing sources and media-rights findings remain intact.
 * The underlying project's governance is never mutated or globally waived.
 */
export function resolveCreatorPackageDisclosureGovernance(
  governance: CreatorEvidenceGovernanceReport | undefined,
  prepared: ReturnType<typeof prepareCreatorPackageSyntheticDisclosure>,
): CreatorEvidenceGovernanceReport | undefined {
  if (!governance || !prepared.syntheticDisclosureIncluded ||
      !String(prepared.metadata.description || "").includes(CREATOR_PACKAGE_AI_DISCLOSURE) ||
      record(prepared.productionPackage.publishGovernance).syntheticDisclosurePresent !== true) {
    return governance;
  }
  const issues = governance.issues.filter(
    (issue) => issue.code !== "SYNTHETIC_DISCLOSURE_REQUIRED",
  );
  const blockedIssueCount = issues.filter((issue) => issue.severity === "blocked").length;
  const reviewIssueCount = issues.length - blockedIssueCount;
  return {
    ...governance,
    issues,
    blockedIssueCount,
    reviewIssueCount,
    status: blockedIssueCount > 0 ? "blocked" : reviewIssueCount > 0 ? "review" : "ready",
    requiresManualReview: issues.length > 0,
  };
}
