import { neon } from "@neondatabase/serverless";

let sql;

// Lazily create one Neon client per process (reused across warm serverless invocations).
export function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    sql = neon(url);
  }
  return sql;
}
