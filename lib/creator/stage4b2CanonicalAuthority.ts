import { createHash, createPublicKey, verify } from "node:crypto";
import type { Stage4B2IndependentAuthorityVerifier } from "./creatorScriptCanonicalAcceptance.ts";

export const STAGE4B2_AUTHORITY_ENVELOPE_VERSION = "stage4b2-owner-authority-envelope-v1" as const;
// This remains null until a separately reviewed owner key fingerprint is approved.
export const STAGE4B2_APPROVED_OWNER_AUTHORITY_PUBLIC_KEY_SHA256: string | null = null;

type Baseline = { projectIdentitySha256: string; projectRevision: string; snapshotSha256: string; manifestSha256: string };
type SourceReceipt = { sourceId: string; sourceUrl: string; documentSha256: string; receiptSha256: string };
type ReviewReceipt = { kind: "semantic" | "factual_inventory" | "editorial"; receiptSha256: string; subjectSha256: string };
type PersistedComparison = { projectIdentitySha256: string; projectRevision: string; scriptSha256: string; sceneIdentitySha256: string };
export type Stage4B2AuthorityEnvelope = { version: typeof STAGE4B2_AUTHORITY_ENVELOPE_VERSION; baseline: Baseline; sourceReceipts: SourceReceipt[]; reviewReceipts: ReviewReceipt[]; persistedComparison: PersistedComparison; signatureBase64: string };

const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value && typeof value === "object" ? `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}` : JSON.stringify(value);
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const isDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const same = (left: unknown, right: unknown) => stable(left) === stable(right);
export const stage4b2AuthoritySigningPayload = (envelope: Omit<Stage4B2AuthorityEnvelope, "signatureBase64"> | Stage4B2AuthorityEnvelope) => {
  const { signatureBase64: _signature, ...payload } = envelope as Stage4B2AuthorityEnvelope;
  return Buffer.from(stable(payload), "utf8");
};

export function createStage4B2SignedAuthorityVerifier(input: { envelope: unknown; publicKeyPem: string; approvedPublicKeySha256: string; authorityClass: "synthetic_test" | "owner_controlled" }): Stage4B2IndependentAuthorityVerifier | null {
  try {
    const envelope = structuredClone(input.envelope) as Stage4B2AuthorityEnvelope;
    const publicKey = createPublicKey(input.publicKeyPem);
    const fingerprint = sha256(publicKey.export({ type: "spki", format: "der" }));
    const shape = envelope?.version === STAGE4B2_AUTHORITY_ENVELOPE_VERSION && isDigest(input.approvedPublicKeySha256) && fingerprint === input.approvedPublicKeySha256 && envelope.baseline && Array.isArray(envelope.sourceReceipts) && Array.isArray(envelope.reviewReceipts) && envelope.persistedComparison && typeof envelope.signatureBase64 === "string";
    if (!shape || !verify(null, stage4b2AuthoritySigningPayload(envelope), publicKey, Buffer.from(envelope.signatureBase64, "base64"))) return null;
    if (!Object.values(envelope.baseline).every((value) => typeof value === "string" && value.length > 0) || !envelope.sourceReceipts.every((item) => isDigest(item.documentSha256) && isDigest(item.receiptSha256)) || !envelope.reviewReceipts.every((item) => isDigest(item.receiptSha256) && isDigest(item.subjectSha256))) return null;
    return {
      authorityClass: input.authorityClass,
      verifyPersistedBaseline: (candidate) => same(candidate, envelope.baseline),
      verifySourceAcquisitionReceipt: (candidate) => envelope.sourceReceipts.some((item) => same(item, candidate)),
      verifyReviewReceipt: (candidate) => envelope.reviewReceipts.some((item) => same(item, candidate)),
      verifyPersistedBeforeAfter: (candidate) => same(candidate, envelope.persistedComparison),
    };
  } catch { return null; }
}

export function createConfiguredStage4B2OwnerVerifier(input: { envelope: unknown; publicKeyPem: string }) {
  if (!STAGE4B2_APPROVED_OWNER_AUTHORITY_PUBLIC_KEY_SHA256) return null;
  return createStage4B2SignedAuthorityVerifier({ ...input, approvedPublicKeySha256: STAGE4B2_APPROVED_OWNER_AUTHORITY_PUBLIC_KEY_SHA256, authorityClass: "owner_controlled" });
}
