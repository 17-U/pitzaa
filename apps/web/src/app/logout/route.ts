import { NextRequest, NextResponse } from "next/server";
import { apiFetch } from "@/lib/api";
import { clearSessionCookies, getAccessToken, getRefreshToken } from "@/lib/session";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const accessToken = await getAccessToken();
  const refreshToken = await getRefreshToken();

  if (accessToken) {
    try {
      await apiFetch("/auth/logout", {
        method: "POST",
        accessToken,
        body: refreshToken ? { refreshToken } : {},
      });
    } catch {
      // Les jetons sont de toute façon effacés localement ci-dessous.
    }
  }

  await clearSessionCookies();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
