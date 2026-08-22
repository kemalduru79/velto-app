import { createHash } from "node:crypto";
import type { MeteredOperationType } from "../../credits/operationPolicy.ts";
import type { StockMediaType } from "./types.ts";

export function stockCommercialAcquisitionIdentity(input: { mediaType: StockMediaType; providerMediaId: string }) { return createHash("sha256").update(`pexels:${input.mediaType}:${input.providerMediaId}`).digest("hex"); }
export function stockCreditOperation(mediaType: StockMediaType): MeteredOperationType { return mediaType === "photo" ? "creator_stock_photo" : "creator_stock_video"; }
