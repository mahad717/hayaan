-- Migration: user profile + saved shipping address (and order contact phone).
-- Run ONCE in the Supabase SQL editor for EXISTING deployments that already
-- created the schema before 2026-09-06. Fresh projects can skip this —
-- schema.sql already includes these columns.
--
-- Idempotent: safe to run multiple times.

alter table users add column if not exists phone   text;
alter table users add column if not exists address text;
alter table users add column if not exists city    text;
alter table users add column if not exists zip     text;
alter table users add column if not exists country text;

alter table orders add column if not exists shipping_phone text;
