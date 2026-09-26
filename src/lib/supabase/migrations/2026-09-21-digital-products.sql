-- Migration: Digital products (Task 82).
--
-- Adds digital delivery to the catalog:
--   products.product_type          'physical' (default) | 'digital'
--   products.digital_url           download link — either an external https URL
--                                  or "sb://<bucket>/<path>" pointing at a
--                                  PRIVATE Supabase Storage object (the download
--                                  endpoint signs it per request, so the raw
--                                  object never becomes public)
--   products.digital_instructions  buyer-facing how-to text shown next to the
--                                  Download button in Orders
--
-- Why digital_url lives on products (not order_items): customers can SELECT
-- their own order_items through RLS, so the purchasable URL must never be
-- snapshot onto that table. The download endpoint re-resolves it per request
-- and gates on order ownership + payment.
--
-- IDEMPOTENT — safe to run more than once. Run in the Supabase SQL editor.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_type text NOT NULL DEFAULT 'physical';
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS digital_url text;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS digital_instructions text;

-- Constrain the type discriminator (no-op if it already exists).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_product_type_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_product_type_check CHECK (product_type IN ('physical', 'digital'));
  END IF;
END $$;

-- Index for storefront surfaces that may filter/sort digital items.
CREATE INDEX IF NOT EXISTS products_product_type_idx ON products (product_type);
