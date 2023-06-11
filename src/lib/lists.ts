import { formatISO, parseISO } from "date-fns";
import { Insertable, Kysely, sql } from "kysely";
import { D1Dialect } from "kysely-d1";
import { nanoid } from "nanoid";
import { Env } from "../types";
import { DbError } from "../util/db-error";
import { Database, ListItemsTable } from "./db/database";
import { JsonParsePlugin } from "./db/helpers/plugin";
import { jsonArrayFrom } from "./db/helpers/sqlite";
import { BaseRepository } from "./db/base-repository";

export class ListsRepository extends BaseRepository {
  public static New(env: Env): ListsRepository {
    return new ListsRepository(env.DB);
  }

  public async getLists(
    userId: string,
    listId: string | null = null
  ): Promise<List[]> {
    try {
      const res = await this.db
        .selectFrom("lists")
        .selectAll("lists")
        .select((listEb) => [
          jsonArrayFrom(
            listEb
              .selectFrom("list_items")
              .select((listItemEb) => [
                "listId",
                "itemId",
                "count",
                "crossed",
                "createdAt",
                "updatedAt",
                listItemEb
                  .selectFrom("items")
                  .select("name")
                  .whereRef("items.id", "=", "list_items.itemId")
                  .as("itemName"),
              ])
              .whereRef("list_items.listId", "=", "lists.id")
          ).as("items"),
        ])
        .where("userId", "=", userId)
        .$if(!!listId, (qb) => qb.where("id", "=", listId))
        .withPlugin(new JsonParsePlugin(["items"]))
        .execute();
      return res;
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getList(userId: string, listId: string): Promise<List | null> {
    const lists = await this.getLists(userId, listId);
    return lists?.[0] ?? null;
  }

  public async createList(userId: string, name: string): Promise<List> {
    const dto = mapEntity({
      id: nanoid(),
      userId,
      name,
      createdAt: new Date(),
      items: [],
    });
    try {
      await this.db
        .insertInto("lists")
        .values({
          id: dto.id,
          userId: dto.userId,
          name: dto.name,
          createdAt: dto.createdAt,
        })
        .execute();
      const entity = mapDto(dto);
      return entity;
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async updateList(
    userId: string,
    listId: string,
    name: string
  ): Promise<List> {
    try {
      await this.db
        .updateTable("lists")
        .set({
          name: name,
        })
        .where("userId", "=", userId)
        .where("id", "=", listId)
        .execute();
      const updatedList = await this.getList(userId, listId);
      if (updatedList == null) {
        throw new Error("Updated list was null");
      }
      return updatedList;
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async deleteList(userId: string, listId: string): Promise<void> {
    try {
      await this.db
        .deleteFrom("lists")
        .where("userId", "=", userId)
        .where("id", "=", listId)
        .execute();
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getListItems(listId: string): Promise<ListItem[]> {
    try {
      const res = await this.db
        .selectFrom("list_items")
        .innerJoin("items", "list_items.itemId", "items.id")
        .selectAll("list_items")
        .select("items.name as itemName")
        .where("listId", "=", listId)
        .execute();
      return res;
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async addToList(listId: string, itemId: string): Promise<void> {
    try {
      const now = new Date();
      const nowStr = formatISO(now);
      const input: Insertable<ListItemsTable> = {
        listId: listId,
        itemId: itemId,
        count: 1,
        crossed: 0,
        createdAt: nowStr,
        updatedAt: nowStr,
      };
      await this.db
        .insertInto("list_items")
        .values(input)
        .onConflict((oc) =>
          oc.columns(["listId", "itemId"]).doUpdateSet({
            count: (eb) =>
              sql`${eb.ref("count")} + ${eb.ref("excluded.count")}`,
            updatedAt: nowStr,
          })
        )
        .execute();
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async removeFromList(
    listId: string,
    itemIds: string[]
  ): Promise<void> {
    if (!itemIds || itemIds.length === 0) {
      return;
    }
    try {
      await this.db
        .deleteFrom("list_items")
        .where("listId", "=", listId)
        .where("itemId", "in", itemIds)
        .execute();
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async crossListItem(
    listId: string,
    itemId: string,
    crossed: boolean
  ): Promise<void> {
    try {
      await this.db
        .updateTable("list_items")
        .where("listId", "=", listId)
        .where("itemId", "=", itemId)
        .set({
          crossed: crossed ? 1 : 0,
          updatedAt: formatISO(new Date()),
        })
        .execute();
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }
  public async deleteForUser(userId: string): Promise<void> {
    try {
      await this.db.deleteFrom("lists").where("userId", "=", userId).execute();
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }
}

function mapEntity(entity: List): ListDto {
  return {
    ...entity,
    createdAt: formatISO(entity.createdAt),
  };
}
function mapEntityListItem(entity: ListItem): ListItemDto {
  return {
    ...entity,
    createdAt: formatISO(entity.createdAt),
    updatedAt: formatISO(entity.updatedAt),
    crossed: entity.crossed ? 1 : 0,
  };
}
export interface List {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;

  items: ListItem[];
}

export interface ListItem {
  listId: string;
  itemId: string;
  itemName: string;
  count: number;
  crossed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function mapListWithItemsDto(dtos: ListWithItemsDto[]): List[] {
  const result: List[] = [];

  for (const dto of dtos) {
    let list = result.find((x) => x.id === dto.id);
    if (!list) {
      list = {
        id: dto.id,
        userId: dto.userId,
        name: dto.name,
        createdAt: parseISO(dto.createdAt),
        items: [],
      };
      result.push(list);
    }
    if (dto.itemId) {
      const listItem: ListItem = {
        listId: list.id,
        itemId: dto.itemId,
        itemName: dto.itemName,
        count: dto.liCount,
        crossed: dto.liCrossed === 1 ? true : false,
        createdAt: parseISO(dto.liCreatedAt),
        updatedAt: parseISO(dto.liUpdatedAt),
      };
      list.items.push(listItem);
    }
  }

  return result;
}

function mapDto(dto: ListDto): List {
  return {
    ...dto,
    createdAt: parseISO(dto.createdAt),
    items: [],
  };
}
function mapDtoListItem(dto: ListItemDto): ListItem {
  return {
    ...dto,
    createdAt: parseISO(dto.createdAt),
    updatedAt: parseISO(dto.updatedAt),
    itemName: dto.itemName,
    crossed: dto.crossed === 1 ? true : false,
  };
}

export interface ListDto {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface ListWithItemsDto {
  id: string;
  userId: string;
  name: string;
  createdAt: string;

  // From join
  itemId: string;
  itemName: string;
  liCount: number;
  liCrossed: number;
  liCreatedAt: string;
  liUpdatedAt: string;
}

export interface ListItemDto {
  listId: string;
  itemId: string;
  itemName: string;
  count: number;
  crossed: number;
  createdAt: string;
  updatedAt: string;
}
