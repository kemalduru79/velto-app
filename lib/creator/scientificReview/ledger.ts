/** Local durable fail-closed attempt ledger. Every attempt is consumed before mock dispatch. */
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import { exactKeys, scientificReviewFail } from "./contracts.ts";
import type { CostPolicy, ReviewerTask } from "./contracts.ts";
import { sha256 } from "./evidence.ts";

function safeNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

function isApprovedDarwinSystemAlias(parent: string, resolvedParent: string): boolean {
  if (process.platform !== "darwin") return false;
  const isSystemAlias = parent === "/var" || parent.startsWith("/var/") ||
    parent === "/tmp" || parent.startsWith("/tmp/");
  return isSystemAlias && resolvedParent === `/private${parent}`;
}

export function validateCostPolicy(policy: CostPolicy): number {
  exactKeys(policy, ["version", "maximumCalls", "maximumModeledUsd", "reservedInputTokensPerCall",
    "reservedOutputTokensPerCall", "assumedInputUsdPerMillion", "assumedOutputUsdPerMillion", "safetyMultiplier"], "COST_POLICY");
  if (policy.version !== "stage-5e1f-mock-cost-v1" ||
      !Number.isSafeInteger(policy.maximumCalls) || policy.maximumCalls < 1 || policy.maximumCalls > 2000 ||
      !safeNumber(policy.maximumModeledUsd) ||
      !Number.isSafeInteger(policy.reservedInputTokensPerCall) || policy.reservedInputTokensPerCall < 1 ||
      !Number.isSafeInteger(policy.reservedOutputTokensPerCall) || policy.reservedOutputTokensPerCall < 1 ||
      !safeNumber(policy.assumedInputUsdPerMillion) || !safeNumber(policy.assumedOutputUsdPerMillion) ||
      !safeNumber(policy.safetyMultiplier) || policy.safetyMultiplier < 1) {
    scientificReviewFail("COST_POLICY_INVALID");
  }
  return (policy.reservedInputTokensPerCall * policy.assumedInputUsdPerMillion +
    policy.reservedOutputTokensPerCall * policy.assumedOutputUsdPerMillion) / 1_000_000 * policy.safetyMultiplier;
}

async function durableCreateText(dir: string, name: string, body: string) {
  const dest = path.join(dir, name);
  const handle = await open(dest, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(body, "utf8"); await handle.sync(); }
  finally { await handle.close(); }
  const dirHandle = await open(dir, constants.O_RDONLY | constants.O_DIRECTORY);
  try { await dirHandle.sync(); } finally { await dirHandle.close(); }
}

async function durableCreate(dir: string, name: string, value: unknown) {
  await durableCreateText(dir, name, `${JSON.stringify(value, null, 2)}\n`);
}

export class OfflineScientificReviewLedger {
  private calls = 0;
  private reservedUsd = 0;
  readonly dir: string;
  readonly runId: string;
  private readonly policy: CostPolicy;
  private readonly costPerCall: number;
  private constructor(dir: string, runId: string, policy: CostPolicy, costPerCall: number) {
    this.dir = dir;
    this.runId = runId;
    this.policy = policy;
    this.costPerCall = costPerCall;
  }

  static async create(runDirectory: string, runId: string, policy: CostPolicy, inputSha256: string) {
    const costPerCall = validateCostPolicy(policy);
    const parent = path.dirname(path.resolve(runDirectory));
    if ((await lstat(parent)).isSymbolicLink()) scientificReviewFail("PARENT_SYMLINK_FORBIDDEN");
    const resolvedParent = await realpath(parent);
    // macOS commonly exposes its canonical /private/var temp directory through
    // the system /var alias. Permit only that OS-owned alias shape; arbitrary
    // symlink ancestors and directly supplied symlink parents remain forbidden.
    if (resolvedParent !== parent && !isApprovedDarwinSystemAlias(parent, resolvedParent)) {
      scientificReviewFail("PARENT_REALPATH_MISMATCH");
    }
    const dir = path.join(resolvedParent, path.basename(runDirectory));
    // Exclusive mkdir: previous/ambiguous/interrupted run cannot dispatch twice.
    try { await mkdir(dir, { mode: 0o700 }); }
    catch { scientificReviewFail("RUN_DIRECTORY_ALREADY_EXISTS_OR_UNAVAILABLE"); }
    const stat = await lstat(dir);
    if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) scientificReviewFail("PRIVATE_DIR_PERMISSIONS_INVALID");
    const ledger = new OfflineScientificReviewLedger(dir, runId, policy, costPerCall);
    await durableCreate(dir, "manifest.json", {
      version: "stage-5e1f-ledger-v1", runId, mode: "offline_mock", inputSha256,
      policy, theoreticalMaximumModeledUsd: Number((policy.maximumCalls * costPerCall).toFixed(6)),
      authorization: "NO_LIVE_PROVIDER_AUTHORITY",
    });
    return ledger;
  }

  async authorizeBeforeDispatch(task: ReviewerTask) {
    if (this.calls >= this.policy.maximumCalls ||
        this.reservedUsd + this.costPerCall > this.policy.maximumModeledUsd + 1e-10) {
      scientificReviewFail("MODELED_BUDGET_OR_CALL_LIMIT_EXHAUSTED");
    }
    const next = this.calls + 1;
    // Persist authorization marker BEFORE any reviewer callback.
    await durableCreate(this.dir, `attempt-${String(next).padStart(4, "0")}-consumed.json`, {
      version: "stage-5e1f-ledger-v1", runId: this.runId, ordinal: next,
      claimId: task.claimId, role: task.role, assessmentSide: task.assessmentSide,
      taskSha256: sha256(JSON.stringify(task)), state: "authorization_consumed_before_dispatch",
      maximumModeledUsd: this.costPerCall,
    });
    this.calls = next;
    this.reservedUsd += this.costPerCall;
    return next;
  }

  async recordOutcome(ordinal: number, judgment: unknown) {
    await durableCreate(this.dir, `attempt-${String(ordinal).padStart(4, "0")}-result.json`, {
      version: "stage-5e1f-ledger-v1", runId: this.runId, ordinal,
      judgment, state: "completed_mock_review",
    });
  }

  async finish(report: unknown, markdown: string) {
    await durableCreate(this.dir, "report.json", report);
    await durableCreateText(this.dir, "owner-decision-brief.md", markdown);
  }

  get consumedCalls() { return this.calls; }
  get modeledReservedUsd() { return Number(this.reservedUsd.toFixed(6)); }
}
