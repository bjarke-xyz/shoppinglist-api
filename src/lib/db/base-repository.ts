import { Kysely } from "kysely";
import { Database } from "./database";
import { D1Dialect } from "kysely-d1";
import { getLogger } from "../../util/logger";

export class BaseRepository {
  protected readonly db: Kysely<Database>;
  constructor(protected readonly _db: D1Database) {
    this.db = new Kysely<Database>({
      dialect: new D1Dialect({ database: _db }),
      log: (event) => {
        const logger = getLogger("db");
        logger.info(`SQL: ${event.level} - ${event.query.sql}`);
      },
    });
  }
}
