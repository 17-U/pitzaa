import { NextRequest, NextResponse } from "next/server";
import { authedFetch, ApiError } from "@/lib/api";

interface Order {
  id: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const method = String(form.get("method") ?? "");
  const operator = form.get("operator") ? String(form.get("operator")) : undefined;
  const msisdn = form.get("msisdn") ? String(form.get("msisdn")) : undefined;
  const pin = String(form.get("pin") ?? "");

  const browseUrl = new URL("/gift-cards", request.url);

  let order: Order;
  try {
    order = await authedFetch<Order>(`/gift-cards/listings/${id}/buy`, {
      method: "POST",
      body: { pin, method, operator, msisdn },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      if (error.message.includes("PIN incorrect")) {
        browseUrl.searchParams.set("error", "invalid_pin");
      } else if (error.message.includes("propre annonce")) {
        browseUrl.searchParams.set("error", "own_listing");
      } else if (error.message.includes("insuffisant")) {
        browseUrl.searchParams.set("error", "insufficient_balance");
      } else {
        browseUrl.searchParams.set("error", "server_error");
      }
    } else {
      browseUrl.searchParams.set("error", "server_error");
    }
    return NextResponse.redirect(browseUrl, 303);
  }

  return NextResponse.redirect(new URL(`/gift-cards/orders/mine?boughtOrderId=${order.id}`, request.url), 303);
}
