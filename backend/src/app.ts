import express from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { createUserRepository } from "./repositories/userRepository";
import { createOtpRepository } from "./repositories/otpRepository";
import { createRestaurantRepository } from "./repositories/restaurantRepository";
import { createOrderRepository } from "./repositories/orderRepository";
import { createOwnerRepository } from "./repositories/ownerRepository";
import { createDeliveryRepository } from "./repositories/deliveryRepository";
import { createAuthRouter } from "./routes/authRouter";
import { createMeRouter } from "./routes/meRouter";
import { createCustomerRouter } from "./routes/customerRouter";
import { createCustomerOrdersRouter } from "./routes/customerOrdersRouter";
import { createOwnerRouter } from "./routes/ownerRouter";
import { createOwnerOrdersRouter } from "./routes/ownerOrdersRouter";
import { createOwnerMenuRouter } from "./routes/ownerMenuRouter";
import { createRestaurantsRouter } from "./routes/restaurantsRouter";
import { createSearchRouter } from "./routes/searchRouter";
import { createDeliveryRouter } from "./routes/deliveryRouter";
import { errorHandler } from "./middleware/errorHandler";

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
  const restaurantRepo = createRestaurantRepository(config.prisma);
  const orderRepo = createOrderRepository(config.prisma);
  const ownerRepo = createOwnerRepository(config.prisma);
  const deliveryRepo = createDeliveryRepository(config.prisma);

  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));
  app.use("/api/auth", createAuthRouter({
    userRepo, otpRepo, sendOtpEmail: config.sendOtpEmail, jwtSecret: config.jwtSecret,
  }));
  app.use("/api/me", createMeRouter({ userRepo, jwtSecret: config.jwtSecret }));
  app.use("/api/customer/orders", createCustomerOrdersRouter({ restaurantRepo, orderRepo, jwtSecret: config.jwtSecret }));
  app.use("/api/customer", createCustomerRouter({ restaurantRepo, jwtSecret: config.jwtSecret }));
  app.use("/api/restaurant/orders", createOwnerOrdersRouter({ ownerRepo, orderRepo, deliveryRepo, jwtSecret: config.jwtSecret }));
  app.use("/api/restaurant", createOwnerRouter({ ownerRepo, jwtSecret: config.jwtSecret }));
  app.use("/api/restaurant", createOwnerMenuRouter({ ownerRepo, jwtSecret: config.jwtSecret }));
  app.use("/api/restaurants", createRestaurantsRouter({ restaurantRepo, jwtSecret: config.jwtSecret }));
  app.use("/api/search", createSearchRouter({ restaurantRepo, jwtSecret: config.jwtSecret }));
  app.use("/api/delivery", createDeliveryRouter({ deliveryRepo, jwtSecret: config.jwtSecret }));

  // Must be registered last, after all routers, and keep the 4-arg
  // signature so Express treats it as an error handler.
  app.use(errorHandler);

  return app;
}
