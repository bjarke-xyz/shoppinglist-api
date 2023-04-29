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
    const result = await this.db
      .prepare("SELECT * FROM items WHERE userId = ?")
      .bind(userId)
      .all<ItemDto>();
    if (result.success && result.results) {
      return result.results.map(mapDto);
    } else {
      throw new DbError(result);
    }
  }

  public async createItem(userId: string, name: string): Promise<Item> {
    const dto = mapEntity({
      id: nanoid(),
      userId,
      name,
      createdAt: new Date(),
    });
    const result = await this.db
      .prepare(
        "INSERT INTO items (id, userId, name, createdAt) values (?1, ?2, ?3, ?4)"
      )
      .bind(dto.id, dto.userId, dto.name, dto.createdAt)
      .run();
    if (result.error) {
      console.log("error!!", result.error);
      throw new DbError(result);
    }
    const entity = mapDto(dto);
    return entity;
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
