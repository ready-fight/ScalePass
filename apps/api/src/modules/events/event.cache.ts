import { redis } from "../../cache.js";

export async function invalidateEventCache(eventId: string) {
  await redis.del(`events:detail:${eventId}`);

  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      "MATCH",
      "events:list:*",
      "COUNT",
      100
    );

    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}