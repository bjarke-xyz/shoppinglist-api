import { Hono } from "hono";
import { cors } from "hono/cors";
import { authApi, authMiddleware } from "./api/auth";
import { itemsApi } from "./api/items";
import { listsApi } from "./api/lists";
import { requestIdMiddleware } from "./api/middleware";
import { Env } from "./types";
import { getLogger } from "./util/logger";
import { adminApi } from "./api/admin";
import { StatusCode } from "hono/utils/http-status";

const app = new Hono<{ Bindings: Env }>();
app.use(
  "*",
  cors({
    origin: "*",
    maxAge: 86400,
  })
);
app.route("/api/admin", adminApi);
app.route("/api/auth", authApi);
app.route("/api/items", itemsApi);
app.route("/api/lists", listsApi);

app.get("/docs/routes", (c) => {
  return c.json(app.routes);
});

app.onError((err, c) => {
  const logger = getLogger("exception-handler");
  let causeStr = "";
  let status: StatusCode = 500;
  let errorMsg = "An error occured";
  if ((err as any).cause) {
    causeStr = (err as any).cause?.toString() as string;
    if (causeStr?.includes("UNIQUE constraint failed")) {
      status = 409;
    }
  }
  logger.error(`Error occured`, err, causeStr);
  console.log(err);
  return c.json({ error: errorMsg }, status);
});

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return requestIdMiddleware(request, async () => {
      return authMiddleware(request, env, async () => {
        return await app.fetch(request, env, ctx);
      });
    });
  },
};
