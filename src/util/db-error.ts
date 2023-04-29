export class DbError extends Error {
  constructor(dbResult: D1Result) {
    super(dbResult.error ?? "Database error");
  }
}
