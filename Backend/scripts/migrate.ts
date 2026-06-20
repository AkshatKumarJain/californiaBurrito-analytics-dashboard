import { runMigrations } from "../src/db/migrate";
import { pool } from "../src/db/pool";

// run migration to import data to databases

async function main(): Promise<void> {
  await runMigrations();
  console.log("Database schema is ready.");
}

main()
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
