import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { ListsRepository } from "../lib/lists";
import { Env } from "../types";
import { getLogger } from "../util/logger";
import { authMiddleware, getUserInfo } from "./auth";
import { ItemsRepository } from "../lib/items";

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

listsApi.get("/:id/items", async (c) => {
  const user = getUserInfo(c);
  const listsRepository = ListsRepository.New(c.env);
  const list = await listsRepository.getList(user.sub, c.req.param("id"));
  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }
  const listItems = await listsRepository.getListItems(list.id);
  return c.json(listItems);
});

listsApi.post(
  "/:id/items",
  zValidator("json", z.object({ itemName: z.string().min(1).max(100) })),
  async (c) => {
    const user = getUserInfo(c);
    const listsRepository = ListsRepository.New(c.env);
    const list = await listsRepository.getList(user.sub, c.req.param("id"));
    if (!list) {
      return c.json({ error: "List not found" }, 404);
    }
    const itemsRepository = ItemsRepository.New(c.env);
    const input = await c.req.json();
    let item = await itemsRepository.getItemByName(user.sub, input.itemName);
    if (!item) {
      item = await itemsRepository.createItem(user.sub, input.itemName);
    }
    await listsRepository.addToList(list.id, item.id);
    const listItems = await listsRepository.getListItems(list.id);
    return c.json(listItems);
  }
);

listsApi.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(100),
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
      name: z.string().min(1).max(100),
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
