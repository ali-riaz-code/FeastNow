import "dotenv/config";
import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { sendOtpEmail as sendOtpEmailRaw } from "./lib/mailer";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

if (!JWT_SECRET || !RESEND_API_KEY || !EMAIL_FROM || !FRONTEND_ORIGIN) {
  throw new Error("Missing required environment variables: JWT_SECRET, RESEND_API_KEY, EMAIL_FROM, FRONTEND_ORIGIN.");
}

const resend = new Resend(RESEND_API_KEY);
const prisma = new PrismaClient();

const app = createApp({
  prisma,
  jwtSecret: JWT_SECRET,
  frontendOrigins: FRONTEND_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  sendOtpEmail: (to, otp) => sendOtpEmailRaw(resend, EMAIL_FROM, to, otp),
});

app.listen(PORT, () => {
  console.log(`FeastNow backend listening on port ${PORT}`);
});
