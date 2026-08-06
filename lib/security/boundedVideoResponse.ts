import {
  SafeMediaError,
  verifyMediaBytes,
} from "@/lib/security/safeRemoteMediaFetch";

export async function readBoundedVerifiedVideoResponse(
  response: Response,
  maxBytes: number,
) {
  if (!response.body) {
    throw new SafeMediaError(502, "Video output body is unavailable.");
  }
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body.cancel();
    throw new SafeMediaError(413, "Video output exceeds the configured size limit.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new SafeMediaError(413, "Video output exceeds the configured size limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) {
    throw new SafeMediaError(422, "Video output is empty.");
  }

  const buffer = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return verifyMediaBytes(
    buffer,
    response.headers.get("content-type") || undefined,
    "video",
  );
}
