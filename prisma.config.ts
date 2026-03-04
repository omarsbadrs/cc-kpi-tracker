import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Supabase pooled connection (Transaction mode, port 6543)
    // For migrations, set DIRECT_URL in .env and use: DATABASE_URL=$DIRECT_URL npx prisma migrate dev
    url: process.env["DATABASE_URL"],
  },
})
