import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  await authedFetch("/withdrawals/otp", { method: "POST" });

  const url = new URL("/withdrawals", request.url);
  url.searchParams.set("otpRequested", "1");
  return NextResponse.redirect(url, 303);
}
