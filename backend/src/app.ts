import express from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { createUserRepository } from "./repositories/userRepository";
import { createOtpRepository } from "./repositories/otpRepository";
import { createAuthRouter } from "./routes/authRouter";
import { createMeRouter } from "./routes/meRouter";

export interface AppConfig {
  prisma: PrismaClient;
  jwtSecret: string;
  frontendOrigins: string[];
  sendOtpEmail: (to: string, otp: string) => Promise<void>;
}

export function createApp(config: AppConfig) {
  const app = express();
  app.use(cors({ origin: config.frontendOrigins }));
  app.use(express.json());

  const userRepo = createUserRepository(config.prisma);
  const otpRepo = createOtpRepository(config.prisma);

  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
  app.use("/api/auth", createAuthRouter({
    userRepo, otpRepo, sendOtpEmail: config.sendOtpEmail, jwtSecret: config.jwtSecret,
  }));
  app.use("/api/me", createMeRouter({ userRepo, jwtSecret: config.jwtSecret }));

  return app;
}
