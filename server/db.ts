import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import pg from "pg";
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const isNeon = process.env.DATABASE_URL.includes("neon.tech") || process.env.DATABASE_URL.includes("neon-");

let db: any;

if (isNeon) {
  db = drizzleNeon({
    connection: process.env.DATABASE_URL,
    schema,
    ws,
  });
} else {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNode({ client: pool, schema });
}

export { db };
