-- Task 117 — test-user cleanup (prod Supabase, dashboard SQL-editor path).
--
-- Deletes the 7 agreed TEST accounts and every row that hangs off them.
-- All 7 were audited on 2026-10-18: zero orders, zero reviews, zero paid
-- money (customer@shop.demo re-checked live: 0 orders after the old demo
-- orders were purged).
--
-- NEVER touches: gabeyre80@gmail.com (owner), baashaalecade@gmail.com (real
-- customer), admin@shop.demo (demo admin).
--
-- FK map (why two DELETEs are enough):
--   public.orders.user_id      -> public.users(id)  ON DELETE CASCADE
--   public.carts.user_id       -> public.users(id)  ON DELETE CASCADE
--     (cart_items cascade via carts; order_items via orders;
--      order_item_costs via order_items; payments via orders)
--   product_reviews.user_id    -> auth.users(id)    ON DELETE CASCADE
--   wishlist_items.user_id     -> auth.users(id)    ON DELETE CASCADE
--     (auth.identities / auth.sessions / auth.refresh_tokens also cascade)
--   public.users has NO FK to auth.users -> delete both explicitly.

-- ============================================================
-- 1) PRE-AUDIT — run first, eyeball the output before step 2.
--    Expected: 7 rows here, orders/reviews counts all zero.
-- ============================================================
select u.id, u.email, u.name,
       (select count(*) from public.orders o where o.user_id = u.id)        as orders,
       (select count(*) from public.carts c where c.user_id = u.id)         as carts,
       (select count(*) from public.product_reviews r where r.user_id = u.id) as reviews,
       (select count(*) from public.wishlist_items w where w.user_id = u.id)  as wishlist
from public.users u
where lower(u.email) in (
  'customer@shop.demo',
  'task83-probe@hayaan-testing.com',
  't85-reviewer@hayaan-testing.com',
  't88-probe@shop.demo',
  't90-norman@shop.demo',
  'qa.task113@hayaan.co',
  'qa.task113b@hayaan.co'
)
order by u.email;

-- auth-side existence (rows here but not in step-1 output = no profile row,
-- still safe to delete — nothing hangs off them).
select id, email, created_at
from auth.users
where lower(email) in (
  'customer@shop.demo',
  'task83-probe@hayaan-testing.com',
  't85-reviewer@hayaan-testing.com',
  't88-probe@shop.demo',
  't90-norman@shop.demo',
  'qa.task113@hayaan.co',
  'qa.task113b@hayaan.co'
)
order by email;

-- ============================================================
-- 2) DELETE — run only after the pre-audit looks as expected.
--    Idempotent: re-running deletes zero rows.
-- ============================================================
delete from public.users
where lower(email) in (
  'customer@shop.demo',
  'task83-probe@hayaan-testing.com',
  't85-reviewer@hayaan-testing.com',
  't88-probe@shop.demo',
  't90-norman@shop.demo',
  'qa.task113@hayaan.co',
  'qa.task113b@hayaan.co'
);

delete from auth.users
where lower(email) in (
  'customer@shop.demo',
  'task83-probe@hayaan-testing.com',
  't85-reviewer@hayaan-testing.com',
  't88-probe@shop.demo',
  't90-norman@shop.demo',
  'qa.task113@hayaan.co',
  'qa.task113b@hayaan.co'
);

-- ============================================================
-- 3) POST-CHECK — both must return 0 rows.
-- ============================================================
select 'public.users leftover'  as check, count(*) from public.users
where lower(email) in ('customer@shop.demo','task83-probe@hayaan-testing.com','t85-reviewer@hayaan-testing.com','t88-probe@shop.demo','t90-norman@shop.demo','qa.task113@hayaan.co','qa.task113b@hayaan.co')
union all
select 'auth.users leftover', count(*) from auth.users
where lower(email) in ('customer@shop.demo','task83-probe@hayaan-testing.com','t85-reviewer@hayaan-testing.com','t88-probe@shop.demo','t90-norman@shop.demo','qa.task113@hayaan.co','qa.task113b@hayaan.co');
