import "server-only";
import { getAccessToken } from "./session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(
      typeof body === "object" && body !== null && "message" in body
        ? String((body as { message: unknown }).message)
        : `Erreur API (${status})`,
    );
  }
}

/** Levée quand aucun jeton d'accès n'est disponible : l'appelant doit rediriger vers /login. */
export class UnauthenticatedError extends Error {}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  accessToken?: string;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Appel direct à l'API Pitzaa, sans jeton (ex: OTP, inscription/connexion). */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { accessToken, body, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set("Content-Type", "application/json");
  if (accessToken) finalHeaders.set("Authorization", `Bearer ${accessToken}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const data = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, data);
  }
  return data as T;
}

/** Appel authentifié : lit le jeton d'accès depuis les cookies de session.
 * Lève UnauthenticatedError si aucun jeton n'est présent (le middleware est censé
 * déjà avoir redirigé vers /login dans ce cas ; ceci est un filet de sécurité). */
export async function authedFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const accessToken = options.accessToken ?? (await getAccessToken());
  if (!accessToken) {
    throw new UnauthenticatedError();
  }
  return apiFetch<T>(path, { ...options, accessToken });
}
