import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { config } from "../lib/config";
import * as schema from "./schema";

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

const pool = mysql.createPool({
  uri: config.databaseUrl,
  connectionLimit: 10, // Adjust as needed
});
export const db = drizzle(pool, { schema, mode: "default" });
