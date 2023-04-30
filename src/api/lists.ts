import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { ListsRepository } from "../lib/lists";
import { Env } from "../types";
import { getLogger } from "../util/logger";
import { authMiddleware, getUserInfo } from "./auth";

export const listsApi = new Hono<{ Bindings: Env }>();

const logger = getLogger("api.lists");

listsApi.use("*", authMiddleware());

listsApi.get("/", async (c) => {
  const l = logger.withContext(c);
  const user = getUserInfo(c);
  const listsRepository = ListsRepository.New(c.env);
  const lists = await listsRepository.getLists(user.sub);
  return c.json(lists);
});

listsApi.post(
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
    const listsRepository = ListsRepository.New(c.env);
    const input = await c.req.json();
    const createdList = await listsRepository.createList(user.sub, input.name);
    return c.json(createdList);
  }
);

listsApi.put(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string(),
    })
  ),
  async (c) => {
    const l = logger.withContext(c);
    const user = getUserInfo(c);
    const listsRepository = ListsRepository.New(c.env);
    const input = await c.req.json();
    const updatedList = await listsRepository.updateList(
      user.sub,
      c.req.param("id"),
      input.name
    );
    return c.json(updatedList);
  }
);

listsApi.delete("/:id", async (c) => {
  const user = getUserInfo(c);
  const listsRepository = ListsRepository.New(c.env);
  await listsRepository.deleteList(user.sub, c.req.param("id"));
  return c.json(null);
});
