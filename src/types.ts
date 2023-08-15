export type Env = {
  DB: D1Database;
  FIREBASE_WEB_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  WS_GATEWAY_APIKEY: string;
  WS_GATEWAY_APPID: string;
  SHOPPINGLIST: KVNamespace;
  EVENTCOORDINATOR: DurableObjectNamespace;
};
