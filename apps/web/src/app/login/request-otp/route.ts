import { NextRequest, NextResponse } from "next/server";
import { phoneNumberSchema } from "@pitzaa/shared";
import { apiFetch, ApiError } from "@/lib/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const phone = String(form.get("phone") ?? "");
  const next = form.get("next") ? String(form.get("next")) : undefined;

  const parsed = phoneNumberSchema.safeParse(phone);
  if (!parsed.success) {
    const url = new URL("/login", request.url);
    url.searchParams.set("error", "invalid_phone");
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  try {
    await apiFetch("/auth/register-or-login/request-otp", {
      method: "POST",
      body: { phone },
    });
  } catch (error) {
    const url = new URL("/login", request.url);
    url.searchParams.set(
      "error",
      error instanceof ApiError && error.status === 429 ? "too_many_requests" : "server_error",
    );
    if (next) url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const verifyUrl = new URL("/login/verify", request.url);
  verifyUrl.searchParams.set("phone", phone);
  if (next) verifyUrl.searchParams.set("next", next);
  return NextResponse.redirect(verifyUrl, 303);
}
