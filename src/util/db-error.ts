export class DbError extends Error {
  public static new(
    dbResult: D1Result | null = null,
    error: Error | null = null
  ) {
    const dbError = new Error(
      dbResult?.error ?? error?.message ?? "database error"
    );
    if (error) {
      if (error.stack) {
        dbError.stack = error.stack;
      }
      const anyError = error as any;
      if (anyError.cause) {
        (dbError as any).cause = anyError.cause;
      }
    }
    return dbError;
  }
}
