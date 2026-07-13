import { getToken, clearToken, apiGet } from "./auth.js";

async function init() {
  const token = getToken();
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  const { ok, data } = await apiGet("/api/me", token);
  if (!ok) {
    clearToken();
    window.location.href = "login.html";
    return;
  }

  document.getElementById("welcome-message").textContent =
    `Welcome, ${data.name} — your table is being set.`;
}

init();
