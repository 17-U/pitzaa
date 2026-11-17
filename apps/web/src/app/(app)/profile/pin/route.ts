import { NextRequest, NextResponse } from "next/server";
import { pinCodeSchema } from "@pitzaa/shared";
import { authedFetch, ApiError } from "@/lib/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const pin = String(form.get("pin") ?? "");
  const url = new URL("/profile", request.url);

  if (!pinCodeSchema.safeParse(pin).success) {
    url.searchParams.set("error", "invalid_pin");
    return NextResponse.redirect(url, 303);
  }

  try {
    await authedFetch("/auth/me/pin", { method: "POST", body: { pin } });
  } catch (error) {
    url.searchParams.set(
      "error",
      error instanceof ApiError && error.status === 400 ? "invalid_pin" : "server_error",
    );
    return NextResponse.redirect(url, 303);
  }

  url.searchParams.set("success", "pin_updated");
  return NextResponse.redirect(url, 303);
}
