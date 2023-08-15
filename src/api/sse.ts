import { Hono } from "hono";
import { EventCoordinatorClient } from "../lib/do/event-coordinator";
import { FirebaseAuth } from "../lib/firebase";
import { ListsRepository } from "../lib/lists";
import { WsGatewayClient } from "../lib/ws-gateway";
import { Env } from "../types";
import { getUserInfo } from "./auth";

export const sseApi = new Hono<{ Bindings: Env }>();

sseApi.get("/sse", async (c) => {
  const idToken = c.req.query("idToken");
  const firebaseAuth = FirebaseAuth.New(c.env);
  await firebaseAuth.validateIdToken(idToken);
  const decodedJwt = firebaseAuth.decodeIdToken(idToken);
  const listId = c.req.query("listId");
  if (!listId) {
    return c.json({ error: "no list id provided" }, 400);
  }
  const listsRepository = ListsRepository.New(c.env);
  const list = await listsRepository.getList(decodedJwt.sub, listId);
  if (!list) {
    return c.json({ error: "list not found" }, 400);
  }
  const eventCoordinator = new EventCoordinatorClient(c.env, list.id);
  const resp = await eventCoordinator.addWebSocketSession(
    c.req,
    c.req.query("idToken")
  );
  return new Response(resp.body, resp);
});

sseApi.post("/ws/ticket", async (c) => {
  const user = getUserInfo(c);
  const listId = c.req.query("listId");
  if (!listId) {
    return c.json({ error: "no list id provided" }, 400);
  }
  const listsRepository = ListsRepository.New(c.env);
  const list = await listsRepository.getList(user.sub, listId);
  if (!list) {
    return c.json({ error: "list not found" }, 400);
  }
  const wsGatewayClient = WsGatewayClient.fromList(c.env, list.id);
  const ticket = await wsGatewayClient.createTicket(user.sub);
  const wsUrl = wsGatewayClient.getWsUrl();
  return c.json({
    wsUrl,
    ticket,
  });
});
