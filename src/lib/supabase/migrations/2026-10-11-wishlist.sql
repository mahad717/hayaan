-- Migration: Wishlist (Task 88).
--
-- Products a customer saved for later ("heart" toggle on product cards and
-- the product detail page, plus a dedicated /?view=wishlist page):
--   wishlist_items.user_id     the account that saved the product
--   wishlist_items.product_id  the saved product
--   wishlist_items.created_at  save time — the wishlist lists newest first
--
-- ONE row per (user, product): tapping the heart again removes the row, so
-- the table stays a clean set (no duplicates, no counters).
--
-- Security: RLS is enabled with NO policies (deny-all) — exactly the
-- product_reviews / leads model. Customers never touch this table directly
-- with the anon key; every read/write goes through the server's
-- service-role /api/wishlist routes, which validate auth and ownership.
--
-- IDEMPOTENT — safe to run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS wishlist_items (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (user, product). Guarded so a duplicate pre-existing pair
-- would not make a plain CREATE UNIQUE INDEX fail on re-run (idempotency).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'wishlist_items_user_product_key'
  ) THEN
    CREATE UNIQUE INDEX wishlist_items_user_product_key
      ON wishlist_items (user_id, product_id);
  END IF;
END $$;

-- Wishlist listing: a user's saves, newest first.
CREATE INDEX IF NOT EXISTS wishlist_items_user_idx
  ON wishlist_items (user_id, created_at DESC);

-- Deny-all RLS (service role only) — same model as leads / product_reviews.
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
