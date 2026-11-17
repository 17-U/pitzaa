import "server-only";
import { cache } from "react";
import { ApiError, authedFetch, UnauthenticatedError } from "./api";

export interface CurrentUser {
  id: string;
  phone: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  locale: "fr" | "en";
  role: string;
  kycStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  isPremium: boolean;
  trustScore: number;
  lifetimeSalesXaf: number;
  createdAt: string;
}

/** `cache()` dédoublonne l'appel réseau entre tous les composants d'une même requête. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    return await authedFetch<CurrentUser>("/auth/me");
  } catch (error) {
    if (error instanceof UnauthenticatedError) return null;
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
});
