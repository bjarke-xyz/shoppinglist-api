import { formatISO, parseISO } from "date-fns";
import { Env } from "../types";
import { DbError } from "../util/db-error";
import { nanoid } from "nanoid";

export class ListsRepository {
  constructor(private readonly db: D1Database) {}
  public static New(env: Env): ListsRepository {
    return new ListsRepository(env.DB);
  }

  public async getLists(userId: string): Promise<List[]> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM lists WHERE userId = ?")
        .bind(userId)
        .all<ListDto>();
      if (result.success && result.results) {
        return result.results.map(mapDto);
      } else {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getList(userId: string, listId: string): Promise<List | null> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM lists WHERE userId = ?1 and id = ?2")
        .bind(userId, listId)
        .all<ListDto>();
      if (result.success && result.results) {
        return result.results.map(mapDto)[0] ?? null;
      } else {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async createList(userId: string, name: string): Promise<List> {
    const dto = mapEntity({
      id: nanoid(),
      userId,
      name,
      createdAt: new Date(),
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

  public async addToList(listId: string, itemId: string): Promise<void> {
    try {
      const existingListItem = await this.db
        .prepare("SELECT * FROM list_items WHERE listId = ?1 and itemId = ?2")
        .bind(listId, itemId)
        .run();
      if (existingListItem.error) {
        throw DbError.new(existingListItem);
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
export interface List {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
}

function mapDto(dto: ListDto): List {
  return {
    ...dto,
    createdAt: parseISO(dto.createdAt),
  };
}
export interface ListDto {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}
