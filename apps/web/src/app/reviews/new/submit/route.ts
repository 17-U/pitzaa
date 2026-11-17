import { NextRequest, NextResponse } from "next/server";
import { authedFetch, ApiError } from "@/lib/api";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const membershipPaymentId = form.get("membershipPaymentId") ? String(form.get("membershipPaymentId")) : undefined;
  const giftCardOrderId = form.get("giftCardOrderId") ? String(form.get("giftCardOrderId")) : undefined;
  const rating = Number(form.get("rating"));
  const comment = form.get("comment") ? String(form.get("comment")) : undefined;

  const backUrl = membershipPaymentId
    ? `/reviews/new?membershipPaymentId=${membershipPaymentId}`
    : `/reviews/new?giftCardOrderId=${giftCardOrderId}`;

  try {
    await authedFetch("/reviews", {
      method: "POST",
      body: { membershipPaymentId, giftCardOrderId, rating, comment },
    });
  } catch (error) {
    const url = new URL(backUrl, request.url);
    url.searchParams.set(
      "error",
      error instanceof ApiError && error.message.includes("déjà laissé") ? "already_reviewed" : "server_error",
    );
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL("/profile", request.url), 303);
}
