import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  try {
    await authedFetch(`/disputes/${id}/cancel`, { method: "POST" });
  } catch {
    // Pas d'action corrective disponible côté formulaire : on retourne simplement à la liste.
  }

  return NextResponse.redirect(new URL("/disputes/mine", request.url), 303);
}
