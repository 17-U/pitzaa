import { NextRequest, NextResponse } from "next/server";
import { authedFetch, ApiError } from "@/lib/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const amountXaf = Number(form.get("amountXaf"));
  const operator = String(form.get("operator") ?? "");
  const destinationMsisdn = String(form.get("destinationMsisdn") ?? "");
  const otpCode = String(form.get("otpCode") ?? "");

  try {
    await authedFetch("/withdrawals", {
      method: "POST",
      body: { amountXaf, operator, destinationMsisdn, otpCode },
    });
  } catch (error) {
    const url = new URL("/withdrawals", request.url);
    url.searchParams.set("otpRequested", "1");
    url.searchParams.set(
      "error",
      error instanceof ApiError && error.status === 400 ? "invalid_otp" : "server_error",
    );
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL("/withdrawals", request.url), 303);
}
