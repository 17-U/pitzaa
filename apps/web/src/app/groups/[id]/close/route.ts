import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const url = new URL(`/groups/${id}`, request.url);

  try {
    await authedFetch(`/groups/${id}/close`, { method: "POST" });
  } catch {
    url.searchParams.set("error", "server_error");
    return NextResponse.redirect(url, 303);
  }

  url.searchParams.set("success", "group_closed");
  return NextResponse.redirect(url, 303);
}
