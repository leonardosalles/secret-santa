import { IS_TEST_MODE } from "@/lib/app-config";
import { NextResponse } from "next/server";
import { areDrawsOpen, DRAW_UNLOCK_AT } from "@/lib/draw-schedule";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { unlocked: IS_TEST_MODE || areDrawsOpen(), unlockAt: DRAW_UNLOCK_AT },
    { headers: { "Cache-Control": "no-store" } },
  );
}
