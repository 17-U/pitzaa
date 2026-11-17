import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const pricePerSlotXaf = form.get("pricePerSlotXaf") ? Number(form.get("pricePerSlotXaf")) : undefined;
  const visibility = form.get("visibility") ? String(form.get("visibility")) : undefined;
  const autoAcceptJoinRequests = form.get("autoAcceptJoinRequests") === "true";

  const url = new URL(`/groups/${id}`, request.url);
  try {
    await authedFetch(`/groups/${id}`, {
      method: "PATCH",
      body: { pricePerSlotXaf, visibility, autoAcceptJoinRequests },
    });
  } catch {
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  url.searchParams.set("success", "group_updated");
  return NextResponse.redirect(url, 303);
}
