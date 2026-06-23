import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db.js";

const listEventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

const eventParamsSchema = z.object({
  id: z.string().min(1)
});

export async function eventRoutes(app: FastifyInstance) {
  app.get("/events", async (request) => {
    const query = listEventsQuerySchema.parse(request.query);

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

    return {
      data: events,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit)
      }
    };
  });

  app.get("/events/:id", async (request, reply) => {
    const params = eventParamsSchema.parse(request.params);

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

    return {
      data: event
    };
  });
}