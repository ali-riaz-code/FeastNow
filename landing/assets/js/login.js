import { isValidEmail, isValidPhone, isValidPassword, saveToken, apiPost, showFieldError, clearFieldError } from "./auth.js";

const form = document.getElementById("login-form");
const identifierInput = document.getElementById("login-identifier");
const passwordInput = document.getElementById("login-password");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearFieldError(identifierInput);
  clearFieldError(passwordInput);

  const identifier = identifierInput.value.trim();
  const password = passwordInput.value;

  let hasError = false;
  if (!identifier || (!isValidEmail(identifier) && !isValidPhone(identifier))) {
    showFieldError(identifierInput, "Enter a valid email or phone number.");
    hasError = true;
  }
  if (!isValidPassword(password)) {
    showFieldError(passwordInput, "Password must be at least 8 characters.");
    hasError = true;
  }
  if (hasError) return;

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  const { ok, data } = await apiPost("/api/auth/login", { identifier, password });
  submitBtn.disabled = false;

  if (!ok) {
    showFieldError(passwordInput, data.error || "Incorrect email/phone or password.");
    return;
  }

  saveToken(data.token);
  window.location.href = "/app/";
});
