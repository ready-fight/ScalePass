import { ConnectionOptions, Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env.js";

export type NotificationJobData = {
    notificationId: string;
};

const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null
}) as ConnectionOptions;

export const notificationQueue = new Queue<NotificationJobData>(
    "notifications",
    {
        connection
    }
);

export async function enqueueNotification(notificationId: string) {
    await notificationQueue.add(
        "send-notification",
        {
            notificationId
        },
        {
            attempts: 3,
            backoff: {
                type: "exponential",
                delay: 1000
            },
            removeOnComplete: 1000,
            removeOnFail: 1000
        }
    );
}

export async function closeNotificationQueue() {
    await notificationQueue.close();
    await (connection as Redis).quit();
}