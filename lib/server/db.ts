import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton. Next.js dev hot-reload re-evaluates modules, so the
 * client is cached on globalThis to avoid exhausting SQLite file handles.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
