import { formatISO, parseISO } from "date-fns";
import { Env } from "../types";
import { DbError } from "../util/db-error";
import { nanoid } from "nanoid";

export class ListsRepository {
  constructor(private readonly db: D1Database) {}
  public static New(env: Env): ListsRepository {
    return new ListsRepository(env.DB);
  }

  public async getLists(
    userId: string,
    listId: string | null = null
  ): Promise<List[]> {
    try {
      const listIdWhere = listId ? " AND listId = ?" : "";
      let stmt = this.db
        .prepare(
          `SELECT l.*, li.itemId, i.name as itemName, li.count as liCount, li.createdAt as liCreatedAt, li.updatedAt as liUpdatedAt FROM lists l
           LEFT JOIN list_items li ON li.listId = l.id
           LEFT JOIN items i on i.id = li.itemId
           WHERE l.userId = ? ${listIdWhere}`
        )
        .bind(userId);
      if (listId) {
        stmt = stmt.bind(userId, listId);
      }
      const result = await stmt.all<ListWithItemsDto>();
      console.log(result);
      if (result.success && result.results) {
        return mapListWithItemsDto(result.results);
      } else {
        throw DbError.new(result);
      }
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
      const result = await this.db
        .prepare(
          "INSERT INTO lists (id, userId, name, createdAt) values (?1, ?2, ?3, ?4)"
        )
        .bind(dto.id, dto.userId, dto.name, dto.createdAt)
        .run();
      if (result.error) {
        throw DbError.new(result);
      }
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
      const result = await this.db
        .prepare("UPDATE lists SET name = ?1 WHERE userId = ?2 AND id = ?3")
        .bind(name, userId, listId)
        .run();
      if (result.error) {
        throw DbError.new(result);
      }
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
      const result = await this.db
        .prepare("DELETE FROM lists WHERE userId = ?1 AND id = ?2")
        .bind(userId, listId)
        .run();
      if (result.error) {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getListItems(listId: string): Promise<ListItem[]> {
    try {
      const result = await this.db
        .prepare(
          `SELECT li.*, i.name as itemName FROM list_items li
           INNER JOIN items i ON i.id = li.itemId
           WHERE listId = ?`
        )
        .bind(listId)
        .all<ListItemDto>();
      if (result.success && result.results) {
        return result.results.map(mapDtoListItem);
      } else {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async addToList(listId: string, itemId: string): Promise<void> {
    try {
      const existingListItem = await this.db
        .prepare("SELECT * FROM list_items WHERE listId = ?1 and itemId = ?2")
        .bind(listId, itemId)
        .all();
      if (existingListItem.error) {
        throw DbError.new(existingListItem);
      }
      const now = new Date();
      const nowStr = formatISO(now);
      let sql = "";
      let result: D1Result<unknown>;
      if (existingListItem.results && existingListItem.results?.length > 0) {
        sql =
          "UPDATE list_items SET count = count + 1, updatedAt = ?1 WHERE listId = ?2 AND itemId = ?3";
        result = await this.db.prepare(sql).bind(nowStr, listId, itemId).run();
      } else {
        sql =
          "INSERT INTO list_items (listId, itemId, count, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5)";
        result = await this.db
          .prepare(sql)
          .bind(listId, itemId, 1, nowStr, nowStr)
          .run();
      }
      if (result.error) {
        throw DbError.new(result);
      }
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
    const listItem: ListItem = {
      listId: list.id,
      itemId: dto.itemId,
      itemName: dto.itemName,
      count: dto.liCount,
      createdAt: parseISO(dto.liCreatedAt),
      updatedAt: parseISO(dto.liUpdatedAt),
    };
    list.items.push(listItem);
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
  liCreatedAt: string;
  liUpdatedAt: string;
}

export interface ListItemDto {
  listId: string;
  itemId: string;
  itemName: string;
  count: number;
  createdAt: string;
  updatedAt: string;
}
