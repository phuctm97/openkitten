import { redisURL } from "~/lib/redis-url";

export const redis = new Bun.RedisClient(redisURL);
