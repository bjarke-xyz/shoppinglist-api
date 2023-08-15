import { Env } from "../types";
import { Item } from "./items";
import { ListItem } from "./lists";

interface TicketRequest {
  userId: string;
  topic: string;
}
interface TicketResponse {
  token: string;
}
export function getWsTopicFromList(listId: string) {
  return `LIST:${listId}`;
}

const wsGatewayUrl = "https://ws-gateway.fly.dev";
export class WsGatewayClient {
  constructor(
    private appId: string,
    private apiKey: string,
    private topic: string
  ) {}

  public static fromList(env: Env, listId: string) {
    return new WsGatewayClient(
      env.WS_GATEWAY_APPID,
      env.WS_GATEWAY_APIKEY,
      getWsTopicFromList(listId)
    );
  }

  public getWsUrl(): string {
    return (
      wsGatewayUrl.replace("https", "wss") +
      `/ws/app/${this.appId}/topic/${this.topic}`
    );
  }

  async createTicket(userId: string): Promise<TicketResponse> {
    const resp = await fetch(`${wsGatewayUrl}/api/app/${this.appId}/ticket`, {
      method: "POST",
      headers: {
        Authorization: this.apiKey,
      },
      body: JSON.stringify({
        userId: userId,
        topic: this.topic,
      } as TicketRequest),
    });
    if (resp.status > 299) {
      const text = await resp.text();
      console.error(`create ticket failed: ${resp.status} - ${text}`);
      throw new Error(`create ticket failed, http ${resp.status}`);
    }
    const respJson = (await resp.json()) as TicketResponse;
    return respJson;
  }

  async listItemAdded(
    initiator: string | undefined,
    data: ListItemAddEvent
  ): Promise<void> {
    return await this.broadcast({
      type: "ListItemAdded",
      data,
      initiator,
    });
  }

  async listItemsRemoved(
    initiator: string | undefined,
    data: ListItemsRemoved
  ): Promise<void> {
    return await this.broadcast({
      type: "ListItemsRemoved",
      data,
      initiator,
    });
  }

  async listItemCrossed(
    initiator: string | undefined,
    data: ListItemCrossed
  ): Promise<void> {
    return await this.broadcast({
      type: "ListItemCrossed",
      data,
      initiator,
    });
  }

  async itemDeleted(
    initiator: string | undefined,
    data: ItemDeletedEvent
  ): Promise<void> {
    return await this.broadcast({
      type: "ItemDeleted",
      data,
      initiator,
    });
  }

  private async broadcast(payload: any): Promise<void> {
    const resp = await fetch(
      `${wsGatewayUrl}/api/app/${this.appId}/topic/${this.topic}/broadcast`,
      {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
        },
        body: JSON.stringify({
          payload,
        }),
      }
    );
    if (resp.status > 299) {
      const text = await resp.text();
      console.error(`ws broadcast failed: ${resp.status} - ${text}`);
      throw new Error(`ws broadcast failed, http ${resp.status} - ${text}`);
    }
  }
}

type EventType =
  | "ListItemAdded"
  | "ListItemsRemoved"
  | "ListItemCrossed"
  | "ItemDeleted";
type EventData =
  | ListItemAddEvent
  | ListItemsRemoved
  | ListItemCrossed
  | ItemDeletedEvent;
interface BroadcastPayload {
  type: EventType;
  data: EventData;
  initiator?: string;
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
interface ItemDeletedEvent {
  itemId: string;
}
