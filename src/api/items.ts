import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { ItemsRepository } from "../lib/items";
import { Env } from "../types";
import { getLogger } from "../util/logger";
import { authMiddleware, getUserInfo } from "./auth";
import { requestLogger } from "./middleware";

export const itemsApi = new Hono<{ Bindings: Env }>();

const logger = getLogger("api.items");

itemsApi.use("*", authMiddleware());

itemsApi.get("/", async (c) => {
  const l = logger.withContext(c);
  const user = getUserInfo(c);
  const itemsRepository = ItemsRepository.New(c.env);
  const items = await itemsRepository.getItems(user.sub);
  return c.json(items);
});

itemsApi.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z.string(),
    })
  ),
  async (c) => {
    const l = logger.withContext(c);
    const user = getUserInfo(c);
    const itemsRepository = ItemsRepository.New(c.env);
    const input = await c.req.json();
    const createdItem = await itemsRepository.createItem(user.sub, input.name);
    return c.json(createdItem);
  }
);
