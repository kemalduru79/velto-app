export class PersistenceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_STORAGE_INPUT"
      | "STORAGE_UPLOAD_FAILED"
      | "STORAGE_PUBLIC_URL_FAILED"
      | "STORAGE_STAT_FAILED",
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PersistenceError";
  }
}
