import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const username = process.argv[2];

  if (!username) {
    throw new Error("Usage: npm run admin:promote <username>");
  }

  const user = await prisma.user.update({
    where: { username },
    data: {
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Admin enabled for: ${user.username}`);
  console.log(`Role: ${user.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });