import { Hono } from "hono";
import { Env } from "../types";
import { getUserInfo } from "./auth";
import { FirebaseAuth } from "../lib/firebase";

export const adminApi = new Hono<{ Bindings: Env }>();

adminApi.post("/toggle-register", async (c) => {
  const user = getUserInfo(c);
  if (user.sub !== "zq4pVc1bJEhxxQwivOngLFfolI13") {
    return c.text("");
  }
  const firebaseAuth = FirebaseAuth.New(c.env);
  const signupsEnabled = await firebaseAuth.signUpsEnabled();
  const newValue = !signupsEnabled;
  await firebaseAuth.toggleSignUps(newValue);
  return c.json(newValue);
});
