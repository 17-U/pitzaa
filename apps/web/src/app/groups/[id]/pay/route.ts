import { NextRequest, NextResponse } from "next/server";
import { authedFetch, ApiError } from "@/lib/api";

interface MembershipPayment {
  id: string;
  status: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const membershipId = String(form.get("membershipId") ?? "");
  const monthsCount = Number(form.get("monthsCount"));
  const method = String(form.get("method") ?? "");
  const operator = form.get("operator") ? String(form.get("operator")) : undefined;
  const msisdn = form.get("msisdn") ? String(form.get("msisdn")) : undefined;
  const pin = String(form.get("pin") ?? "");

  const url = new URL(`/groups/${id}`, request.url);

  let payment: MembershipPayment;
  try {
    payment = await authedFetch<MembershipPayment>(`/memberships/${membershipId}/payments`, {
      method: "POST",
      body: { pin, method, monthsCount, operator, msisdn },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      if (error.message.includes("PIN incorrect")) {
        url.searchParams.set("error", "invalid_pin");
      } else if (error.message.includes("PIN Pitzaa")) {
        url.searchParams.set("error", "no_pin");
      } else if (error.message.includes("insuffisant")) {
        url.searchParams.set("error", "insufficient_balance");
      } else {
        url.searchParams.set("error", "server_error");
      }
    } else {
      url.searchParams.set("error", "server_error");
    }
    return NextResponse.redirect(url, 303);
  }

  url.searchParams.set("success", "payment");
  url.searchParams.set("lastPaymentId", payment.id);
  return NextResponse.redirect(url, 303);
}
