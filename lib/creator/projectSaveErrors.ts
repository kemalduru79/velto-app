const SAVE_CODES = new Set([
  "PROJECT_SAVE_CONFLICT", "PROJECT_REVISION_REQUIRED", "PROJECT_FLOW_TYPE_MISMATCH",
  "CREATOR_PROJECT_STATE_REPAIR_REQUIRED", "CREATOR_PROJECT_STATE_INVALID",
  "CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED", "CREATOR_SCRIPT_MUTATION_STALE", "CREATOR_SCRIPT_MUTATION_INVALID",
  "CREATOR_SCRIPT_MUTATION_INVALID_TRANSITION", "CREATOR_SCRIPT_APPROVAL_FORGED", "CREATOR_SCRIPT_VERIFICATION_FORGED",
  "PROJECT_SAVE_RESPONSE_IDENTITY_INVALID", "PROJECT_SAVE_NETWORK_ERROR", "PROJECT_SAVE_RESPONSE_INVALID", "PROJECT_SAVE_FAILED",
]);
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export class CreatorProjectSaveError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(input: { code?: unknown; status: number }) {
    const code = typeof input.code === "string" && SAVE_CODES.has(input.code) ? input.code : "PROJECT_SAVE_FAILED";
    super(code);
    this.name = "CreatorProjectSaveError";
    this.code = code;
    this.status = Number.isInteger(input.status) && input.status >= 0 && input.status <= 599 ? input.status : 0;
  }
}

export async function readCreatorProjectSaveResponse(response: Response) {
  const data: unknown = await response.json().catch(() => {
    throw new CreatorProjectSaveError({ code: "PROJECT_SAVE_RESPONSE_INVALID", status: response.status });
  });
  if (!response.ok) throw new CreatorProjectSaveError({ code: record(data).code, status: response.status });
  const project = record(record(data).project);
  if (typeof project.id !== "string" || !project.id || typeof project.updated_at !== "string" || !project.updated_at)
    throw new CreatorProjectSaveError({ code: "PROJECT_SAVE_RESPONSE_INVALID", status: response.status });
  return data as { project: { id: string; updated_at: string }; [key: string]: unknown };
}

export function classifyCreatorProjectSaveFailure(error: unknown) {
  if (error instanceof CreatorProjectSaveError) {
    if (error.code === "CREATOR_PROJECT_STATE_REPAIR_REQUIRED" || error.code === "CREATOR_SCRIPT_MUTATION_AUTHORITY_REQUIRED") return "repair_required" as const;
    if (error.code === "PROJECT_SAVE_CONFLICT" || error.code === "CREATOR_SCRIPT_MUTATION_STALE") return "cas_conflict" as const;
    if (error.status === 401 || error.status === 403) return "authentication" as const;
    if (error.code === "PROJECT_SAVE_RESPONSE_IDENTITY_INVALID") return "project_identity" as const;
    if (error.status === 404) return "project_identity" as const;
    if (error.status === 413) return "payload_size" as const;
    if (error.code === "PROJECT_SAVE_NETWORK_ERROR") return "network" as const;
    if (error.code === "PROJECT_SAVE_RESPONSE_INVALID") return "invalid_response" as const;
    if (error.status >= 500) return "server" as const;
    if (error.status === 400 || error.status === 409 || error.status === 422) return "validation" as const;
  }
  const message = error instanceof Error ? error.message : "";
  if (/PROJECT_SAVE_CONFLICT|project changed|script changed/i.test(message)) return "cas_conflict" as const;
  if (/session|oturum|auth|Unauthorized/i.test(message)) return "authentication" as const;
  if (/not found|owned/i.test(message)) return "project_identity" as const;
  if (/required|zorunlu|invalid/i.test(message)) return "validation" as const;
  if (error instanceof TypeError && /fetch|network|load failed/i.test(message)) return "network" as const;
  return "persistence_failure" as const;
}

/** No raw message, response body, token, payload or URL enters this diagnostic. */
export function creatorProjectSaveFailureDiagnostic(error: unknown) {
  return {
    category: classifyCreatorProjectSaveFailure(error),
    status: error instanceof CreatorProjectSaveError ? error.status : null,
    code: error instanceof CreatorProjectSaveError ? error.code : "UNCLASSIFIED_SAVE_ERROR",
    errorType: error instanceof CreatorProjectSaveError ? "CreatorProjectSaveError" :
      error instanceof TypeError ? "TypeError" : error instanceof SyntaxError ? "SyntaxError" : error instanceof Error ? "Error" : "Unknown",
  };
}

export function creatorProjectSaveRecoveryMessage(error: unknown, language: "en" | "tr") {
  const category = classifyCreatorProjectSaveFailure(error);
  const en = language === "en";
  if (category === "repair_required") return en
    ? "The saved project state needs repair before saving. Keep this tab open to preserve your local work; do not refresh or regenerate assets."
    : "Kayıtlı proje durumu kaydetmeden önce onarım gerektiriyor. Yerel çalışmanı korumak için bu sekmeyi açık tut; sayfayı yenileme veya varlıkları yeniden üretme.";
  if (category === "cas_conflict") return en
    ? "The saved project revision changed. Keep this tab open and compare the saved version before retrying; your local work has not been overwritten."
    : "Kayıtlı proje sürümü değişti. Bu sekmeyi açık tut ve tekrar denemeden önce kayıtlı sürümü karşılaştır; yerel çalışmanın üzerine yazılmadı.";
  if (category === "authentication") return en ? "Your session expired. Keep this tab open and sign in before retrying the save." : "Oturumun sona erdi. Bu sekmeyi açık tut ve kaydetmeyi tekrar denemeden önce giriş yap.";
  if (category === "network") return en ? "The save connection failed. Keep this tab open and retry saving when connected." : "Kaydetme bağlantısı başarısız oldu. Bu sekmeyi açık tut ve bağlantı sağlandığında tekrar kaydet.";
  if (category === "payload_size") return en ? "The project save exceeds the server request limit. Keep this tab open; the project needs a save-size review." : "Proje kaydı sunucu istek sınırını aşıyor. Bu sekmeyi açık tut; kayıt boyutu incelenmeli.";
  return en ? "The project could not be saved. Keep this tab open and retry saving; check the safe error code if it continues." : "Proje kaydedilemedi. Bu sekmeyi açık tut ve tekrar kaydet; sorun sürerse güvenli hata kodunu kontrol et.";
}
