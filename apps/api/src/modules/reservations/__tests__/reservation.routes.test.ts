import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../../../app.js";
import { prisma } from "../../../db.js";

const app = buildApp();

async function resetDatabase() {
  await prisma.reservation.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
}

async function registerUser(email: string) {
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    headers: {
      "content-type": "application/json"
    },
    payload: JSON.stringify({
      email,
      password: "password123"
    })
  });

  expect(response.statusCode).toBe(201);

  const body = JSON.parse(response.body) as {
    token: string;
    user: {
      id: string;
    };
  };

  return body;
}

describe("reservation routes", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("does not overbook an event under concurrent reservation requests", async () => {
    const event = await prisma.event.create({
      data: {
        title: "High Demand Event",
        description: "Concurrency test event",
        startsAt: new Date("2026-12-01T10:00:00.000Z"),
        capacity: 1
      }
    });

    const users = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        registerUser(`user-${Date.now()}-${index}@example.com`)
      )
    );

    const responses = await Promise.all(
      users.map((user) =>
        app.inject({
          method: "POST",
          url: `/events/${event.id}/reservations`,
          headers: {
            authorization: `Bearer ${user.token}`
          }
        })
      )
    );

    expect(responses.every((response) => response.statusCode === 201)).toBe(
      true
    );

    const reservations = await prisma.reservation.findMany({
      where: {
        eventId: event.id
      }
    });

    const confirmedCount = reservations.filter(
      (reservation) => reservation.status === "CONFIRMED"
    ).length;

    const waitlistedCount = reservations.filter(
      (reservation) => reservation.status === "WAITLISTED"
    ).length;

    const updatedEvent = await prisma.event.findUniqueOrThrow({
      where: {
        id: event.id
      }
    });

    expect(confirmedCount).toBe(1);
    expect(waitlistedCount).toBe(9);
    expect(updatedEvent.reservedCount).toBe(1);
  });
});