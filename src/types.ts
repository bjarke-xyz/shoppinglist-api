export type Env = {
  DB: D1Database;
  FIREBASE_WEB_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  SHOPPINGLIST: KVNamespace;
  EVENTCOORDINATOR: DurableObjectNamespace;
};
