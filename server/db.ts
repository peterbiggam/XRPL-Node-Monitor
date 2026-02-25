import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const isNeon = process.env.DATABASE_URL.includes("neon.tech") || process.env.DATABASE_URL.includes("neon-");

let db: any;

if (isNeon) {
  const { drizzle } = await import("drizzle-orm/neon-serverless");
  const ws = (await import("ws")).default;
  db = drizzle({
    connection: process.env.DATABASE_URL,
    schema,
    ws,
  });
} else {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const pg = await import("pg");
  const pool = new pg.default.Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzle({ client: pool, schema });
}

export { db };
