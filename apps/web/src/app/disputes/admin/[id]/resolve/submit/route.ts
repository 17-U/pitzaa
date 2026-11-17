import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const outcome = String(form.get("outcome") ?? "");
  const notes = String(form.get("notes") ?? "");

  try {
    await authedFetch(`/disputes/${id}/resolve`, { method: "POST", body: { outcome, notes } });
  } catch {
    const url = new URL(`/disputes/admin/${id}/resolve`, request.url);
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL("/disputes/admin/pending", request.url), 303);
}
