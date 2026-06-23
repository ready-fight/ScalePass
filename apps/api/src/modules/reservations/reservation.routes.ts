import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db.js";

type AuthUser = {
  sub: string;
  role: "USER" | "ADMIN";
};

const eventParamsSchema = z.object({
  eventId: z.string().min(1)
});

export async function reservationRoutes(app: FastifyInstance) {
  app.post("/events/:eventId/reservations", async (request, reply) => {
    let authUser: AuthUser;

    try {
      authUser = await request.jwtVerify<AuthUser>();
    } catch {
      return reply.code(401).send({
        error: "Unauthorized"
      });
    }

    const params = eventParamsSchema.parse(request.params);

    const result = await prisma.$transaction(async (tx) => {
      const existingReservation = await tx.reservation.findUnique({
        where: {
          userId_eventId: {
            userId: authUser.sub,
            eventId: params.eventId
          }
        }
      });

      if (
        existingReservation &&
        existingReservation.status !== "CANCELLED"
      ) {
        return {
          type: "existing" as const,
          reservation: existingReservation
        };
      }

      const event = await tx.event.findUnique({
        where: {
          id: params.eventId
        },
        select: {
          id: true
        }
      });

      if (!event) {
        return {
          type: "not_found" as const
        };
      }

      const updatedRows = await tx.$executeRaw`
        UPDATE "Event"
        SET "reservedCount" = "reservedCount" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${params.eventId}
          AND "reservedCount" < "capacity"
      `;

      const status = updatedRows === 1 ? "CONFIRMED" : "WAITLISTED";

      if (existingReservation) {
        const reservation = await tx.reservation.update({
          where: {
            id: existingReservation.id
          },
          data: {
            status
          }
        });

        return {
          type: "created" as const,
          reservation
        };
      }

      const reservation = await tx.reservation.create({
        data: {
          userId: authUser.sub,
          eventId: params.eventId,
          status
        }
      });

      return {
        type: "created" as const,
        reservation
      };
    });

    if (result.type === "not_found") {
      return reply.code(404).send({
        error: "Event not found"
      });
    }

    if (result.type === "existing") {
      return reply.code(409).send({
        error: "Reservation already exists",
        reservation: result.reservation
      });
    }

    return reply.code(201).send({
      data: result.reservation
    });
  });

  app.get("/me/reservations", async (request, reply) => {
    let authUser: AuthUser;

    try {
      authUser = await request.jwtVerify<AuthUser>();
    } catch {
      return reply.code(401).send({
        error: "Unauthorized"
      });
    }

    const reservations = await prisma.reservation.findMany({
      where: {
        userId: authUser.sub
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        event: {
          select: {
            id: true,
            title: true,
            startsAt: true,
            capacity: true,
            reservedCount: true
          }
        }
      }
    });

    return {
      data: reservations
    };
  });
}