import Fastify from "fastify";
import { prisma } from "./db.js";

export function buildApp() {
  const app = Fastify({
    logger: true
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

  return app;
}