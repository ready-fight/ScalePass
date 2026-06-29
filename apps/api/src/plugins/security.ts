import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";

export async function registerSecurityPlugins(app: FastifyInstance) {
  await app.register(helmet);

  await app.register(cors, {
    origin: true,
    credentials: true
  });

  await app.register(rateLimit, {
    max: 300,
    timeWindow: "1 minute"
  });
}