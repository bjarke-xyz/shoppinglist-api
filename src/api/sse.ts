import { Hono } from "hono";
import { Env } from "../types";

export const sseApi = new Hono<{ Bindings: Env }>();

sseApi.get("/sse", async (c) => {
  const { readable, writable } = new TransformStream();
  const encoder = new TextEncoder();
  const writer = writable.getWriter();
  setInterval(() => {
    writer.write(
      encoder.encode(`data: klokken er ${new Date().toTimeString()}\n\n`)
    );
  }, 1000);
  return new Response(readable, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/event-stream",
    },
  });
});
