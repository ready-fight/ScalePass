import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.event.createMany({
    data: [
      {
        title: "Tokyo Tech Conference",
        description: "A large-scale engineering event about scalable systems.",
        startsAt: new Date("2026-09-01T10:00:00.000Z"),
        capacity: 500
      },
      {
        title: "Osaka Startup Meetup",
        description: "Networking event for founders, developers, and investors.",
        startsAt: new Date("2026-09-10T09:00:00.000Z"),
        capacity: 150
      },
      {
        title: "Game Backend Architecture Summit",
        description: "Backend architecture patterns for online games and live services.",
        startsAt: new Date("2026-10-05T13:00:00.000Z"),
        capacity: 300
      }
    ],
    skipDuplicates: true
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });