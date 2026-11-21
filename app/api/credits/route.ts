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
  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401 },
    );
  }

  if (error instanceof CreditEngineError) {
    return NextResponse.json(
      { ok: false, error: "Credit account could not be loaded." },
      { status: statusForError(error) },
    );
  }

  return NextResponse.json(
    { ok: false, error: "Credit account could not be loaded." },
    { status: 500 },
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

async function postHandler() {
  return NextResponse.json(
    {
      ok: false,
      error: "Credit mutations are not available through this endpoint.",
    },
    { status: 405, headers: { Allow: "GET" } },
  );
}

export const GET = withObservedApiRoute("api.credits.read", getHandler);
export const POST = withObservedApiRoute("api.credits.mutate", postHandler);
