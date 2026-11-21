import { randomUUID } from "node:crypto";

const REQUIRED_CONFIRMATION = "STAGE_0_7D_2_DISPOSABLE_ONLY";
const STAGE = "0.7D-2-live-entitlement-admission-smoke";
const GRANT_BYTES = 123_456;
const args = process.argv.slice(2);

if (args.length !== 1 || args[0] !== "--apply" || process.env.VELTO_LIVE_STORAGE_SMOKE_CONFIRM !== REQUIRED_CONFIRMATION) {
  console.log("NO_MUTATION");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const entitlementId = randomUUID();
const duplicateEntitlementId = randomUUID();
const admissionId = randomUUID();
const expiredAdmissionId = randomUUID();
const wrongOwnerId = randomUUID();
const externalReference = `stage-0-7d-2-live-smoke:${randomUUID()}`;
const disposableMetadata = { stage: STAGE, disposable: true };
const generatedIds = {
  velto_storage_entitlements: [entitlementId, duplicateEntitlementId],
  velto_storage_admissions: [admissionId, expiredAdmissionId],
};

let ownerUserId = "";
let additionalBytesBefore = 0;
let additionalBytesDuring = 0;
let additionalBytesAfter = 0;
let mutationAttempted = false;
let admissionReplayProtected = false;
let expiredAdmissionProtected = false;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

async function getAdditionalBytes() {
  const { data, error } = await supabase.rpc("velto_get_additional_storage_bytes", {
    p_owner_user_id: ownerUserId,
  });
  if (error) throw new Error(`Entitlement total failed: ${error.message}`);
  const bytes = Number(data ?? 0);
  ensure(Number.isSafeInteger(bytes) && bytes >= 0, "Entitlement total was invalid.");
  return bytes;
}

async function beginAdmission(targetOwnerId, targetAdmissionId) {
  const { data, error } = await supabase.rpc("velto_begin_storage_admission_consumption", {
    p_owner_user_id: targetOwnerId,
    p_admission_id: targetAdmissionId,
    p_media_kind: "image",
    p_purpose: "creator_generated_image",
  });
  if (error) throw new Error(`Admission BEGIN failed: ${error.message}`);
  ensure(Array.isArray(data) && data.length === 1, "Admission BEGIN returned an invalid contract.");
  return data[0];
}

async function verifyDisposableRows(table, ids) {
  const { data, error } = await supabase.from(table)
    .select("id,owner_user_id,metadata")
    .in("id", ids);
  if (error) throw new Error(`Cleanup verification failed for ${table}: ${error.message}`);
  for (const row of data || []) {
    ensure(ids.includes(row.id), `Cleanup refused unexpected ${table} id.`);
    ensure(row.owner_user_id === ownerUserId, `Cleanup refused wrong-owner ${table} row.`);
    ensure(row.metadata?.stage === STAGE && row.metadata?.disposable === true, `Cleanup refused non-disposable ${table} row.`);
  }
  return data || [];
}

async function cleanupDisposableRows() {
  for (const [table, ids] of Object.entries(generatedIds)) {
    const rows = await verifyDisposableRows(table, ids);
    for (const row of rows) {
      const { data, error } = await supabase.from(table).delete()
        .eq("id", row.id)
        .eq("owner_user_id", ownerUserId)
        .contains("metadata", disposableMetadata)
        .select("id");
      if (error || data?.length !== 1 || data[0]?.id !== row.id) {
        throw new Error(`Cleanup could not prove exact deletion for ${table}:${row.id} (${error?.message || "unexpected result"}).`);
      }
    }
  }
  for (const [table, ids] of Object.entries(generatedIds)) {
    const remaining = await verifyDisposableRows(table, ids);
    ensure(remaining.length === 0, `Cleanup left disposable rows in ${table}.`);
  }
  additionalBytesAfter = await getAdditionalBytes();
  ensure(additionalBytesAfter === additionalBytesBefore, "Entitlement bytes did not return to baseline.");
}

let smokeError = null;
try {
  const { data: usersPage, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (usersError) throw new Error(`Existing owner lookup failed: ${usersError.message}`);
  ownerUserId = usersPage.users[0]?.id || "";
  ensure(ownerUserId.length > 0, "No existing auth owner is available.");
  ensure(wrongOwnerId !== ownerUserId, "Generated wrong-owner identity collided with the selected owner.");

  additionalBytesBefore = await getAdditionalBytes();
  mutationAttempted = true;
  const { data: entitlement, error: entitlementError } = await supabase.from("velto_storage_entitlements").insert({
    id: entitlementId,
    owner_user_id: ownerUserId,
    bytes_granted: GRANT_BYTES,
    status: "active",
    source: "manual",
    external_reference: externalReference,
    metadata: disposableMetadata,
  }).select("id,owner_user_id,bytes_granted,status,source,external_reference,metadata").single();
  if (entitlementError) throw new Error(`Disposable entitlement insert failed: ${entitlementError.message}`);
  ensure(entitlement.id === entitlementId && entitlement.owner_user_id === ownerUserId, "Disposable entitlement identity mismatch.");
  ensure(Number(entitlement.bytes_granted) === GRANT_BYTES && entitlement.status === "active" && entitlement.source === "manual", "Disposable entitlement contract mismatch.");
  ensure(entitlement.external_reference === externalReference && entitlement.metadata?.stage === STAGE && entitlement.metadata?.disposable === true, "Disposable entitlement metadata mismatch.");

  additionalBytesDuring = await getAdditionalBytes();
  ensure(additionalBytesDuring === additionalBytesBefore + GRANT_BYTES, "Active entitlement did not add the exact test grant.");

  const { error: duplicateError } = await supabase.from("velto_storage_entitlements").insert({
    id: duplicateEntitlementId,
    owner_user_id: ownerUserId,
    bytes_granted: GRANT_BYTES,
    status: "active",
    source: "manual",
    external_reference: externalReference,
    metadata: disposableMetadata,
  });
  ensure(duplicateError?.code === "23505", `Duplicate source/external_reference did not return unique violation (${duplicateError?.code || "accepted"}).`);

  const now = Date.now();
  const { data: admission, error: admissionError } = await supabase.from("velto_storage_admissions").insert({
    id: admissionId,
    owner_user_id: ownerUserId,
    media_kind: "image",
    purpose: "creator_generated_image",
    expires_at: new Date(now + 30 * 60_000).toISOString(),
    metadata: disposableMetadata,
  }).select("id,owner_user_id,media_kind,purpose,metadata").single();
  if (admissionError) throw new Error(`Disposable admission insert failed: ${admissionError.message}`);
  ensure(admission.id === admissionId && admission.owner_user_id === ownerUserId && admission.media_kind === "image" && admission.purpose === "creator_generated_image", "Disposable admission identity mismatch.");
  ensure(admission.metadata?.stage === STAGE && admission.metadata?.disposable === true, "Disposable admission metadata mismatch.");

  const wrongOwnerBegin = await beginAdmission(wrongOwnerId, admissionId);
  ensure(wrongOwnerBegin.status === "not_found" && wrongOwnerBegin.consumption_token === null, "Wrong owner did not receive not_found.");
  const firstBegin = await beginAdmission(ownerUserId, admissionId);
  ensure(firstBegin.status === "ready" && typeof firstBegin.consumption_token === "string" && firstBegin.consumption_token.length > 0, "First BEGIN was not ready with a token.");
  const firstToken = firstBegin.consumption_token;
  const repeatedBegin = await beginAdmission(ownerUserId, admissionId);
  ensure(repeatedBegin.status === "consumption_pending", "Second BEGIN was not replay-protected.");

  const { data: wrongComplete, error: wrongCompleteError } = await supabase.rpc("velto_complete_storage_admission_consumption", {
    p_owner_user_id: ownerUserId,
    p_admission_id: admissionId,
    p_consumption_token: randomUUID(),
  });
  if (wrongCompleteError) throw new Error(`Wrong-token COMPLETE call failed unexpectedly: ${wrongCompleteError.message}`);
  ensure(wrongComplete === "token_mismatch", "Wrong COMPLETE token was not rejected.");

  const { data: abortStatus, error: abortError } = await supabase.rpc("velto_abort_storage_admission_consumption", {
    p_owner_user_id: ownerUserId,
    p_admission_id: admissionId,
    p_consumption_token: firstToken,
  });
  if (abortError) throw new Error(`Admission ABORT failed: ${abortError.message}`);
  ensure(abortStatus === "aborted", "Admission ABORT did not return aborted.");

  const secondBegin = await beginAdmission(ownerUserId, admissionId);
  ensure(secondBegin.status === "ready" && typeof secondBegin.consumption_token === "string", "Admission was not reusable after ABORT.");
  const { data: completeStatus, error: completeError } = await supabase.rpc("velto_complete_storage_admission_consumption", {
    p_owner_user_id: ownerUserId,
    p_admission_id: admissionId,
    p_consumption_token: secondBegin.consumption_token,
  });
  if (completeError) throw new Error(`Admission COMPLETE failed: ${completeError.message}`);
  ensure(completeStatus === "consumed", "Admission COMPLETE did not consume the admission.");
  const consumedBegin = await beginAdmission(ownerUserId, admissionId);
  ensure(consumedBegin.status === "consumed", "Consumed admission was replayable.");
  admissionReplayProtected = true;

  const { error: expiredInsertError } = await supabase.from("velto_storage_admissions").insert({
    id: expiredAdmissionId,
    owner_user_id: ownerUserId,
    media_kind: "image",
    purpose: "creator_generated_image",
    created_at: new Date(now - 60 * 60_000).toISOString(),
    expires_at: new Date(now - 30 * 60_000).toISOString(),
    metadata: disposableMetadata,
  });
  if (expiredInsertError) throw new Error(`Expired admission insert failed: ${expiredInsertError.message}`);
  const expiredBegin = await beginAdmission(ownerUserId, expiredAdmissionId);
  ensure(expiredBegin.status === "expired", "Expired admission was not rejected.");
  expiredAdmissionProtected = true;
} catch (error) {
  smokeError = error instanceof Error ? error : new Error("Unknown live entitlement/admission smoke failure.");
}

let cleanupError = null;
if (mutationAttempted) {
  try {
    await cleanupDisposableRows();
  } catch (error) {
    cleanupError = error instanceof Error ? error : new Error("Unknown cleanup failure.");
  }
}

if (cleanupError) {
  console.error(JSON.stringify({ status: "CLEANUP_REQUIRED", ownerUserId, generatedIds, error: cleanupError.message }, null, 2));
  process.exitCode = 2;
} else if (smokeError) {
  console.error(JSON.stringify({ status: "FAIL", ownerUserId, cleanupVerified: mutationAttempted, error: smokeError.message }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    status: "PASS",
    ownerUserId,
    grantBytes: GRANT_BYTES,
    additionalBytesBefore,
    additionalBytesDuring,
    additionalBytesAfter,
    admissionReplayProtected,
    expiredAdmissionProtected,
    cleanupVerified: true,
  }, null, 2));
  console.log("STAGE_0_7D_2_LIVE_ENTITLEMENT_ADMISSION_SMOKE=PASS");
}
