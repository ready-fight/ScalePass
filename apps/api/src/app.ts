import Fastify from "fastify";
import { registerSecurityPlugins } from "./plugins/security.js";
import { healthRoutes } from "./routes/health.js";

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === "production" ? "info" : "debug"
    }
  });

  await registerSecurityPlugins(app);

  await app.register(healthRoutes);

  app.get("/", async () => {
    return {
      name: "ScalePass AWS API",
      status: "running"
    };
  });

  return app;
}