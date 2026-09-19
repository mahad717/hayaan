-- 2026-09-20: "Health Supplements" storefront category (vitamins etc.).
--
-- Adds the single category the owner asked for so vitamin / supplement
-- products can be assigned to it from the admin product form.
-- The storefront category pills, admin dropdown and Google feed all read
-- the categories table, so no deploy is needed for the pill to appear —
-- just run this once in the Supabase SQL editor.
--
-- Idempotent: safe to re-run (ON CONFLICT skips the insert if it exists).
begin;

insert into categories (name, slug, description) values
  ('Health Supplements', 'health-supplements', 'Vitamins, minerals and everyday wellness supplements.')
on conflict (slug) do nothing;

commit;

-- Expected afterwards: 5 categories (the previous 4 + Health Supplements).
-- The pill will show "No products found" until the first product is
-- assigned to it via Admin -> Create/Edit product -> Category.
