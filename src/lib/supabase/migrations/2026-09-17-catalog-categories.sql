-- 2026-09-17: Catalog categories for the imported Sanguni product list (Task 52).
--
-- The 94 imported products landed in the two legacy categories that could be
-- written without a deploy (tiers 1-3 -> "electronics", tier 4 -> "home-living").
-- Every product also carries ONE tier tag (the category slug it belongs to).
-- This snippet, pasted ONCE into the Supabase SQL editor, is idempotent and:
--   1. creates the 4 proper storefront categories,
--   2. re-maps every product by its tier tag,
--   3. strips the interim tier tags (they show as "#home-office" chips on PDPs),
--   4. removes the empty demo categories (Apparel / Beauty / Electronics /
--      Home & Living) so no dead "No products found" pills remain.
-- Safe to re-run. Products are re-mapped BEFORE the old rows are deleted, so
-- no product ever ends up with category_id NULL.
begin;

insert into categories (name, slug, description) values
  ('Power & Charging',   'power-charging-audio', 'Power banks, chargers, cables and audio gear.'),
  ('Phones & Wearables', 'phones-wearables',     'Smartphones, smart watches and wearables.'),
  ('Computers & TV',     'computers-tv-gaming',  'Laptops, printers, TVs, gaming and accessories.'),
  ('Home & Office',      'home-office',          'Home appliances, office equipment and networking.')
on conflict (slug) do nothing;

update products p set category_id = c.id
  from categories c
 where c.slug = 'power-charging-audio' and p.tags @> '["power-charging-audio"]'::jsonb;

update products p set category_id = c.id
  from categories c
 where c.slug = 'phones-wearables' and p.tags @> '["phones-wearables"]'::jsonb;

update products p set category_id = c.id
  from categories c
 where c.slug = 'computers-tv-gaming' and p.tags @> '["computers-tv-gaming"]'::jsonb;

update products p set category_id = c.id
  from categories c
 where c.slug = 'home-office' and p.tags @> '["home-office"]'::jsonb;

update products set tags = tags - 'power-charging-audio' where tags @> '["power-charging-audio"]'::jsonb;
update products set tags = tags - 'phones-wearables'     where tags @> '["phones-wearables"]'::jsonb;
update products set tags = tags - 'computers-tv-gaming'  where tags @> '["computers-tv-gaming"]'::jsonb;
update products set tags = tags - 'home-office'          where tags @> '["home-office"]'::jsonb;

delete from categories where slug in ('apparel', 'beauty', 'electronics', 'home-living');

commit;

-- Expected afterwards: 4 categories, 94 products —
--   Power & Charging 26, Phones & Wearables 20, Computers & TV 22, Home & Office 26.
