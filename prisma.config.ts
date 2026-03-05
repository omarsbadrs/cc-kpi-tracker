import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts",
  },
  datasource: {
    // Use DIRECT_URL for schema operations (migrations, db push) since PgBouncer doesn't support them
    // Falls back to DATABASE_URL for runtime queries
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
})
