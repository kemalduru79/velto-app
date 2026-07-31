import { withObservedApiRoute } from "@/lib/observability";
import { NextResponse } from "next/server";
import {
  authenticateRequest,
  AuthenticationError,
} from "@/lib/auth/server";
import { CreditEngine, CreditEngineError } from "@/lib/credits";
import { getPersistenceServices } from "@/lib/persistence";

export const runtime = "nodejs";

const creditEngine = new CreditEngine(
  getPersistenceServices().creditRepository,
);

function statusForError(error: unknown) {
  if (error instanceof AuthenticationError) return 401;

  if (error instanceof CreditEngineError) {
    if (error.code === "INVALID_INPUT") return 400;
    if (error.code === "INSUFFICIENT_CREDITS") return 402;
    if (error.code === "RESERVATION_NOT_FOUND") return 404;
    if (
      error.code === "INVALID_RESERVATION_STATE" ||
      error.code === "IDEMPOTENCY_KEY_CONFLICT" ||
      error.code === "IDEMPOTENCY_REQUEST_IN_PROGRESS" ||
      error.code === "IDEMPOTENCY_REQUEST_REPLAYED"
    ) return 409;
  }

  return 500;
}

function errorResponse(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Kredi işlemi tamamlanamadı.";

  return NextResponse.json(
    { ok: false, error: message },
    { status: statusForError(error) },
  );
}

async function getHandler(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const account = await creditEngine.getAccount(principal.id);

    return NextResponse.json({ ok: true, account });
  } catch (error) {
    return errorResponse(error);
  }
}

async function postHandler(request: Request) {
  try {
    const principal = await authenticateRequest(request);
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();

    if (action === "reserve") {
      const result = await creditEngine.reserve({
        userId: principal.id,
        credits: Number(body.credits),
        operationType: String(body.operationType || ""),
        idempotencyKey: String(body.idempotencyKey || ""),
        provider: typeof body.provider === "string" ? body.provider : undefined,
        referenceId:
          typeof body.referenceId === "string" ? body.referenceId : undefined,
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : undefined,
        expiresAt:
          typeof body.expiresAt === "string" ? body.expiresAt : undefined,
      });

      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "settle") {
      const result = await creditEngine.settle({
        userId: principal.id,
        reservationId: String(body.reservationId || ""),
        finalCredits: Number(body.finalCredits),
        providerCostUsd:
          body.providerCostUsd === undefined
            ? undefined
            : Number(body.providerCostUsd),
        providerRequestId:
          typeof body.providerRequestId === "string"
            ? body.providerRequestId
            : undefined,
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      });

      return NextResponse.json({ ok: true, action, ...result });
    }

    if (action === "release") {
      const result = await creditEngine.release({
        userId: principal.id,
        reservationId: String(body.reservationId || ""),
        reason: String(body.reason || ""),
        metadata:
          body.metadata && typeof body.metadata === "object"
            ? (body.metadata as Record<string, unknown>)
            : undefined,
      });

      return NextResponse.json({ ok: true, action, ...result });
    }

    return NextResponse.json(
      { ok: false, error: "Desteklenmeyen kredi işlemi." },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = withObservedApiRoute("api.credits.read", getHandler);
export const POST = withObservedApiRoute("api.credits.mutate", postHandler);
