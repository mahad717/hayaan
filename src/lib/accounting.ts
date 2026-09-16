// Accounting & reconciliation core (Task 49).
//
// Everything financial lives behind this module so the rules are enforced in
// exactly one place:
//   * requireAdminUser  — every admin/accounting API funnels through here.
//   * Money math is integer-cents (never floating accumulation); totals are
//     rounded half-up to 2dp only at persistence/display boundaries.
//   * Cost data lives in side-car tables (product_costs / order_item_costs)
//     that NO public query ever selects — customers cannot see cost at the
//     API level, and the Supabase tables are RLS-locked at the DB level.
//   * Ledger + audit writes are centralized so important financial events
//     always leave the same auditable trail.
//
// Dual-backend like every store module: Supabase (production) or Prisma
// SQLite (local dev). Supabase aggregations run in SECURITY DEFINER RPC
// functions (decimal-exact, indexed); the Prisma path aggregates in JS cents.

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import type { SafeUser } from "@/lib/types";

export const ACCOUNTING_MIGRATION = "src/lib/supabase/migrations/2026-09-11-accounting.sql";
export const ACCOUNTING_HINT = `Run ${ACCOUNTING_MIGRATION} in the Supabase SQL editor, then reload this page.`;

/** True when an error is the "accounting schema not migrated yet" family. */
export function isMissingAccountingSchema(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "");
  const code = String((err as any)?.code ?? "");
  return (
    code === "42P01" || // undefined_table (Postgres)
    code === "PGRST202" || // function not found (PostgREST)
    code === "PGRST205" || // table not in schema cache
    code === "P2021" || // table does not exist (Prisma)
    /Could not find the (table|function)/i.test(msg) ||
    /does not exist/i.test(msg) && /accounting_|product_costs|order_item_costs|payments|ledger|purchases|inventory_movements/i.test(msg)
  );
}

export function accountingUnavailableResponse(): {
  error: string;
  migrationRequired: boolean;
  hint: string;
} {
  return { error: ACCOUNTING_HINT, migrationRequired: true, hint: ACCOUNTING_HINT };
}

/** Admin gate for API routes — returns the admin user or null (caller → 403). */
export async function requireAdminUser(req: Request): Promise<SafeUser | null> {
  const user = await getCurrentUser(req as any);
  if (!user || user.role !== "admin") return null;
  return user;
}

// ---------------------------------------------------------------------------
// Money — integer cents everywhere; round half-up to 2dp at the edges.
// ---------------------------------------------------------------------------

export function toCents(v: number | string | null | undefined): number {
  const n = typeof v === "string" ? Number(v) : (v ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Cents → major units rounded half-up to exactly 2 decimals. */
export function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function marginPct(revenueCents: number, cogsCents: number): number {
  if (revenueCents <= 0) return 0;
  return round2(((revenueCents - cogsCents) / revenueCents) * 100);
}

// ---------------------------------------------------------------------------
// Audit trail — who changed what, previous → new value.
// ---------------------------------------------------------------------------

export interface AuditInput {
  actor: SafeUser | null;
  entity: string;
  entityId?: string | null;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export async function auditChange(input: AuditInput): Promise<void> {
  const fmt = (v: unknown) => (v === null || v === undefined ? null : String(v));
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return;
    await supabase.from("accounting_audit").insert({
      actor_id: input.actor?.id ?? null,
      actor_email: input.actor?.email ?? null,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      field: input.field,
      old_value: fmt(input.oldValue),
      new_value: fmt(input.newValue),
    });
    return;
  }
  await (await getDb()).accountingAudit.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorEmail: input.actor?.email ?? null,
      entity: input.entity,
      entityId: input.entityId ?? null,
      field: input.field,
      oldValue: fmt(input.oldValue),
      newValue: fmt(input.newValue),
    },
  });
}

// ---------------------------------------------------------------------------
// Product cost (confidential side-car of products).
// ---------------------------------------------------------------------------

/** Write/update the supplier cost of a product. Cost must be >= 0. */
export async function upsertProductCost(
  productId: string,
  cost: number,
  actor: SafeUser | null,
): Promise<void> {
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Cost must be zero or greater.");
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return;
    const { error } = await supabase.from("product_costs").upsert({
      product_id: productId,
      unit_cost: round2(cost),
      currency: "USD",
      updated_by: actor?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return;
  }
  await (await getDb()).productCost.upsert({
    where: { productId },
    update: { unitCost: round2(cost), updatedBy: actor?.id ?? null },
    create: { productId, unitCost: round2(cost), updatedBy: actor?.id ?? null },
  });
}

/** Remove the cost record (admin cleared the field). */
export async function deleteProductCost(productId: string): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return;
    await supabase.from("product_costs").delete().eq("product_id", productId);
    return;
  }
  await (await getDb()).productCost.deleteMany({ where: { productId } });
}

