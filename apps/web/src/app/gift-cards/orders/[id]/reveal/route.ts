import { NextRequest, NextResponse } from "next/server";
import { authedFetch, ApiError, UnauthenticatedError } from "@/lib/api";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  try {
    const result = await authedFetch<{ code: string }>(`/gift-cards/orders/${id}/reveal-code`, {
      method: "POST",
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Vous devez être connecté." }, { status: 401 });
    }
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Une erreur est survenue, merci de réessayer." }, { status: 500 });
  }
}
