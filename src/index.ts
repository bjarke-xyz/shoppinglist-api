import { Hono } from "hono";
import { cors } from "hono/cors";
import { authApi, authMiddleware } from "./api/auth";
import { itemsApi } from "./api/items";
import { listsApi } from "./api/lists";
import { requestIdMiddleware } from "./api/middleware";
import { Env } from "./types";
import { getLogger } from "./util/logger";

const app = new Hono<{ Bindings: Env }>();
app.use(
  "/api/*",
  cors({
    origin: "*",
    maxAge: 86400,
  })
);
app.route("/api/auth", authApi);
app.route("/api/items", itemsApi);
app.route("/api/lists", listsApi);

app.onError((err, c) => {
  const logger = getLogger("exception-handler");
  logger.error(`Error occured`, err);
  console.error(err);
  if ((err as any).cause) {
    const cause = (err as any).cause?.toString() as string;
    if (cause?.includes("UNIQUE constraint failed")) {
      return c.json(
        {
          error: "An error occured",
        },
        409
      );
    }
  }
  return c.json(
    {
      error: "An error occured",
    },
    500
  );
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
