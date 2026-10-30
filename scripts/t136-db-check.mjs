// Task 136 — DB-level assertions after the CDP phases (sqlite3 CLI is not
// installed here, so Prisma does the reading).
// Usage:
//   node scripts/t136-db-check.mjs guest --marker "<shipping name>"
//   node scripts/t136-db-check.mjs user --uid <userId> --marker "<name>"
// Prints the matching order row as JSON (or exits 1).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const mode = process.argv[2] ?? "guest";
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const marker = arg("--marker") ?? "";
const uid = arg("--uid");

try {
  const order =
    mode === "guest"
      ? await db.order.findFirst({
          where: { userId: null, shippingName: { contains: marker } },
          orderBy: { createdAt: "desc" },
          include: { items: true },
        })
      : await db.order.findFirst({
          where: { userId: uid, shippingName: { contains: marker } },
          orderBy: { createdAt: "desc" },
          include: { items: true },
        });
  if (!order) {
    console.error("NO_MATCH");
    process.exit(1);
  }
  console.log(JSON.stringify({ id: order.id, userId: order.userId, status: order.status, paymentStatus: order.paymentStatus, totalAmount: order.totalAmount, shippingName: order.shippingName, shippingCity: order.shippingCity, items: order.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price })) }));
} finally {
  await db.$disconnect();
}
