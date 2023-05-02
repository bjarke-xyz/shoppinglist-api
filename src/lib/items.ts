import { formatISO, parseISO } from "date-fns";
import { Env } from "../types";
import { DbError } from "../util/db-error";
import { nanoid } from "nanoid";

export class ItemsRepository {
  constructor(private readonly db: D1Database) {}
  public static New(env: Env): ItemsRepository {
    return new ItemsRepository(env.DB);
  }

  public async getItems(userId: string): Promise<Item[]> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM items WHERE userId = ?")
        .bind(userId)
        .all<ItemDto>();
      if (result.success && result.results) {
        return result.results.map(mapDto);
      } else {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getItem(userId: string, itemId: string): Promise<Item | null> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM items WHERE userId = ?1 and id = ?2")
        .bind(userId, itemId)
        .all<ItemDto>();
      if (result.success && result.results) {
        return result.results.map(mapDto)[0] ?? null;
      } else {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getItemByName(
    userId: string,
    itemName: string
  ): Promise<Item | null> {
    try {
      const result = await this.db
        .prepare("SELECT * FROM items WHERE userId = ?1 and name = ?2")
        .bind(userId, itemName)
        .all<ItemDto>();
      if (result.success && result.results) {
        return result.results.map(mapDto)[0] ?? null;
      } else {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async createItem(userId: string, name: string): Promise<Item> {
    const dto = mapEntity({
      id: nanoid(),
      userId,
      name,
      createdAt: new Date(),
    });
    try {
      const result = await this.db
        .prepare(
          "INSERT INTO items (id, userId, name, createdAt) values (?1, ?2, ?3, ?4)"
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

  public async updateItem(
    userId: string,
    itemId: string,
    name: string
  ): Promise<Item> {
    try {
      const result = await this.db
        .prepare("UPDATE items SET name = ?1 WHERE userId = ?2 AND id = ?3")
        .bind(name, userId, itemId)
        .run();
      if (result.error) {
        throw DbError.new(result);
      }
      const updatedItem = await this.getItem(userId, itemId);
      if (updatedItem == null) {
        throw new Error("Updated item was null");
      }
      return updatedItem;
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async deleteItem(userId: string, itemId: string): Promise<void> {
    try {
      const result = await this.db
        .prepare("DELETE FROM items WHERE userId = ?1 AND id = ?2")
        .bind(userId, itemId)
        .run();
      if (result.error) {
        throw DbError.new(result);
      }
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }
}

function mapEntity(entity: Item): ItemDto {
  return {
    ...entity,
    createdAt: formatISO(entity.createdAt),
  };
}
export interface Item {
  id: string;
  userId: string;
  name: string;
  createdAt: Date;
}

function mapDto(dto: ItemDto): Item {
  return {
    ...dto,
    createdAt: parseISO(dto.createdAt),
  };
}
export interface ItemDto {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}
