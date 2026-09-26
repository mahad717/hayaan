// Detects the Supabase/PostgREST error raised when the products table is
// missing the dropshipping supplier columns (Task 65 migration
// `2026-09-18-dropshipping.sql` not run yet). Used so product create/update
// DEGRADES gracefully — the product still saves, only the supplier fields
// are dropped — instead of failing the whole save with a cryptic 400.

export function isMissingSupplierColumns(
  err: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!err) return false;
  if (err.code === "PGRST204" && /supplier_(url|sku)/i.test(err.message ?? "")) return true;
  return /could not find the '(supplier_url|supplier_sku)' column/i.test(err.message ?? "");
}

// Same degradation pattern for the digital-product columns (Task 82,
// migration `2026-09-21-digital-products.sql` not run yet): a save of a
// physical product never needs them, and a digital product saves with the
// digital fields stripped (owner sees a hint to run the SQL).
export function isMissingDigitalColumns(
  err: { code?: string | null; message?: string | null } | null | undefined,
): boolean {
  if (!err) return false;
  if (err.code === "PGRST204" && /(product_type|digital_url|digital_instructions)/i.test(err.message ?? "")) return true;
  return /could not find the '(product_type|digital_url|digital_instructions)' column/i.test(err.message ?? "");
}
