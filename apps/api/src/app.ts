import Fastify from "fastify";

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
    return {
      status: "ready"
    };
  });

  return app;
}