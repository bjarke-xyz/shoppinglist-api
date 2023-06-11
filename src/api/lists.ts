import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { ItemsRepository } from "../lib/items";
import { ListsRepository } from "../lib/lists";
import { Env } from "../types";
import { getUserInfo } from "./auth";
import { EventCoordinatorClient } from "../lib/do/event-coordinator";

export const listsApi = new Hono<{ Bindings: Env }>();

// Get all lists
listsApi.get("/", async (c) => {
  const user = getUserInfo(c);
  const listsRepository = ListsRepository.New(c.env);
  const lists = await listsRepository.getLists(user.sub);
  return c.json(lists);
});

// Create list
listsApi.post(
  "/",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(100),
    })
  ),
  async (c) => {
    const user = getUserInfo(c);
    const listsRepository = ListsRepository.New(c.env);
    const input = await c.req.json();
    const createdList = await listsRepository.createList(user.sub, input.name);
    return c.json(createdList);
  }
);

// Update list
listsApi.put(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(100),
    })
  ),
  async (c) => {
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

// Delete list
listsApi.delete("/:id", async (c) => {
  const user = getUserInfo(c);
  const listsRepository = ListsRepository.New(c.env);
  await listsRepository.deleteList(user.sub, c.req.param("id"));
  // TODO: return 204 empty
  return c.json(null);
});

// Get list items
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

// Add item to list
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
    const eventCoordinatorClient = new EventCoordinatorClient(c.env, list.id);
    await eventCoordinatorClient.listItemAdded(c.req.header("Client-ID"), {
      listItems: listItems,
      addedItem: item,
    });
    const response = {
      listItems,
      addedItem: item,
    };
    return c.json(response);
  }
);

// Delete item from list
listsApi.patch(
  "/:id/items/delete",
  zValidator("json", z.object({ itemIds: z.array(z.string()) })),
  async (c) => {
    const user = getUserInfo(c);
    const listsRepository = ListsRepository.New(c.env);
    const list = await listsRepository.getList(user.sub, c.req.param("id"));
    if (!list) {
      return c.json({ error: "List not found" }, 404);
    }
    const input: { itemIds: string[] } = await c.req.json();
    await listsRepository.removeFromList(list.id, input.itemIds);
    const eventCoordinatorClient = new EventCoordinatorClient(c.env, list.id);
    eventCoordinatorClient.listItemsRemoved(c.req.header("Client-ID"), {
      itemIds: input.itemIds,
    });
    // TODO: return 204 empty
    return c.json(null);
  }
);

// Toggle list item crossed status
listsApi.patch(
  "/:id/items/:itemId/crossed",
  zValidator("json", z.object({ crossed: z.boolean() })),
  async (c) => {
    const user = getUserInfo(c);
    const listsRepository = ListsRepository.New(c.env);
    const list = await listsRepository.getList(user.sub, c.req.param("id"));
    if (!list) {
      return c.json({ error: "List not found" }, 404);
    }
    const input: { crossed: boolean } = await c.req.json();
    const itemId = c.req.param("itemId");
    await listsRepository.crossListItem(list.id, itemId, input.crossed);
    const eventCoordinatorClient = new EventCoordinatorClient(c.env, list.id);
    await eventCoordinatorClient.listItemCrossed(c.req.header("Client-ID"), {
      itemId: itemId,
      crossed: input.crossed,
    });
    // TODO: return 204 empty
    return c.json(null);
  }
);
