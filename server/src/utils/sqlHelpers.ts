import { sql, type SQL } from 'drizzle-orm';

/**
 * Renders a list of ids as a parameterised SQL list: `('a'::uuid, 'b'::uuid)`.
 *
 * Drizzle flattens a JavaScript array passed into a template into one parameter per
 * element, so `any(${ids}::uuid[])` binds only the first id and Postgres then rejects
 * it as a malformed array literal. Building the list explicitly keeps every id a bound
 * parameter -- no string interpolation, so no injection surface -- while producing SQL
 * Postgres actually accepts.
 *
 * Callers must guarantee a non-empty list: `IN ()` and `NOT IN ()` are both syntax
 * errors. Where emptiness is possible, branch before calling rather than passing a
 * sentinel that could collide with real data.
 */
export const uuidList = (ids: string[]): SQL => {
  if (ids.length === 0) {
    throw new Error('uuidList requires at least one id; branch on the empty case instead');
  }
  return sql`(${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  )})`;
};
