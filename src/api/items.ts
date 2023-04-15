import { Hono } from "hono";
import { Env } from "../types";
import { authMiddleware, getUserInfo } from "./auth";

export const itemsApi = new Hono<{ Bindings: Env }>();

itemsApi.use("*", authMiddleware());

itemsApi.get("/", (c) => {
  const user = getUserInfo(c);
  return c.json({
    yo: "yep",
    user,
  });
});
