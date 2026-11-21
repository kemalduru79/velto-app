import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import { getOwnerStorageQuotaStatus } from "@/lib/persistence/media/storageQuota.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const storage = await getOwnerStorageQuotaStatus(principal.id);
    return NextResponse.json({ ok: true, storage }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ ok: false, error: "A valid session is required." }, { status: 401, headers: NO_STORE });
    }
    console.error("storage-usage error:", error);
    return NextResponse.json({ ok: false, error: "Storage usage is temporarily unavailable." }, { status: 503, headers: NO_STORE });
  }
}
