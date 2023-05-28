import {
  SelectQueryBuilder,
  RawBuilder,
  Simplify,
  sql,
  SelectQueryNode,
  ReferenceNode,
  ColumnNode,
  AliasNode,
  IdentifierNode,
} from "kysely";

export function jsonArrayFrom<O>(
  expr: SelectQueryBuilder<any, any, O>
): RawBuilder<Simplify<O>[]> {
  return sql`(select (coalesce(json(json_group_array(json_object(${sql.join(
    getJsonObjectArgs(expr.toOperationNode(), "agg")
  )}))), '[]')) from ${expr} as agg)`;
}

function getJsonObjectArgs(
  node: SelectQueryNode,
  table: string
): RawBuilder<unknown>[] {
  return node.selections!.flatMap(({ selection: s }) => {
    if (ReferenceNode.is(s) && ColumnNode.is(s.column)) {
      return [
        sql.lit(s.column.column.name),
        sql.id(table, s.column.column.name),
      ];
    } else if (ColumnNode.is(s)) {
      return [sql.lit(s.column.name), sql.id(table, s.column.name)];
    } else if (AliasNode.is(s) && IdentifierNode.is(s.alias)) {
      return [sql.lit(s.alias.name), sql.id(table, s.alias.name)];
    } else {
      throw new Error(
        "MySQL jsonArrayFrom and jsonObjectFrom functions can only handle explicit selections due to limitations of the json_object function. selectAll() is not allowed in the subquery."
      );
    }
  });
}
