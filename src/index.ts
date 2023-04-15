import { Hono } from "hono";
import { cors } from "hono/cors";
import { authApi } from "./api/auth";
import { itemsApi } from "./api/items";

const app = new Hono();
app.use("*", cors());
app.route("/api/auth", authApi);
app.route("/api/items", itemsApi);

export default app;
