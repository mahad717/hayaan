-- Migration: Sifalo Pay payment tracking on orders.
-- Run ONCE in the Supabase SQL editor for EXISTING deployments that already
-- created the schema before this date. Fresh projects can skip this —
-- schema.sql already includes the column.
--
-- Idempotent: safe to run multiple times.

alter table orders add column if not exists payment_status text not null default 'pending';
