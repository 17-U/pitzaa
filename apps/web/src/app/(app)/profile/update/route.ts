import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const firstName = form.get("firstName") ? String(form.get("firstName")) : undefined;
  const lastName = form.get("lastName") ? String(form.get("lastName")) : undefined;
  const locale = form.get("locale") ? String(form.get("locale")) : undefined;

  const url = new URL("/profile", request.url);
  try {
    await authedFetch("/auth/me", {
      method: "PATCH",
      body: { firstName, lastName, locale },
    });
  } catch {
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  url.searchParams.set("success", "profile_updated");
  return NextResponse.redirect(url, 303);
}
