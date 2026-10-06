-- Migration: Product ratings & reviews (Task 85).
--
-- Customer star ratings + written comments on products:
--   product_reviews.product_id        the reviewed product
--   product_reviews.user_id           reviewer (auth user) — ONE review per
--                                     (product, user); re-reviewing UPDATES
--   product_reviews.author_name       display name snapshot at review time
--   product_reviews.rating            1..5 stars
--   product_reviews.comment           written comment (may be empty)
--   product_reviews.verified_purchase true when the reviewer has a PAID order
--                                     containing this product (computed at
--                                     write time from orders/order_items)
--   product_reviews.status            'approved' (live) | 'hidden' (admin
--                                     moderation — kept for the author, never
--                                     counted in aggregates)
--
-- Aggregates are DENORMALIZED onto the products row (products.rating,
-- products.review_count) on every write so product cards, the PDP header,
-- sort-by-rating, and the Product JSON-LD (aggregateRating) all read the
-- summary with zero extra queries.
--
-- Security: RLS is enabled with NO policies (deny-all) — exactly the leads/
-- accounting model. Customers never touch this table directly with the anon
-- key; every read/write goes through the server's service-role API routes,
-- which validate auth, ownership, and review contents.
--
-- IDEMPOTENT — safe to run more than once. Run in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS product_reviews (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name       text NOT NULL DEFAULT '',
  rating            int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment           text NOT NULL DEFAULT '',
  verified_purchase boolean NOT NULL DEFAULT false,
  status            text NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- One review per user per product (upsert target).
-- Guard with a condition because a duplicate pre-existing pair would make a
-- plain CREATE UNIQUE INDEX fail on re-run (idempotency).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'product_reviews_product_user_key'
  ) THEN
    CREATE UNIQUE INDEX product_reviews_product_user_key
      ON product_reviews (product_id, user_id);
  END IF;
END $$;

-- Storefront listing: approved reviews per product, newest first.
CREATE INDEX IF NOT EXISTS product_reviews_product_idx
  ON product_reviews (product_id, status, created_at DESC);

-- Admin queue + moderation scans.
CREATE INDEX IF NOT EXISTS product_reviews_status_idx
  ON product_reviews (status, created_at DESC);

-- Deny-all RLS (service role only) — same model as leads / product_costs.
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

-- Rebuild the denormalized aggregates for every product that already has
-- reviews (no-op on a fresh install; recovers products if this migration is
-- re-run after manual row surgery).
UPDATE products p SET
  rating = COALESCE(s.avg_rating, 0),
  review_count = COALESCE(s.n_reviews, 0)
FROM (
  SELECT product_id, ROUND(AVG(rating)::numeric, 1)::float8 AS avg_rating, COUNT(*)::int AS n_reviews
  FROM product_reviews
  WHERE status = 'approved'
  GROUP BY product_id
) s
WHERE s.product_id = p.id;
