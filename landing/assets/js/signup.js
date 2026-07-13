import {
  isValidEmail, isValidPhone, isValidPassword,
  saveToken, apiPost, showFieldError, clearFieldError,
} from "./auth.js";

const signupForm = document.getElementById("signup-form");
const otpForm = document.getElementById("otp-form");
const nameInput = document.getElementById("signup-name");
const emailInput = document.getElementById("signup-email");
const phoneInput = document.getElementById("signup-phone");
const passwordInput = document.getElementById("signup-password");
const otpInputs = Array.from(document.querySelectorAll(".otp-boxes__input"));
const otpError = document.getElementById("otp-error");
const otpBoxesEl = document.querySelector(".otp-boxes");
const resendBtn = document.getElementById("otp-resend");
const resendCountdown = document.getElementById("otp-resend-countdown");

let pendingSignup = null;
let resendTimer = null;

function startResendCooldown(seconds) {
  let remaining = seconds;
  resendBtn.disabled = true;
  resendCountdown.textContent = `(${remaining}s)`;
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    remaining -= 1;
    resendCountdown.textContent = remaining > 0 ? `(${remaining}s)` : "";
    if (remaining <= 0) {
      clearInterval(resendTimer);
      resendBtn.disabled = false;
    }
  }, 1000);
}

otpInputs.forEach((input, i) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);
    if (input.value && otpInputs[i + 1]) otpInputs[i + 1].focus();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Backspace" && !input.value && otpInputs[i - 1]) {
      otpInputs[i - 1].focus();
    }
  });
});

function otpValue() {
  return otpInputs.map((i) => i.value).join("");
}

function requestOtp(email) {
  return apiPost("/api/auth/signup/request-otp", { email });
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  [nameInput, emailInput, phoneInput, passwordInput].forEach(clearFieldError);

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  const password = passwordInput.value;

  let hasError = false;
  if (!name) { showFieldError(nameInput, "Enter your name."); hasError = true; }
  if (!isValidEmail(email)) { showFieldError(emailInput, "Enter a valid email."); hasError = true; }
  if (!isValidPhone(phone)) { showFieldError(phoneInput, "Enter a valid phone number."); hasError = true; }
  if (!isValidPassword(password)) { showFieldError(passwordInput, "Password must be at least 8 characters."); hasError = true; }
  if (hasError) return;

  const submitBtn = signupForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  const { ok, data } = await requestOtp(email);
  submitBtn.disabled = false;

  if (!ok) {
    showFieldError(emailInput, data.error || "Could not send a verification code.");
    return;
  }

  pendingSignup = { name, email, phone, password };
  signupForm.hidden = true;
  otpForm.hidden = false;
  otpInputs[0].focus();
  startResendCooldown(60);
});

resendBtn.addEventListener("click", async () => {
  if (!pendingSignup || resendBtn.disabled) return;
  resendBtn.disabled = true;
  otpError.textContent = "";
  const { ok, data } = await requestOtp(pendingSignup.email);
  if (!ok) {
    otpError.textContent = data.error || "Could not resend the code. Try again.";
    resendBtn.disabled = false;
    return;
  }
  startResendCooldown(60);
});

otpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  otpError.textContent = "";
  const otp = otpValue();

  if (otp.length !== 6) {
    otpError.textContent = "Enter all 6 digits.";
    return;
  }

  const submitBtn = otpForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  const { ok, data } = await apiPost("/api/auth/signup/verify-otp", { ...pendingSignup, otp });
  submitBtn.disabled = false;

  if (!ok) {
    otpError.textContent = data.error || "Incorrect verification code.";
    otpBoxesEl.classList.add("otp-boxes--shake");
    setTimeout(() => otpBoxesEl.classList.remove("otp-boxes--shake"), 220);
    otpInputs.forEach((i) => { i.value = ""; });
    otpInputs[0].focus();
    return;
  }

  document.querySelector(".authsplit__form").classList.add("authsplit__form--sealed");
  saveToken(data.token);
  setTimeout(() => { window.location.href = "welcome.html"; }, 500);
});