/** product_id → unit cost (only products with a recorded cost appear). */
export async function getProductCostMap(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (productIds.length === 0) return map;
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return map;
    const { data } = await supabase
      .from("product_costs")
      .select("product_id, unit_cost")
      .in("product_id", productIds);
    for (const row of data ?? []) map.set(row.product_id, Number(row.unit_cost));
    return map;
  }
  const rows = await (await getDb()).productCost.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, unitCost: true },
  });
  for (const row of rows) map.set(row.productId, row.unitCost);
  return map;
}

/** Current unit cost of one product, or null when never recorded. */
export async function getProductCost(productId: string): Promise<number | null> {
  const map = await getProductCostMap([productId]);
  return map.has(productId) ? (map.get(productId) as number) : null;
}

// ---------------------------------------------------------------------------
// Cost snapshots at sale time (order_item_costs).
// ---------------------------------------------------------------------------

export interface SnapshotLine {
  orderItemId: string;
  productId: string | null;
  quantity: number;
}

/**
 * Preserve cost-at-sale for every order item that has a known product cost.
 * Items without a cost simply get NO row — reports show them as "cost
 * unknown" instead of inventing history (spec §15).
 */
export async function snapshotOrderItemCosts(
  lines: SnapshotLine[],
  costMap: Map<string, number>,
): Promise<void> {
  const rows = lines
    .filter((l) => l.productId && costMap.has(l.productId))
    .map((l) => ({
      order_item_id: l.orderItemId,
      product_id: l.productId,
      unit_cost: costMap.get(l.productId as string) as number,
      currency: "USD",
    }));
  if (rows.length === 0) return;
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return;
    const { error } = await supabase.from("order_item_costs").insert(rows);
    if (error) throw error;
    return;
  }
  const db = await getDb();
  for (const row of rows) {
    await db.orderItemCost.create({
      data: {
        orderItemId: row.order_item_id,
        productId: row.product_id,
        unitCost: row.unit_cost,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Payments (reconciliation feed). Duplicate gateway refs are rejected.
// ---------------------------------------------------------------------------

export interface PaymentInput {
  orderId: string;
  provider: string; // "sifalo" | "demo" | "manual" | ...
  method?: string | null;
  transactionRef?: string | null;
  amount?: number | null;
  currency?: string;
  status: "pending" | "paid" | "failed";
  paidAt?: string | null;
}

export async function insertPayment(
  input: PaymentInput,
): Promise<{ id?: string; duplicate: boolean }> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return { duplicate: false };
    const { data, error } = await supabase
      .from("payments")
      .insert({
        order_id: input.orderId,
        provider: input.provider,
        method: input.method ?? null,
        transaction_ref: input.transactionRef ?? null,
        amount: input.amount ?? null,
        currency: input.currency ?? "USD",
        status: input.status,
        paid_at: input.paidAt ?? (input.status === "paid" ? new Date().toISOString() : null),
      })
      .select("id")
      .single();
    if (error) {
      if (error.code === "23505") return { duplicate: true }; // unique violation
      throw error;
    }
    return { id: data?.id, duplicate: false };
  }
  const db = await getDb();
  try {
    const row = await db.paymentRecord.create({
      data: {
        orderId: input.orderId,
        provider: input.provider,
        method: input.method ?? null,
        transactionRef: input.transactionRef ?? null,
        amount: input.amount ?? null,
        currency: input.currency ?? "USD",
        status: input.status,
        paidAt: input.paidAt ? new Date(input.paidAt) : input.status === "paid" ? new Date() : null,
      },
    });
    return { id: row.id, duplicate: false };
  } catch (err: any) {
    if (err?.code === "P2002") return { duplicate: true };
    throw err;
  }
}

/** Sum of successful payment cents for an order (0 when none recorded). */
export async function getPaidCents(orderId: string): Promise<number> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return 0;
    const { data } = await supabase
      .from("payments")
      .select("amount")
      .eq("order_id", orderId)
      .eq("status", "paid");
    return (data ?? []).reduce((sum, r) => sum + toCents(r.amount ?? 0), 0);
  }
  const rows = await (await getDb()).paymentRecord.findMany({
    where: { orderId, status: "paid" },
    select: { amount: true },
  });
  return rows.reduce((sum, r) => sum + toCents(r.amount ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Ledger — grouped, signed entries per financial event.
// ---------------------------------------------------------------------------

export interface LedgerLine {
  entryType: "sale" | "refund" | "purchase" | "cancel" | "adjustment";
  account:
    | "revenue"
    | "cogs"
    | "gross_profit"
    | "refunds"
    | "shipping"
    | "tax"
    | "inventory"
    | "cash"
    | "accounts_payable";
  amountCents: number; // signed
  orderId?: string | null;
  paymentId?: string | null;
  purchaseId?: string | null;
  productId?: string | null;
  description?: string;
}

export async function insertLedgerEntries(
  lines: LedgerLine[],
  actor?: SafeUser | null,
): Promise<string> {
  if (lines.length === 0) return "";
  const group = crypto.randomUUID();
  const rows = lines.map((l) => ({
    entry_type: l.entryType,
    account: l.account,
    entry_group: group,
    order_id: l.orderId ?? null,
    payment_id: l.paymentId ?? null,
    purchase_id: l.purchaseId ?? null,
    product_id: l.productId ?? null,
    amount: centsToMajor(l.amountCents),
    currency: "USD",
    description: l.description ?? null,
    actor: actor?.email ?? null,
  }));
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return group;
    const { error } = await supabase.from("ledger_entries").insert(rows);
    if (error) throw error;
    return group;
  }
  const db = await getDb();
  for (const row of rows) {
    await db.ledgerEntry.create({
      data: {
        entryType: row.entry_type,
        account: row.account,
        entryGroup: group,
        orderId: row.order_id,
        paymentId: row.payment_id,
        purchaseId: row.purchase_id,
        productId: row.product_id,
        amount: row.amount as number,
        currency: row.currency,
        description: row.description,
        actor: row.actor,
      },
    });
  }
  return group;
}

/** True once a SALE ledger group exists for the order (idempotency guard). */
export async function saleAlreadyRecorded(orderId: string): Promise<boolean> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return false;
    const { data } = await supabase
      .from("ledger_entries")
      .select("id")
      .eq("order_id", orderId)
      .eq("entry_type", "sale")
      .limit(1);
    return (data ?? []).length > 0;
  }
  const row = await (await getDb()).ledgerEntry.findFirst({
    where: { orderId, entryType: "sale" },
    select: { id: true },
  });
  return !!row;
}

