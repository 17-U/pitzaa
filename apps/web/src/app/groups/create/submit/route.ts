import { NextRequest, NextResponse } from "next/server";
import { authedFetch, ApiError } from "@/lib/api";

interface CreatedGroup {
  id: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const serviceId = String(form.get("serviceId") ?? "");
  const pricePerSlotXaf = Number(form.get("pricePerSlotXaf"));
  const totalSlots = Number(form.get("totalSlots"));
  const visibility = String(form.get("visibility") ?? "PRIVATE");
  const autoAcceptJoinRequests = form.get("autoAcceptJoinRequests") === "true";

  let group: CreatedGroup;
  try {
    group = await authedFetch<CreatedGroup>("/groups", {
      method: "POST",
      body: { serviceId, pricePerSlotXaf, totalSlots, visibility, autoAcceptJoinRequests },
    });
  } catch (error) {
    const url = new URL("/groups/create", request.url);
    if (error instanceof ApiError && error.status === 400) {
      url.searchParams.set(
        "error",
        error.message.includes("places") ? "too_many_slots" : "invalid_service",
      );
    } else {
      url.searchParams.set("error", "server_error");
    }
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(new URL(`/groups/${group.id}`, request.url), 303);
}
