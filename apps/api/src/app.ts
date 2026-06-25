import Fastify from "fastify";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import { redis } from "./cache.js";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { eventRoutes } from "./modules/events/event.routes.js";
import { reservationRoutes } from "./modules/reservations/reservation.routes.js";
import { closeNotificationQueue } from "./jobs/notification.queue.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.register(jwt, {
    secret: env.JWT_SECRET
  });

  app.register(rateLimit, {
    global: true,
    max: 1000,
    timeWindow: "1 minute",
    redis,
    nameSpace: "scalepass-rate-limit:",
    errorResponseBuilder: () => {
      return {
        error: "Too many requests"
      };
    }
  });

  app.addHook("onClose", async () => {
    await closeNotificationQueue();
    await redis.quit();
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "scalepass-api"
    };
  });

  app.get("/ready", async () => {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();

    return {
      status: "ready",
      database: "connected",
      redis: "connected"
    };
  });

  app.register(authRoutes);
  app.register(eventRoutes);
  app.register(reservationRoutes);

  return app;
}