// ---------------------------------------------------------------------------
// Inventory movements (auditable Inventory → Sale → COGS chain).
// ---------------------------------------------------------------------------

export interface MovementInput {
  productId: string;
  orderId?: string | null;
  purchaseId?: string | null;
  movementType: "sale" | "purchase" | "refund_restock" | "adjustment";
  quantityDelta: number; // negative when stock leaves
  unitCost?: number | null;
}

export async function insertMovement(input: MovementInput): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return;
    const { error } = await supabase.from("inventory_movements").insert({
      product_id: input.productId,
      order_id: input.orderId ?? null,
      purchase_id: input.purchaseId ?? null,
      movement_type: input.movementType,
      quantity_delta: input.quantityDelta,
      unit_cost: input.unitCost ?? null,
    });
    if (error) throw error;
    return;
  }
  await (await getDb()).inventoryMovement.create({
    data: {
      productId: input.productId,
      orderId: input.orderId ?? null,
      purchaseId: input.purchaseId ?? null,
      movementType: input.movementType,
      quantityDelta: input.quantityDelta,
      unitCost: input.unitCost ?? null,
    },
  });
}

/** Decrement a product's stock by qty, clamped at zero (never negative). */
export async function decrementStock(productId: string, qty: number): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return;
    // Single-statement clamp: greatest(stock - qty, 0)
    const { error } = await supabase.rpc("decrement_product_stock", {
      p_product_id: productId,
      p_qty: qty,
    });
    if (error) {
      // Migration fallback: read-modify-write (service role, no RLS issues).
      const { data } = await supabase.from("products").select("stock").eq("id", productId).single();
      const next = Math.max(0, Number(data?.stock ?? 0) - qty);
      await supabase.from("products").update({ stock: next }).eq("id", productId);
      return;
    }
    return;
  }
  const db = await getDb();
  const p = await db.product.findUnique({ where: { id: productId }, select: { stock: true } });
  await db.product.update({
    where: { id: productId },
    data: { stock: Math.max(0, (p?.stock ?? 0) - qty) },
  });
}

/** Increment stock (purchases / refund restocks). */
export async function incrementStock(productId: string, qty: number): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return;
    const { data } = await supabase.from("products").select("stock").eq("id", productId).single();
    await supabase
      .from("products")
      .update({ stock: Number(data?.stock ?? 0) + qty })
      .eq("id", productId);
    return;
  }
  const db = await getDb();
  const p = await db.product.findUnique({ where: { id: productId }, select: { stock: true } });
  await db.product.update({
    where: { id: productId },
    data: { stock: (p?.stock ?? 0) + qty },
  });
}

// ---------------------------------------------------------------------------
// Sale accounting — the whole Inventory → Sale → COGS → Profit event.
// Called exactly once per order, when it becomes credited (paid family):
//   * stock decrement + movement rows (cost snapshot attached)
//   * ledger group: revenue(+), cogs(-), gross_profit(+), shipping, tax
// Idempotent via saleAlreadyRecorded — double verify calls can't double-count.
// ---------------------------------------------------------------------------

