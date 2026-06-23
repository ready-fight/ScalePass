import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { prisma } from "./db.js";
import { env } from "./env.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { eventRoutes } from "./modules/events/event.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: true
  });

  app.register(jwt, {
    secret: env.JWT_SECRET
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "scalepass-api"
    };
  });

  app.get("/ready", async () => {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "ready",
      database: "connected"
    };
  });

  app.register(authRoutes);
  app.register(eventRoutes);

  return app;
}