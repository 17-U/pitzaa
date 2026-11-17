import { NextRequest, NextResponse } from "next/server";
import { authedFetch } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const form = await request.formData();
  const reason = String(form.get("reason") ?? "");

  try {
    await authedFetch(`/gift-cards/listings/${id}/reject`, { method: "POST", body: { reason } });
  } catch {
    // Pas d'action corrective disponible côté formulaire : on retourne simplement à la file.
  }

  return NextResponse.redirect(new URL("/gift-cards/admin/pending", request.url), 303);
}
