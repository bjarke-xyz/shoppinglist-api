import { Context, Next } from "hono";
import { nanoid } from "nanoid";
import { getLogger } from "../util/logger";

export const requestIdContextKey = "request-id-middleware-key";

export function requestIdMiddleware() {
  return async (c: Context, next: Next) => {
    c.set(requestIdContextKey, nanoid());
    await next();
  };
}

export function getRequestId(c: Context): string {
  return c.get(requestIdContextKey);
}

export function requestLogger() {
  return async (c: Context, next: Next) => {
    const start = Date.now();
    try {
      await next();
    } catch (error) {
      throw error;
    } finally {
      const end = Date.now();
      const duration = (end - start).toFixed(2);
      const message = `${c.req.method} ${c.req.path} ${c.res.status} ${c.res.statusText} (${duration}ms)`;
      const logger = getLogger("requests").withContext(c);
      logger.info(message);
    }
  };
}
