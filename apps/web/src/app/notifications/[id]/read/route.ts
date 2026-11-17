import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  try {
    await authedFetch(`/notifications/${id}/read`, { method: "POST" });
  } catch {
    // Pas d'action corrective disponible côté formulaire : on retourne simplement à la liste.
  }

  return NextResponse.redirect(new URL("/notifications", request.url), 303);
}
