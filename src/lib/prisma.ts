// Import in a way that avoids TypeScript errors in the editor before
// `@prisma/client` is installed/generated. At runtime this resolves
// to the real `PrismaClient` when `@prisma/client` is available.
import pkg from "@prisma/client";

const PrismaPkg: any = pkg as any;
const PrismaClient = PrismaPkg.PrismaClient || PrismaPkg.default?.PrismaClient || PrismaPkg.default || PrismaPkg;

declare global {
  // eslint-disable-next-line no-var
  var prisma: any | undefined;
}

// Try to construct a Postgres adapter when available (Neon/unpooled usage).
let prismaClient: any;
try {
  const adapterOpts: any = {};
  // Attempt to load the adapter and pg driver only when installed.
  // Use require to avoid top-level await or ESM import complications.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { PrismaPg } = require('@prisma/adapter-pg');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pg = require('pg');
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.NEON_DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (PrismaPg && pg && connectionString) {
    adapterOpts.adapter = new PrismaPg({ pg, connectionString });
  }
  prismaClient = global.prisma ?? new PrismaClient({ ...(adapterOpts.adapter ? { adapter: adapterOpts.adapter } : {}), log: process.env.NODE_ENV === 'development' ? ['query'] : [] });
} catch (err) {
  // If adapter isn't available or fails to construct, fall back to default PrismaClient.
  prismaClient = global.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query'] : [] });
}

if (process.env.NODE_ENV !== 'production') global.prisma = prismaClient;

export const prisma = prismaClient;

export default prisma;
