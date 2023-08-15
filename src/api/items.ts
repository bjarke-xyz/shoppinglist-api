import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { ItemsRepository } from "../lib/items";
import { ListsRepository } from "../lib/lists";
import { WsGatewayClient } from "../lib/ws-gateway";
import { Env } from "../types";
import { getUserInfo } from "./auth";

export const itemsApi = new Hono<{ Bindings: Env }>();

itemsApi.get("/", async (c) => {
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
      name: z.string().min(1).max(100),
    })
  ),
  async (c) => {
    const user = getUserInfo(c);
    const itemsRepository = ItemsRepository.New(c.env);
    const input = await c.req.json();
    const createdItem = await itemsRepository.createItem(user.sub, input.name);
    return c.json(createdItem);
  }
);

itemsApi.put(
  "/:id",
  zValidator(
    "json",
    z.object({
      name: z.string().min(1).max(100),
    })
  ),
  async (c) => {
    const user = getUserInfo(c);
    const itemsRepository = ItemsRepository.New(c.env);
    const input = await c.req.json();
    const updatedItem = await itemsRepository.updateItem(
      user.sub,
      c.req.param("id"),
      input.name
    );
    return c.json(updatedItem);
  }
);

itemsApi.delete("/:id", async (c) => {
  const user = getUserInfo(c);
  const itemsRepository = ItemsRepository.New(c.env);
  const itemId = c.req.param("id");
  await itemsRepository.deleteItem(user.sub, itemId);
  const notifyFunc = async () => {
    const listsRepository = ListsRepository.New(c.env);
    const lists = await listsRepository.getLists(user.sub);
    for (const list of lists) {
      const wsClient = WsGatewayClient.fromList(c.env, list.id);
      await wsClient.itemDeleted(c.req.header("Client-ID"), {
        itemId,
      });
      // const eventCoordinatorClient = new EventCoordinatorClient(c.env, list.id);
      // await eventCoordinatorClient.itemDeleted(c.req.header("Client-ID"), {
      //   itemId,
      // });
    }
  };
  c.executionCtx.waitUntil(notifyFunc());
  return c.json(null);
});
