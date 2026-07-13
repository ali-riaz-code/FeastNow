import { getToken, clearToken, apiGet } from "./auth.js";

async function init() {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const { ok, status, data } = await apiGet("/api/me", token);
  if (!ok) {
    if (status === 0) {
      document.getElementById("welcome-message").textContent =
        data.error || "Network error — check your connection and try again.";
      return;
    }
    clearToken();
    window.location.href = "login.html";
    return;
  }

  document.getElementById("welcome-message").textContent =
    `Welcome, ${data.name} — your table is being set.`;
}

init();
