import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> },
): Promise<NextResponse> {
  const { membershipId } = await params;
  const form = await request.formData();
  const groupId = String(form.get("groupId") ?? "");
  const url = new URL(`/groups/${groupId}`, request.url);

  try {
    await authedFetch(`/groups/memberships/${membershipId}/accept`, { method: "POST" });
  } catch {
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(url, 303);
}
