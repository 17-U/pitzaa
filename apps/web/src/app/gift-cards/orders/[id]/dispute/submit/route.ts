import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const reason = String(form.get("reason") ?? "");

  try {
    await authedFetch(`/gift-cards/orders/${id}/dispute`, { method: "POST", body: { reason } });
  } catch {
    const url = new URL(`/gift-cards/orders/${id}/dispute`, request.url);
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  const url = new URL("/gift-cards/orders/mine", request.url);
  url.searchParams.set("disputed", "1");
  return NextResponse.redirect(url, 303);
}
