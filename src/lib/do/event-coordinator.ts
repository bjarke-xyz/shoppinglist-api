import { Context, Hono } from "hono";
import { Env } from "../../types";
import { FirebaseAuth } from "../firebase";
import { Item } from "../items";
import { ListItem } from "../lists";

/**
 * SSE did not work: https://github.com/cloudflare/workers-sdk/issues/3289
 */

export class EventCoordinator {
  state: DurableObjectState;
  env: Env;
  app = new Hono();
  sessions: SessionInfo[] = [];
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    this.app.get("/ws", (c) => {
      if (c.req.headers.get("Upgrade") != "websocket") {
        return new Response("expected websocket", { status: 400 });
      }
      const pair = new WebSocketPair();
      this.handleSession(pair[1], c);
      return new Response(null, { status: 101, webSocket: pair[0] });
    });

    this.app.get("/sessions", (c) => {
      return c.text(this.sessions.length.toString());
    });

    this.app.post("/broadcast", async (c) => {
      const input: BroadcastPayload = await c.req.json();
      this.broadcast(input);
      return c.text("");
    });
  }

  private async handleSession(webSocket: WebSocket, c: Context): Promise<void> {
    webSocket.accept();
    const idToken = c.req.query("idToken");
    if (!idToken) {
      return this.closeWebSocket(webSocket, "No id token.");
    }
    const firebaseAuth = FirebaseAuth.New(this.env);
    try {
      await firebaseAuth.validateIdToken(idToken);
    } catch (error) {
      return this.closeWebSocket(
        webSocket,
        `Failed to validate id token: ${error}`
      );
    }
    const decodedToken = firebaseAuth.decodeIdToken(idToken);
    const sessionInfo: SessionInfo = { webSocket, userId: decodedToken.sub };
    this.sessions.push(sessionInfo);
    let closeOrErrorHandler = () => {
      this.sessions = this.sessions.filter((x) => x !== sessionInfo);
    };
    webSocket.addEventListener("close", closeOrErrorHandler);
    webSocket.addEventListener("error", closeOrErrorHandler);
  }

  private broadcast(payload: BroadcastPayload): void {
    for (const session of this.sessions) {
      session.webSocket.send(JSON.stringify(payload));
    }
  }

  private closeWebSocket(webSocket: WebSocket, error: string): void {
    webSocket.send(JSON.stringify({ error }));
    webSocket.close(1009, error);
  }

  async fetch(request: Request) {
    return this.app.fetch(request);
  }
}

export class EventCoordinatorClient {
  do: DurableObjectStub;
  private readonly baseUrl = "https://dummy-url";
  constructor(env: Env, listId: string) {
    const id = env.EVENTCOORDINATOR.idFromName(`list:${listId}`);
    this.do = env.EVENTCOORDINATOR.get(id);
  }

  async addWebSocketSession(
    req: RequestInit<RequestInitCfProperties>,
    idToken: string | undefined
  ): Promise<Response> {
    return await this.do.fetch(`${this.baseUrl}/ws?idToken=${idToken}`, req);
  }

  async getSessions(): Promise<number> {
    const resp = await this.do.fetch(`${this.baseUrl}/sessions`);
    const respText = await resp.text();
    const number = parseInt(respText);
    return number;
  }

  async listItemAdded(data: ListItemAddEvent): Promise<void> {
    return await this.broadcast({
      type: "ListItemAdded",
      data,
    });
  }

  async listItemsRemoved(data: ListItemsRemoved): Promise<void> {
    return await this.broadcast({
      type: "ListItemsRemoved",
      data,
    });
  }

  async listItemCrossed(data: ListItemCrossed): Promise<void> {
    return await this.broadcast({
      type: "ListItemCrossed",
      data,
    });
  }

  private async broadcast(payload: BroadcastPayload): Promise<void> {
    await this.do.fetch(`${this.baseUrl}/broadcast`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
}

interface SessionInfo {
  webSocket: WebSocket;
  userId: string;
}

type EventType = "ListItemAdded" | "ListItemsRemoved" | "ListItemCrossed";
type EventData = ListItemAddEvent | ListItemsRemoved | ListItemCrossed;
interface BroadcastPayload {
  type: EventType;
  data: EventData;
}
interface ListItemAddEvent {
  listItems: ListItem[];
  addedItem: Item;
}
interface ListItemsRemoved {
  itemIds: string[];
}
interface ListItemCrossed {
  itemId: string;
  crossed: boolean;
}
