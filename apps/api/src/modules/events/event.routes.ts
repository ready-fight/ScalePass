import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getJson, setJson } from "../../cache.js";
import { prisma } from "../../db.js";

const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const eventParamsSchema = z.object({
  id: z.string().min(1)
});

const EVENT_CACHE_TTL_SECONDS = 30;

export async function eventRoutes(app: FastifyInstance) {
  app.get("/events", async (request, reply) => {
    const query = listEventsQuerySchema.parse(request.query);

    const cacheKey = `events:list:page=${query.page}:limit=${query.limit}`;
    const cached = await getJson(cacheKey);

    if (cached) {
      reply.header("x-cache", "HIT");
      return cached;
    }

    const skip = (query.page - 1) * query.limit;

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        orderBy: {
          startsAt: "asc"
        },
        skip,
        take: query.limit,
        select: {
          id: true,
          title: true,
          description: true,
          startsAt: true,
          capacity: true,
          reservedCount: true
        }
      }),

      prisma.event.count()
    ]);

    const responseBody = {
      data: events,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };

    await setJson(cacheKey, responseBody, EVENT_CACHE_TTL_SECONDS);

    reply.header("x-cache", "MISS");
    return responseBody;
  });

  app.get("/events/:id", async (request, reply) => {
    const params = eventParamsSchema.parse(request.params);

    const cacheKey = `events:detail:${params.id}`;
    const cached = await getJson(cacheKey);

    if (cached) {
      reply.header("x-cache", "HIT");
      return cached;
    }

    const event = await prisma.event.findUnique({
      where: {
        id: params.id
      },
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        capacity: true,
        reservedCount: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!event) {
      return reply.code(404).send({
        error: "Event not found"
      });
    }

    const responseBody = {
      data: event
    };

    await setJson(cacheKey, responseBody, EVENT_CACHE_TTL_SECONDS);

    reply.header("x-cache", "MISS");
    return responseBody;
  });
}