import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const payload = String(form.get("payload") ?? "");

  const url = new URL(`/groups/${id}`, request.url);
  try {
    await authedFetch(`/groups/${id}/vault`, { method: "POST", body: { payload } });
  } catch {
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  url.searchParams.set("success", "vault_updated");
  return NextResponse.redirect(url, 303);
}
