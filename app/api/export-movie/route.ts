import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: "VERCEL EXPORT TEST 2026-04-19",
    },
    { status: 500 }
  );
}