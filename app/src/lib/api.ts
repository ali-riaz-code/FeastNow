import { API_BASE_URL } from "./config";
import { clearToken, getToken, redirectToLogin } from "./session";

/** Fetch-level failure. Deliberately does NOT clear the token — a network
 *  blip must never log the user out (same rule as the welcome page). */
export class NetworkError extends Error {
  constructor() { super("Network error — check your connection and try again."); }
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
  if (!res.ok) throw new Error(`Request failed (${res.status}).`);
  return res.json() as Promise<T>;
}
