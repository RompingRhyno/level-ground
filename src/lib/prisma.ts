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

export const prisma =
  global.prisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query"] : [] });

if (process.env.NODE_ENV !== "production") global.prisma = prisma;

export default prisma;
