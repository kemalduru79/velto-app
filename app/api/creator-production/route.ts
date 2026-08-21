import { handleCreatorProductionRequest } from "../../../lib/creator/services/creatorProduction.server";

export async function POST(req: Request) {
  return handleCreatorProductionRequest(req);
}
