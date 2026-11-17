import { NextRequest, NextResponse } from "next/server";
import { authedFetch, ApiError } from "@/lib/api";

interface CreatedListing {
  id: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const brandId = String(form.get("brandId") ?? "");
  const balanceXaf = Number(form.get("balanceXaf"));
  const askingPriceXaf = Number(form.get("askingPriceXaf"));
  const expiresAt = form.get("expiresAt") ? String(form.get("expiresAt")) : undefined;
  const code = String(form.get("code") ?? "");

  let listing: CreatedListing;
  try {
    listing = await authedFetch<CreatedListing>("/gift-cards/listings", {
      method: "POST",
      body: { brandId, balanceXaf, askingPriceXaf, expiresAt, code },
    });
  } catch (error) {
    const url = new URL("/gift-cards/create", request.url);
    if (error instanceof ApiError && error.status === 400) {
      url.searchParams.set(
        "error",
        error.message.includes("300 000") ? "monthly_cap" : "resale_not_allowed",
      );
    } else {
      url.searchParams.set("error", "server_error");
    }
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL(`/gift-cards/mine?createdListingId=${listing.id}`, request.url), 303);
}
