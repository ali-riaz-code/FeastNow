import "dotenv/config";
import nodemailer from "nodemailer";
import { PrismaClient } from "@prisma/client";
import { createApp } from "./app";
import { sendOtpEmail as sendOtpEmailRaw } from "./lib/mailer";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

if (!JWT_SECRET || !GMAIL_USER || !GMAIL_APP_PASSWORD || !FRONTEND_ORIGIN) {
  throw new Error("Missing required environment variables: JWT_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD, FRONTEND_ORIGIN.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

const prisma = new PrismaClient();

const app = createApp({
  prisma,
  jwtSecret: JWT_SECRET,
  frontendOrigins: FRONTEND_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean),
  sendOtpEmail: (to, otp) => sendOtpEmailRaw(transporter, to, otp),
});

app.listen(PORT, () => {
  console.log(`FeastNow backend listening on port ${PORT}`);
});
