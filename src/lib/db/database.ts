import { ColumnType } from "kysely";

export interface ItemsTable {
  id: string;
  userId: string;
  name: string;
  createdAt: ColumnType<Date, string | undefined, never>;
}

export interface ListsTable {
  id: string;
  userId: string;
  name: string;
  createdAt: ColumnType<Date, string | undefined, string | undefined>;
}

export interface ListItemsTable {
  listId: string;
  itemId: string;
  count: number;
  createdAt: ColumnType<Date, string | undefined, never>;
  updatedAt: ColumnType<Date, string | undefined, string | undefined>;
  crossed: ColumnType<boolean, number | undefined, number | undefined>;
}

export interface Database {
  items: ItemsTable;
  lists: ListsTable;
  list_items: ListItemsTable;
}
