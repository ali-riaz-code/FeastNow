import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { createBrevoOtpEmailSender } from "./lib/mailer";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

if (!JWT_SECRET || !BREVO_API_KEY || !EMAIL_FROM || !FRONTEND_ORIGIN) {
  throw new Error("Missing required environment variables: JWT_SECRET, BREVO_API_KEY, EMAIL_FROM, FRONTEND_ORIGIN.");
}

const otpEmailSender = createBrevoOtpEmailSender(BREVO_API_KEY, EMAIL_FROM);
const prisma = new PrismaClient();

const app = createApp({
  prisma,
  jwtSecret: JWT_SECRET,
  frontendOrigins: FRONTEND_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  sendOtpEmail: (to, otp) => otpEmailSender.send(to, otp),
});

app.listen(PORT, () => {
  console.log(`FeastNow backend listening on port ${PORT}`);
});