/**
 * Read an order's items + cost-at-sale snapshots, ready for
 * applySaleAccounting. unitCost is null when no snapshot exists (order
 * placed before the product had a recorded cost → COGS unknown, spec §15).
 */
export async function buildSaleLines(
  orderId: string,
): Promise<{ lines: SaleAccountingLine[]; subtotalCents: number }> {
  const lines: SaleAccountingLine[] = [];
  let subtotalCents = 0;
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient();
    if (!supabase) return { lines, subtotalCents };
    const { data: items } = await supabase
      .from("order_items")
      .select("id, product_id, price, quantity")
      .eq("order_id", orderId);
    const itemIds = (items ?? []).map((i: any) => i.id);
    const snaps = new Map<string, number>();
    if (itemIds.length > 0) {
      const { data: costs } = await supabase
        .from("order_item_costs")
        .select("order_item_id, unit_cost")
        .in("order_item_id", itemIds);
      for (const c of costs ?? []) snaps.set(c.order_item_id, Number(c.unit_cost));
    }
    for (const it of items ?? []) {
      lines.push({
        productId: it.product_id,
        quantity: it.quantity,
        unitCost: snaps.has(it.id) ? snaps.get(it.id) ?? null : null,
      });
      subtotalCents += toCents(it.price) * it.quantity;
    }
    return { lines, subtotalCents };
  }
  const db = await getDb();
  const items = await db.orderItem.findMany({
    where: { orderId },
    select: { id: true, productId: true, price: true, quantity: true },
  });
  const itemIds = items.map((i) => i.id);
  const snaps = new Map<string, number>();
  if (itemIds.length > 0) {
    const costs = await db.orderItemCost.findMany({
      where: { orderItemId: { in: itemIds } },
      select: { orderItemId: true, unitCost: true },
    });
    for (const c of costs) snaps.set(c.orderItemId, c.unitCost);
  }
  for (const it of items) {
    lines.push({
      productId: it.productId,
      quantity: it.quantity,
      unitCost: snaps.has(it.id) ? snaps.get(it.id) ?? null : null,
    });
    subtotalCents += toCents(it.price) * it.quantity;
  }
  return { lines, subtotalCents };
}

export interface SaleAccountingLine {
  productId: string;
  quantity: number;
  unitCost: number | null; // snapshot; null = cost unknown (historical)
}

export async function applySaleAccounting(params: {
  orderId: string;
  lines: SaleAccountingLine[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  currency?: string;
  actor?: SafeUser | null;
}): Promise<{ cogsCents: number }> {
  if (await saleAlreadyRecorded(params.orderId)) {
    return { cogsCents: 0 };
  }

  // 1) Inventory: decrement + movement per line (movement carries the cost
  //    snapshot so the audit chain is per-unit, not just per-order).
  let cogsCents = 0;
  for (const line of params.lines) {
    await decrementStock(line.productId, line.quantity);
    await insertMovement({
      productId: line.productId,
      orderId: params.orderId,
      movementType: "sale",
      quantityDelta: -line.quantity,
      unitCost: line.unitCost,
    });
    if (line.unitCost != null) cogsCents += toCents(line.unitCost) * line.quantity;
  }

  // 2) Ledger: one grouped entry-set for the whole order.
  const revenueCents = Math.max(0, params.subtotalCents - params.discountCents);
  const lines: LedgerLine[] = [
    {
      entryType: "sale",
      account: "revenue",
      amountCents: revenueCents,
      orderId: params.orderId,
      description: `Sale revenue (order ${params.orderId.slice(0, 8)}…)`,
    },
  ];
  if (cogsCents > 0) {
    lines.push({
      entryType: "sale",
      account: "cogs",
      amountCents: -cogsCents,
      orderId: params.orderId,
      description: "Cost of goods sold (cost at sale)",
    });
  }
  if (params.shippingCents > 0) {
    lines.push({
      entryType: "sale",
      account: "shipping",
      amountCents: params.shippingCents,
      orderId: params.orderId,
      description: "Shipping charged",
    });
  }
  if (params.taxCents > 0) {
    lines.push({
      entryType: "sale",
      account: "tax",
      amountCents: params.taxCents,
      orderId: params.orderId,
      description: "Sales tax collected (liability)",
    });
  }
  lines.push({
    entryType: "sale",
    account: "gross_profit",
    amountCents: revenueCents - cogsCents,
    orderId: params.orderId,
    description: "Gross profit (merchandise revenue − COGS)",
  });
  await insertLedgerEntries(lines, params.actor);
  return { cogsCents };
}
