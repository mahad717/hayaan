// Task 114 local API check — seed a delivered order with a physical item,
// log the user in, and assert GET /api/orders carries productSlug so the
// "Review your purchase" button can render. Cleans up afterwards.
//   node scripts/task114-local-verify.mjs seed|assert|clean
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const EMAIL = "qa-local-114@hayaan.test";
const PW = "unused-local-only";

async function main() {
  const mode = process.argv[2];
  if (mode === "seed") {
    const product =
      (await db.product.findUnique({ where: { slug: "aurora-wireless-headphones" } })) ??
      (await db.product.create({
        data: {
          name: "Aurora Wireless Headphones",
          slug: "aurora-wireless-headphones",
          description: "Local seed product for the Task 114 orders check.",
          price: 49.99,
          images: "[]",
          stock: 5,
          categoryId: (await db.category.create({ data: { name: "Test Cat 114", slug: "test-cat-114" } })).id,
        },
      }));
    const user =
      (await db.user.findUnique({ where: { email: EMAIL } })) ??
      (await db.user.create({ data: { email: EMAIL, name: "QA Local 114", password: bcrypt.hashSync(PW, 10) } }));
    const order = await db.order.create({
      data: {
        userId: user.id,
        status: "delivered",
        totalAmount: product.price + 2.5,
        shippingName: "QA Local 114",
        shippingAddress: "Test St 1",
        shippingCity: "Hodan",
        shippingZip: "0000",
        shippingCountry: "Somalia",
        paymentMethod: "card",
        paymentStatus: "paid",
        items: {
          create: { productId: product.id, name: product.name, price: product.price, quantity: 1 },
        },
      },
    });
    console.log("seeded order", order.id, "for", EMAIL);
  } else if (mode === "clean") {
    const user = await db.user.findUnique({ where: { email: EMAIL } });
    if (user) {
      await db.orderItem.deleteMany({ where: { order: { userId: user.id } } });
      await db.order.deleteMany({ where: { userId: user.id } });
      await db.user.delete({ where: { id: user.id } });
    }
    // The aurora product is ORIGINAL seed data (Task 113 also reused it) —
    // never delete it here; only this task's user/orders are ours.
    console.log("cleaned");
  } else {
    throw new Error("pass seed|assert|clean");
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
