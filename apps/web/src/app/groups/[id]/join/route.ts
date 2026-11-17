import { NextRequest, NextResponse } from "next/server";
import { authedFetch, ApiError } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const url = new URL(`/groups/${id}`, request.url);

  try {
    await authedFetch(`/groups/${id}/join`, { method: "POST" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 400) {
      url.searchParams.set(
        "error",
        error.message.includes("complet") ? "full" : "already_pending",
      );
    } else {
      url.searchParams.set("error", "server_error");
    }
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.redirect(url, 303);
}
