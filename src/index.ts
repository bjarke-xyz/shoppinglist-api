import { Hono } from "hono";
import { authApi } from "./api/auth";

const app = new Hono();
app.route("/api/auth", authApi);

export default app;
