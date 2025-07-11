import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL for MySQL is not set in environment variables");
}

export default {
  schema: "./src/db/schema.ts",
  out: "./Drizzle/Migrations",
  dialect: "mysql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
} satisfies Config;
