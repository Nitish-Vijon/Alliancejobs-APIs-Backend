import { max } from "drizzle-orm";
import { MySqlTable, MySqlColumn } from "drizzle-orm/mysql-core";
import { db } from "../db";

export async function generateUniqueId<T extends MySqlTable>(
  table: T,
  idColumn?: MySqlColumn<any>
): Promise<number> {
  try {
    // Use the provided idColumn or default to 'id'
    const column = idColumn || (table as any).id;

    if (!column) {
      throw new Error(`ID column not found in table ${table._.name}`);
    }

    // Get the maximum ID from the table
    const result = await db.select({ maxId: max(column) }).from(table);

    const maxId = result[0]?.maxId;

    // Return next ID (maxId + 1, or 1 if table is empty)
    return maxId ? Number(maxId) + 1 : 1;
  } catch (error) {
    console.error(
      `Error generating unique ID for table ${table._.name}:`,
      error
    );
    throw error;
  }
}
