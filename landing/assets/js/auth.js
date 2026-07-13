import { API_BASE_URL } from "./config.js";

const TOKEN_KEY = "feastnow_token";

export function isValidEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value) {
  return typeof value === "string" && /^\+?\d{7,15}$/.test(value.replace(/[\s-]/g, ""));
}

export function isValidPassword(value) {
  return typeof value === "string" && value.length >= 8;
}

export function saveToken(token) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiPost(path, body) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error — check your connection and try again." } };
  }
}

export async function apiGet(path, token) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "Network error — check your connection and try again." } };
  }
}

export function showFieldError(inputEl, message) {
  const field = inputEl.closest(".field");
  if (!field) return;
  field.classList.add("field--error");
  const errorEl = field.querySelector(".field__error");
  if (errorEl) errorEl.textContent = message;
}

export function clearFieldError(inputEl) {
  const field = inputEl.closest(".field");
  if (!field) return;
  field.classList.remove("field--error");
  const errorEl = field.querySelector(".field__error");
  if (errorEl) errorEl.textContent = "";
}
