import { API_BASE_URL } from "./config";
import { clearToken, getToken, redirectToLogin } from "./session";

/** Fetch-level failure. Deliberately does NOT clear the token — a network
 *  blip must never log the user out (same rule as the welcome page). */
export class NetworkError extends Error {
  constructor() { super("Network error — check your connection and try again."); }
}

/** Non-OK HTTP response (excluding 401, which is handled separately). Carries
 *  the status code so callers can branch on it (e.g. 404 vs. generic). */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body?: unknown) {
    super(`Request failed (${status}).`);
    this.status = status;
    this.body = body;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error("No session.");
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new NetworkError();
  }
  if (res.status === 401) {
    clearToken();
    redirectToLogin();
    throw new Error("Session expired.");
  }
  if (!res.ok) throw new ApiError(res.status);
  return res.json() as Promise<T>;
}

export async function apiSend<T>(method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error("No session.");
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new NetworkError();
  }
  if (res.status === 401) {
    clearToken();
    redirectToLogin();
    throw new Error("Session expired.");
  }
  if (!res.ok) {
    let parsed: unknown;
    try { parsed = await res.json(); } catch { parsed = undefined; }
    throw new ApiError(res.status, parsed);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
