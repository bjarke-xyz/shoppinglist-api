import { formatISO, parseISO } from "date-fns";
import { nanoid } from "nanoid";
import { Env } from "../types";
import { DbError } from "../util/db-error";
import { BaseRepository } from "./db/base-repository";

export class ItemsRepository extends BaseRepository {
  public static New(env: Env): ItemsRepository {
    return new ItemsRepository(env.DB);
  }

  public async getItems(userId: string): Promise<Item[]> {
    try {
      const items = await this.db
        .selectFrom("items")
        .selectAll()
        .where("userId", "=", userId)
        .execute();
      return items;
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getItem(userId: string, itemId: string): Promise<Item | null> {
    try {
      const item = await this.db
        .selectFrom("items")
        .selectAll()
        .where("userId", "=", userId)
        .where("id", "=", itemId)
        .executeTakeFirst();
      return item ?? null;
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async getItemByName(
    userId: string,
    itemName: string
  ): Promise<Item | null> {
    try {
      const item = await this.db
        .selectFrom("items")
        .selectAll()
        .where("userId", "=", userId)
        .where("name", "=", itemName)
        .executeTakeFirst();
      return item ?? null;
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
      this.db
        .insertInto("items")
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

  public async updateItem(
    userId: string,
    itemId: string,
    name: string
  ): Promise<Item> {
    try {
      await this.db
        .updateTable("items")
        .set({
          name: name,
        })
        .where("userId", "=", userId)
        .where("id", "=", itemId)
        .execute();
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
      await this.db
        .deleteFrom("items")
        .where("userId", "=", userId)
        .where("id", "=", itemId)
        .execute();
    } catch (error: any) {
      throw DbError.new(null, error);
    }
  }

  public async deleteForUser(userId: string): Promise<void> {
    try {
      await this.db.deleteFrom("items").where("userId", "=", userId).execute();
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
