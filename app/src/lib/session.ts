// Same key the landing auth pages write (landing/assets/js/auth.js) —
// same origin, so the session carries straight over into the SPA.
const TOKEN_KEY = "feastnow_token";

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function redirectToLogin(): void {
  window.location.href = "/login.html";
}
