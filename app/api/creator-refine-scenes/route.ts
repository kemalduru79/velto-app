import { handleCreatorRefineScenesRequest } from "../../../lib/creator/services/creatorRefineScenes.server";

export async function POST(req: Request) {
  return handleCreatorRefineScenesRequest(req);
}
