import { invalidateEventCache } from "../events/event.cache.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../db.js";
import { enqueueNotification } from "../../jobs/notification.queue.js";

type AuthUser = {
  sub: string;
  role: "USER" | "ADMIN";
};

const eventParamsSchema = z.object({
  eventId: z.string().min(1)
});

const reservationParamsSchema = z.object({
  reservationId: z.string().min(1)
});

export async function reservationRoutes(app: FastifyInstance) {
  app.post("/events/:eventId/reservations",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
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

          const notification = await tx.notification.create({
            data: {
              userId: authUser.sub,
              reservationId: reservation.id,
              type:
                status === "CONFIRMED"
                  ? "RESERVATION_CONFIRMED"
                  : "RESERVATION_WAITLISTED",
              payload: {
                eventId: params.eventId,
                status
              }
            }
          });

          return {
            type: "created" as const,
            reservation,
            notificationIds: [notification.id]
          };
        }

        const reservation = await tx.reservation.create({
          data: {
            userId: authUser.sub,
            eventId: params.eventId,
            status
          }
        });

        const notification = await tx.notification.create({
          data: {
            userId: authUser.sub,
            reservationId: reservation.id,
            type:
              status === "CONFIRMED"
                ? "RESERVATION_CONFIRMED"
                : "RESERVATION_WAITLISTED",
            payload: {
              eventId: params.eventId,
              status
            }
          }
        });

        return {
          type: "created" as const,
          reservation,
          notificationIds: [notification.id]
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

      await invalidateEventCache(params.eventId);

      await Promise.all(
        result.notificationIds.map((notificationId) =>
          enqueueNotification(notificationId)
        )
      );

      return reply.code(201).send({
        data: result.reservation
      });
    });

  app.delete("/me/reservations/:reservationId", async (request, reply) => {
    let authUser: AuthUser;

    try {
      authUser = await request.jwtVerify<AuthUser>();
    } catch {
      return reply.code(401).send({
        error: "Unauthorized"
      });
    }

    const params = reservationParamsSchema.parse(request.params);

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: {
          id: params.reservationId,
          userId: authUser.sub
        }
      });

      if (!reservation) {
        return {
          type: "not_found" as const
        };
      }

      if (reservation.status === "CANCELLED") {
        return {
          type: "already_cancelled" as const,
          reservation
        };
      }

      await tx.$queryRaw`
        SELECT "id"
        FROM "Event"
        WHERE "id" = ${reservation.eventId}
        FOR UPDATE
      `;

      const cancelledReservation = await tx.reservation.update({
        where: {
          id: reservation.id
        },
        data: {
          status: "CANCELLED"
        }
      });

      const notificationIds: string[] = [];

      const cancellationNotification = await tx.notification.create({
        data: {
          userId: authUser.sub,
          reservationId: cancelledReservation.id,
          type: "RESERVATION_CANCELLED",
          payload: {
            eventId: reservation.eventId
          }
        }
      });

      notificationIds.push(cancellationNotification.id);

      let promotedReservation = null;

      if (reservation.status === "CONFIRMED") {
        const nextWaitlistedReservation = await tx.reservation.findFirst({
          where: {
            eventId: reservation.eventId,
            status: "WAITLISTED"
          },
          orderBy: {
            createdAt: "asc"
          }
        });

        if (nextWaitlistedReservation) {
          promotedReservation = await tx.reservation.update({
            where: {
              id: nextWaitlistedReservation.id
            },
            data: {
              status: "CONFIRMED"
            }
          });

          const promotionNotification = await tx.notification.create({
            data: {
              userId: promotedReservation.userId,
              reservationId: promotedReservation.id,
              type: "WAITLIST_PROMOTED",
              payload: {
                eventId: reservation.eventId
              }
            }
          });

          notificationIds.push(promotionNotification.id);
        } else {
          await tx.event.updateMany({
            where: {
              id: reservation.eventId,
              reservedCount: {
                gt: 0
              }
            },
            data: {
              reservedCount: {
                decrement: 1
              }
            }
          });
        }
      }

      return {
        type: "cancelled" as const,
        cancelledReservation,
        promotedReservation,
        notificationIds
      };
    });

    if (result.type === "not_found") {
      return reply.code(404).send({
        error: "Reservation not found"
      });
    }

    if (result.type === "already_cancelled") {
      return reply.code(409).send({
        error: "Reservation already cancelled",
        reservation: result.reservation
      });
    }

    await invalidateEventCache(result.cancelledReservation.eventId);

    await Promise.all(
      result.notificationIds.map((notificationId) =>
        enqueueNotification(notificationId)
      )
    );

    return {
      data: {
        cancelledReservation: result.cancelledReservation,
        promotedReservation: result.promotedReservation
      }
    };
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