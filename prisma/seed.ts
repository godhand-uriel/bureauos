import { PrismaClient } from "@prisma/client";
import { seedDatabase } from "../lib/server/seed-db";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error(
      "Refusing to seed: demo accounts use a published password and must never exist in production.",
    );
    process.exit(1);
  }
  const result = await seedDatabase(prisma);
  console.log(
    result.seeded
      ? "Seeded demo data: demo@bureauos.app / admin@bureauos.app (password: bureau-demo)"
      : "Demo data already present — nothing to do. (Delete prisma/dev.db and re-migrate to start fresh.)",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
