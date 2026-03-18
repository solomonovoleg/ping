import "dotenv/config";
import { defineConfig } from "drizzle-kit";

let dbUrl = process.env.DATABASE_URL?.trim();
if (!dbUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}
// Хост "base" не резолвится (getaddrinfo EAI_AGAIN) — подменяем на localhost
if (dbUrl.includes("@base")) {
  dbUrl = dbUrl.replace(/@base(?=[:\/]|$)/g, "@localhost");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
