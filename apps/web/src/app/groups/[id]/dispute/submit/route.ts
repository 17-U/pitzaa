import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const membershipPaymentId = String(form.get("membershipPaymentId") ?? "");
  const reason = String(form.get("reason") ?? "");

  try {
    await authedFetch(`/memberships/payments/${membershipPaymentId}/no-access`, {
      method: "POST",
      body: { reason },
    });
  } catch {
    const url = new URL(`/groups/${id}/dispute`, request.url);
    url.searchParams.set("membershipPaymentId", membershipPaymentId);
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  const url = new URL(`/groups/${id}`, request.url);
  url.searchParams.set("disputed", "1");
  return NextResponse.redirect(url, 303);
}
