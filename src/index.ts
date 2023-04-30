import { Hono } from "hono";
import { cors } from "hono/cors";
import { authApi } from "./api/auth";
import { itemsApi } from "./api/items";
import { requestIdMiddleware, requestLogger } from "./api/middleware";
import { getLogger } from "./util/logger";
import { listsApi } from "./api/lists";

const app = new Hono();
app.use("/api/*", requestIdMiddleware());
app.use("/api/*", requestLogger());
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
  const logger = getLogger("exception-handler").withContext(c);
  logger.error(`Error occured`, err);
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

export default app;
