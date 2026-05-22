import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const log: Prisma.LogLevel[] = process.env.NODE_ENV === "development" ? ["query"] : [];

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.NEON_DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

function createClient(): PrismaClient {
  if (connectionString) {
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter, log });
  }
  return new PrismaClient({ log });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
