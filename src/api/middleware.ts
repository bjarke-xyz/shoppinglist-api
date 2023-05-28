import { Context, Next } from "hono";
import { nanoid } from "nanoid";
import { getLogger } from "../util/logger";
import { AsyncLocalStorage } from "node:async_hooks";

export const requestIdStore = new AsyncLocalStorage<string>();

export async function requestIdMiddleware(
  request: Request,
  next: () => Promise<Response>
): Promise<Response> {
  return requestIdStore.run(nanoid(), next);
}
