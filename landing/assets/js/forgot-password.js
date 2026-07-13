import { isValidEmail, showFieldError, clearFieldError } from "./auth.js";

const form = document.getElementById("fp-form");
const confirmation = document.getElementById("fp-confirmation");
const emailInput = document.getElementById("fp-email");

form.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldError(emailInput);

  const email = emailInput.value.trim();
  if (!isValidEmail(email)) {
    showFieldError(emailInput, "Enter a valid email.");
    return;
  }

  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  // Mocked backend: always shows the same confirmation after a short delay,
  // regardless of whether the email exists — matches the real backend's
  // no-enumeration posture (see the backend plan's login endpoint).
  setTimeout(() => {
    form.hidden = true;
    confirmation.hidden = false;
  }, 600);
});
