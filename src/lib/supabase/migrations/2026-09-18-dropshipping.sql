-- Migration: Alibaba dropshipping (Task 65).
-- Supplier sourcing fields on products: the listing URL the item is
-- dropshipped from (AliExpress / Alibaba / any supplier page) and the
-- supplier's own SKU / variant identifier. Both nullable — regular
-- (non-dropship) products leave them empty. Unit cost already lives in the
-- RLS-locked product_costs side-car (2026-09-11-accounting.sql), so margin
-- math keeps working unchanged.
--
-- Run in the Supabase SQL editor.

alter table products add column if not exists supplier_url text;
alter table products add column if not exists supplier_sku text;
