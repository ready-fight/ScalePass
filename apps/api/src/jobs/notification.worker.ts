import { ConnectionOptions, Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../db.js";
import { env } from "../env.js";
import type { NotificationJobData } from "./notification.queue.js";

const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null
}) as ConnectionOptions;

const worker = new Worker<NotificationJobData>(
    "notifications",
    async (job) => {
        const notification = await prisma.notification.findUnique({
            where: {
                id: job.data.notificationId
            },
            include: {
                user: {
                    select: {
                        email: true
                    }
                }
            }
        });

        if (!notification) {
            return;
        }

        console.log("Sending notification", {
            to: notification.user.email,
            type: notification.type,
            payload: notification.payload
        });

        await prisma.notification.update({
            where: {
                id: notification.id
            },
            data: {
                processedAt: new Date()
            }
        });
    },
    {
        connection
    }
);

worker.on("completed", (job) => {
    console.log(`Notification job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
    console.error(`Notification job failed: ${job?.id}`, error);
});

async function shutdown() {
    await worker.close();
    await (connection as Redis).quit();
    await prisma.$disconnect();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("Notification worker started");