import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, type PrismaConfig } from "prisma/config";

dotenv.config({ path: path.resolve(import.meta.dirname, ".env") });

function buildDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || "5432";
  const database = process.env.DB_NAME || "postgres";
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !user || !password) return "";

  const params = new URLSearchParams();
  const schema = process.env.DB_SCHEMA;
  const sslmode = process.env.DB_SSLMODE || "require";

  if (schema) params.set("schema", schema);
  if (process.env.DB_USE_LIBPQ_COMPAT !== "false") {
    params.set("uselibpqcompat", "true");
  }
  if (sslmode) params.set("sslmode", sslmode);

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?${params.toString()}`;
}

const prismaConfig = {
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: buildDatabaseUrl(),
  },
} satisfies PrismaConfig;

export default defineConfig(prismaConfig);
