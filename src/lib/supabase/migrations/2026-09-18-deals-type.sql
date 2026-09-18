-- Task 61 (2026-09-18): allow the `deals` lead type.
-- The /deals electronics deal-alerts page (giveaway capture, TikTok/Facebook/
-- WhatsApp status funnel) writes leads with type = 'deals'; the original
-- table CHECK only allowed 'newsletter' and 'quote'.
--
-- Run in Supabase SQL editor (Dashboard -> SQL editor -> New query -> Run).
-- Idempotent: safe to run more than once.

alter table public.leads drop constraint if exists leads_type_check;
alter table public.leads
  add constraint leads_type_check check (type in ('newsletter', 'quote', 'deals'));
