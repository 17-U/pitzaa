import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const message = String(form.get("message") ?? "");

  try {
    await authedFetch(`/disputes/${id}/respond`, { method: "POST", body: { message } });
  } catch {
    const url = new URL(`/disputes/${id}/respond`, request.url);
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL("/disputes/mine", request.url), 303);
}
