// Database connection module — supports two PostgreSQL drivers:
// 1. Neon serverless driver (used when DATABASE_URL points to a Neon-hosted DB)
// 2. Standard node-postgres (pg) driver (used for self-hosted / Docker PostgreSQL)
// The driver is auto-detected based on the DATABASE_URL hostname.

import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import pg from "pg";
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Detect Neon-hosted databases by checking for "neon.tech" or "neon-" in the connection string.
// Neon requires the WebSocket-based driver since it doesn't support raw TCP connections.
const isNeon = process.env.DATABASE_URL.includes("neon.tech") || process.env.DATABASE_URL.includes("neon-");

let db: any;

if (isNeon) {
  // Neon serverless driver — uses WebSocket transport instead of TCP
  db = drizzleNeon({
    connection: process.env.DATABASE_URL,
    schema,
    ws,
  });
} else {
  // Standard pg driver — uses a connection pool for concurrent queries
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNode({ client: pool, schema });
}

export { db };
