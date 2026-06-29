import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return {
      status: "ok",
      service: "scalepass-api"
    };
  });

  app.get("/ready", async () => {
    return {
      status: "ready"
    };
  });
}