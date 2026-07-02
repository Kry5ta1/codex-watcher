import { NextResponse } from "next/server";
import { loadStatus } from "../../../lib/codex.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await loadStatus();
  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
