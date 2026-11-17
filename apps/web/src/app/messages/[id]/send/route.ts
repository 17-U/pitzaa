import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const content = String(form.get("content") ?? "");

  const url = new URL(`/messages/${id}`, request.url);
  try {
    await authedFetch(`/conversations/${id}/messages`, { method: "POST", body: { content } });
  } catch {
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(url, 303);
}
