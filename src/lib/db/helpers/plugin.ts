import {
  KyselyPlugin,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryResult,
  RootOperationNode,
  UnknownRow,
} from "kysely";

export class JsonParsePlugin implements KyselyPlugin {
  constructor(private readonly columns: string[]) {}
  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return args.node;
  }
  async transformResult(
    args: PluginTransformResultArgs
  ): Promise<QueryResult<UnknownRow>> {
    for (const row of args.result.rows) {
      Object.keys(row).forEach((col) => {
        const colValue = row[col];
        if (this.columns.includes(col) && typeof colValue === "string") {
          row[col] = JSON.parse(colValue);
        }
      });
    }
    return args.result;
  }
}
