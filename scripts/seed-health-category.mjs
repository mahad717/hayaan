// Seed the "Health Supplements" category into the LOCAL Prisma (SQLite) store
// so the storefront pill + admin dropdown can be verified locally.
// Mirrors src/lib/supabase/migrations/2026-09-20-health-supplements.sql.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const cat = await prisma.category.upsert({
  where: { slug: "health-supplements" },
  update: { name: "Health Supplements", description: "Vitamins, minerals and everyday wellness supplements." },
  create: {
    name: "Health Supplements",
    slug: "health-supplements",
    description: "Vitamins, minerals and everyday wellness supplements.",
  },
});

console.log("seeded:", cat);
const all = await prisma.category.findMany({ orderBy: { name: "asc" }, select: { name: true, slug: true } });
console.log("categories now:", all.length, all.map((c) => c.slug).join(", "));
