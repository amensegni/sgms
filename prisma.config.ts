import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./apps/api/src/database-url.ts";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(process.env.DATABASE_URL),
  },
});