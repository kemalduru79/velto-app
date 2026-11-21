import { NextResponse } from "next/server";
import { authenticateRequest, AuthenticationError } from "@/lib/auth/server";
import {
  getCreatorProductionSnapshotForOwner,
  listCreatorProductionSnapshotsForOwner,
} from "@/lib/persistence/projects/creatorProductionHistory.server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const principal = await authenticateRequest(request);
    const { projectId } = await context.params;
    const snapshotId = new URL(request.url).searchParams.get("snapshotId")?.trim() || "";
    if (!projectId) return NextResponse.json({ error: "projectId is required." }, { status: 400 });
    if (snapshotId) {
      const snapshot = await getCreatorProductionSnapshotForOwner({ projectId, snapshotId, ownerUserId: principal.id });
      if (!snapshot) return NextResponse.json({ error: "Historical production was not found." }, { status: 404 });
      return NextResponse.json({ success: true, snapshot });
    }
    const snapshots = await listCreatorProductionSnapshotsForOwner(projectId, principal.id);
    return NextResponse.json({ success: true, snapshots });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }
    console.error("creator-production-history error:", error);
    return NextResponse.json({ error: "Historical production could not be loaded." }, { status: 500 });
  }
}
