import { defineConfig } from "drizzle-kit";

export default defineConfig({
    schema: "./src/lib/server/db/schema.ts",
    out: "./migrations",
    dialect: "sqlite",
    dbCredentials: {
        url: process.env.SQLITE_DB_PATH || "file:data/meatflicks.db",
    },
});
