import { NextRequest, NextResponse } from "next/server";
import { setSessionCookies } from "@/lib/session";
import { apiFetch, ApiError } from "@/lib/api";

interface VerifyOtpResponse {
  user: { id: string };
  accessToken: string;
  refreshToken: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const phone = String(form.get("phone") ?? "");
  const code = String(form.get("code") ?? "");
  const firstName = form.get("firstName") ? String(form.get("firstName")) : undefined;
  const lastName = form.get("lastName") ? String(form.get("lastName")) : undefined;
  const next = form.get("next") ? String(form.get("next")) : undefined;

  const failureUrl = new URL("/login/verify", request.url);
  failureUrl.searchParams.set("phone", phone);
  if (next) failureUrl.searchParams.set("next", next);

  let result: VerifyOtpResponse;
  try {
    result = await apiFetch<VerifyOtpResponse>("/auth/register-or-login/verify-otp", {
      method: "POST",
      body: { phone, code, firstName, lastName },
    });
  } catch (error) {
    failureUrl.searchParams.set(
      "error",
      error instanceof ApiError && error.status === 400 ? "invalid_code" : "server_error",
    );
    return NextResponse.redirect(failureUrl, 303);
  }

  await setSessionCookies({ accessToken: result.accessToken, refreshToken: result.refreshToken });

  return NextResponse.redirect(new URL(next && next.startsWith("/") ? next : "/dashboard", request.url), 303);
}
