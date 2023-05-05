import { formatISO, parseISO } from "date-fns";
import { Env } from "../types";
import { DbError } from "../util/db-error";
import { nanoid } from "nanoid";
import { getLogger } from "../util/logger";

export class ListsRepository {
  constructor(private readonly db: D1Database) {}
  public static New(env: Env): ListsRepository {
    return new ListsRepository(env.DB);
  }

  private logSql(
    start: Date,
    stmt: D1PreparedStatement,
    result: D1Result
  ): void {
    const logger = getLogger("ListsRepository");
    const end = new Date();
    const duration = end.getTime() - start.getTime();
    logger.info("SQL INFO: ", stmt, result, { duration });
  }

  public async getLists(
    userId: string,
    listId: string | null = null
  ): Promise<List[]> {
    try {
      const start = new Date();
      const listIdWhere = listId ? " AND l.id = ?2" : "";
      let stmt = this.db
        .prepare(
          `SELECT l.*, li.itemId, i.name as itemName, li.count as liCount, li.crossed as liCrossed, li.createdAt as liCreatedAt, li.updatedAt as liUpdatedAt FROM lists l
           LEFT JOIN list_items li ON li.listId = l.id
           LEFT JOIN items i on i.id = li.itemId
           WHERE l.userId = ?1 ${listIdWhere}`
        )
        .bind(userId);
      if (listId) {
        stmt = stmt.bind(userId, listId);
      }
      const result = await stmt.all<ListWithItemsDto>();
      this.logSql(start, stmt, result);
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
      const start = new Date();
      const stmt = this.db
        .prepare(
          "INSERT INTO lists (id, userId, name, createdAt) values (?1, ?2, ?3, ?4)"
        )
        .bind(dto.id, dto.userId, dto.name, dto.createdAt);
      const result = await stmt.run();
      this.logSql(start, stmt, result);
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
      const start = new Date();
      const stmt = this.db
        .prepare("UPDATE lists SET name = ?1 WHERE userId = ?2 AND id = ?3")
        .bind(name, userId, listId);
      const result = await stmt.run();
      this.logSql(start, stmt, result);
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
      const start = new Date();
      const stmt = this.db
        .prepare("DELETE FROM lists WHERE userId = ?1 AND id = ?2")
        .bind(userId, listId);
      const result = await stmt.run();
      this.logSql(start, stmt, result);
      if (result.error) {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getListItems(listId: string): Promise<ListItem[]> {
    try {
      const start = new Date();
      const stmt = this.db
        .prepare(
          `SELECT li.*, i.name as itemName FROM list_items li
           INNER JOIN items i ON i.id = li.itemId
           WHERE listId = ?`
        )
        .bind(listId);
      const result = await stmt.all<ListItemDto>();
      this.logSql(start, stmt, result);
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
      let start = new Date();
      const existingListItemStmt = this.db
        .prepare("SELECT * FROM list_items WHERE listId = ?1 and itemId = ?2")
        .bind(listId, itemId);
      const existingListItem = await existingListItemStmt.all();
      this.logSql(start, existingListItemStmt, existingListItem);
      if (existingListItem.error) {
        throw DbError.new(existingListItem);
      }
      const now = new Date();
      const nowStr = formatISO(now);
      let sql = "";
      let stmt: D1PreparedStatement;
      let result: D1Result<unknown>;
      start = new Date();
      if (existingListItem.results && existingListItem.results?.length > 0) {
        sql =
          "UPDATE list_items SET count = count + 1, updatedAt = ?1 WHERE listId = ?2 AND itemId = ?3";
        stmt = this.db.prepare(sql).bind(nowStr, listId, itemId);
        result = await stmt.run();
      } else {
        sql =
          "INSERT INTO list_items (listId, itemId, count, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?4, ?5)";
        stmt = this.db.prepare(sql).bind(listId, itemId, 1, nowStr, nowStr);
        result = await stmt.run();
      }
      this.logSql(start, stmt, result);
      if (result.error) {
        throw DbError.new(result);
      }
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
      const start = new Date();
      // +2 to start at 1, and listId uses ?1
      const itemIdQuestionMarks = itemIds.map((_, i) => `?${i + 2}`).join(",");
      const sql = `DELETE FROM list_items WHERE listId = ?1 and itemId IN (${itemIdQuestionMarks})`;
      const stmt = this.db.prepare(sql).bind(listId, ...itemIds);
      const result = await stmt.run();
      this.logSql(start, stmt, result);
      if (result.error) {
        throw DbError.new(result);
      }
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
      const start = new Date();
      const sql =
        "UPDATE list_items SET crossed = ?1, updatedAt = ?2 WHERE listId = ?3 AND itemId = ?4";
      const crossedNumber = crossed ? 1 : 0;
      const stmt = this.db
        .prepare(sql)
        .bind(crossedNumber, formatISO(new Date()), listId, itemId);
      const result = await stmt.run();
      this.logSql(start, stmt, result);
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
