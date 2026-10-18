// Task 113 local runtime check — seed/cleanup a review so the PDP JSON-LD
// review[] array can be asserted against a real render. Usage:
//   node scripts/task113-local-verify.mjs seed|clean
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const SLUG = process.argv[3] || "aurora-wireless-headphones";
const EMAIL = "qa-local-113@hayaan.test";

async function main() {
  const mode = process.argv[2];
  const product = await db.product.findUnique({ where: { slug: SLUG } });
  if (!product) throw new Error(`local product ${SLUG} not found`);

  if (mode === "seed") {
    const user =
      (await db.user.findUnique({ where: { email: EMAIL } })) ??
      (await db.user.create({
        data: { email: EMAIL, name: "QA Local 113", password: "unused-local-only" },
      }));
    await db.review.upsert({
      where: { productId_userId: { productId: product.id, userId: user.id } },
      create: {
        productId: product.id,
        userId: user.id,
        authorName: "QA Local 113",
        rating: 5,
        comment: "Local JSON-LD schema test review (Task 113) — deleted right after.",
        verifiedPurchase: false,
        status: "approved",
      },
      update: { rating: 5, comment: "Local JSON-LD schema test review (Task 113) — deleted right after." },
    });
    await db.product.update({
      where: { id: product.id },
      data: { rating: 5, reviewCount: 1 },
    });
    console.log("seeded: review + rating=5 reviewCount=1 on", SLUG);
  } else if (mode === "clean") {
    await db.review.deleteMany({ where: { userId: { in: (await db.user.findUnique({ where: { email: EMAIL } }))?.id ? [(await db.user.findUnique({ where: { email: EMAIL } })).id] : [] } } });
    const user = await db.user.findUnique({ where: { email: EMAIL } });
    if (user) await db.user.delete({ where: { id: user.id } });
    await db.product.update({
      where: { id: product.id },
      data: { rating: 0, reviewCount: 0 },
    });
    console.log("cleaned: review + user removed, rating reset on", SLUG);
  } else {
    throw new Error("pass seed|clean");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
